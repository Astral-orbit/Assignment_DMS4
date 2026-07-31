import { env } from "cloudflare:workers";

type Point = { name: string; latitude: number; longitude: number };
type TransitStep = { mode: string; instruction: string; line: string; stops: number };
type RouteLeg = { from: string; to: string; durationSeconds: number; distanceMeters: number; fare: string | null; transfers: number; steps: TransitStep[] };

function decodePolyline(encoded: string): Array<[number, number]> {
  const coordinates: Array<[number, number]> = [];
  let index = 0; let lat = 0; let lng = 0;
  while (index < encoded.length) {
    let result = 0; let shift = 0; let byte: number;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : result >> 1;
    result = 0; shift = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : result >> 1;
    coordinates.push([lng / 1e5, lat / 1e5]);
  }
  return coordinates;
}

const seconds = (duration?: string) => Number(duration?.replace("s", "") || 0);

async function googleTransitLeg(from: Point, to: Point, languageCode: string, apiKey: string, preference: string) {
  const fieldMask = [
    "routes.duration", "routes.distanceMeters", "routes.polyline.encodedPolyline",
    "routes.travelAdvisory.transitFare", "routes.localizedValues",
    "routes.legs.steps.travelMode", "routes.legs.steps.navigationInstruction",
    "routes.legs.steps.transitDetails",
  ].join(",");
  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": fieldMask },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: from.latitude, longitude: from.longitude } } },
      destination: { location: { latLng: { latitude: to.latitude, longitude: to.longitude } } },
      travelMode: "TRANSIT",
      departureTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      languageCode,
      units: "METRIC",
      computeAlternativeRoutes: false,
      transitPreferences: preference ? { routingPreference: preference } : undefined,
    }),
  });
  if (!response.ok) throw new Error(`Google Routes ${response.status}`);
  const data = await response.json() as {
    routes?: Array<{
      duration?: string;
      distanceMeters?: number;
      polyline?: { encodedPolyline?: string };
      travelAdvisory?: { transitFare?: { text?: string; currencyCode?: string; units?: string; nanos?: number } };
      localizedValues?: { transitFare?: { text?: string } };
      legs?: Array<{ steps?: Array<{
        travelMode?: string;
        navigationInstruction?: { instructions?: string };
        transitDetails?: { stopCount?: number; transitLine?: { nameShort?: string; name?: string; vehicle?: { name?: { text?: string } } } };
      }> }>;
    }>;
  };
  const route = data.routes?.[0];
  if (!route) throw new Error("No transit route");
  const steps: TransitStep[] = (route.legs?.[0]?.steps || []).map(step => ({
    mode: step.travelMode || "WALK",
    instruction: step.navigationInstruction?.instructions || "",
    line: step.transitDetails?.transitLine?.nameShort || step.transitDetails?.transitLine?.name || step.transitDetails?.transitLine?.vehicle?.name?.text || "",
    stops: step.transitDetails?.stopCount || 0,
  }));
  const transitSteps = steps.filter(step => step.mode === "TRANSIT");
  const fare = route.localizedValues?.transitFare?.text || route.travelAdvisory?.transitFare?.text || null;
  return {
    geometry: route.polyline?.encodedPolyline ? decodePolyline(route.polyline.encodedPolyline) : [[from.longitude, from.latitude], [to.longitude, to.latitude]] as Array<[number, number]>,
    leg: {
      from: from.name,
      to: to.name,
      durationSeconds: seconds(route.duration),
      distanceMeters: route.distanceMeters || 0,
      fare,
      transfers: Math.max(0, transitSteps.length - 1),
      steps,
    } satisfies RouteLeg,
  };
}

async function googleTransit(points: Point[], languageCode: string, apiKey: string, preference: string) {
  const results = [];
  for (let index = 0; index < points.length - 1; index++) {
    results.push(await googleTransitLeg(points[index], points[index + 1], languageCode, apiKey, preference));
  }
  const legs = results.map(result => result.leg);
  return {
    source: "Google Routes",
    transitAvailable: true,
    geometry: results.flatMap((result, index) => index ? result.geometry.slice(1) : result.geometry),
    legs,
    totalDurationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0),
    totalDistanceMeters: legs.reduce((sum, leg) => sum + leg.distanceMeters, 0),
    totalTransfers: legs.reduce((sum, leg) => sum + leg.transfers, 0),
    totalFare: legs.map(leg => leg.fare).filter(Boolean).join(" + ") || null,
  };
}

async function osrmFallback(points: Point[]) {
  const coordinates = points.map(point => `${point.longitude},${point.latitude}`).join(";");
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`);
  if (!response.ok) throw new Error("OSRM unavailable");
  const data = await response.json() as { routes?: Array<{ duration?: number; distance?: number; geometry?: { coordinates?: Array<[number, number]> } }> };
  const route = data.routes?.[0];
  if (!route) throw new Error("No fallback route");
  return {
    source: "OSRM road fallback",
    transitAvailable: false,
    geometry: route.geometry?.coordinates || points.map(point => [point.longitude, point.latitude] as [number, number]),
    legs: [] as RouteLeg[],
    totalDurationSeconds: route.duration || 0,
    totalDistanceMeters: route.distance || 0,
    totalTransfers: null,
    totalFare: null,
  };
}

export async function POST(request: Request) {
  const body = await request.json() as { points?: Point[]; lang?: "KR" | "EN" | "ZH" | "JA" | "VI"; preference?: "LESS_WALKING" | "FEWER_TRANSFERS" | "" };
  const points = (body.points || []).filter(point => point.name && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)).slice(0, 12);
  if (points.length < 2) return Response.json({ error: "At least two valid points are required." }, { status: 400 });
  const bindings = env as typeof env & { GOOGLE_MAPS_API_KEY?: string };
  try {
    const languageCode = ({ KR: "ko", EN: "en", ZH: "zh-CN", JA: "ja", VI: "vi" } as const)[body.lang || "EN"];
    if (bindings.GOOGLE_MAPS_API_KEY) {
      try {
        return Response.json(await googleTransit(points, languageCode, bindings.GOOGLE_MAPS_API_KEY, body.preference || ""));
      } catch { /* use the real road route when transit is unavailable */ }
    }
    return Response.json(await osrmFallback(points));
  } catch {
    return Response.json({
      source: "direct geometry fallback",
      transitAvailable: false,
      geometry: points.map(point => [point.longitude, point.latitude]),
      legs: [],
      totalDurationSeconds: 0,
      totalDistanceMeters: 0,
      totalTransfers: null,
      totalFare: null,
      error: "Live route data is temporarily unavailable.",
    }, { status: 503 });
  }
}
