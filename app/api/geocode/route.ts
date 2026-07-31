import { env } from "cloudflare:workers";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const query = requestUrl.searchParams.get("q")?.trim();
  const languageCode = ({ KR: "ko", EN: "en", ZH: "zh-CN", JA: "ja", VI: "vi" } as const)[requestUrl.searchParams.get("lang") as "KR" | "EN" | "ZH" | "JA" | "VI"] || "en";
  if (!query) return Response.json({ error: "Missing destination" }, { status: 400 });
  const bindings = env as typeof env & { GOOGLE_MAPS_API_KEY?: string };

  if (bindings.GOOGLE_MAPS_API_KEY) {
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("address", query);
      url.searchParams.set("language", languageCode);
      url.searchParams.set("key", bindings.GOOGLE_MAPS_API_KEY);
      const response = await fetch(url);
      const data = await response.json() as { results?: Array<{
        formatted_address: string;
        geometry: {
          location: { lat: number; lng: number };
          bounds?: { northeast: { lat: number; lng: number }; southwest: { lat: number; lng: number } };
          viewport?: { northeast: { lat: number; lng: number }; southwest: { lat: number; lng: number } };
        };
        address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
      }> };
      const result = data.results?.[0];
      if (result) {
        const country = result.address_components?.find(component => component.types.includes("country"));
        const region = result.geometry.bounds || result.geometry.viewport;
        return Response.json({
          ...result.geometry.location,
          displayName: result.formatted_address,
          country: country?.long_name,
          countryCode: country?.short_name,
          bounds: region ? {
            south: region.southwest.lat,
            west: region.southwest.lng,
            north: region.northeast.lat,
            east: region.northeast.lng,
          } : undefined,
          source: "Google Maps Geocoding",
        });
      }
    } catch { /* fall through to the open geocoder */ }
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query); url.searchParams.set("format", "jsonv2"); url.searchParams.set("limit", "1"); url.searchParams.set("addressdetails", "1");
    const response = await fetch(url, { headers: { "User-Agent": "LOCI-Travel-Planner/1.0", "Accept-Language": languageCode } });
    const [result] = await response.json() as Array<{ lat: string; lon: string; display_name: string; boundingbox?: [string, string, string, string]; address?: { country?: string; country_code?: string } }>;
    if (result) return Response.json({
      lat: Number(result.lat),
      lng: Number(result.lon),
      displayName: result.display_name,
      country: result.address?.country,
      countryCode: result.address?.country_code?.toUpperCase(),
      bounds: result.boundingbox ? {
        south: Number(result.boundingbox[0]),
        north: Number(result.boundingbox[1]),
        west: Number(result.boundingbox[2]),
        east: Number(result.boundingbox[3]),
      } : undefined,
      source: "OpenStreetMap Nominatim",
    });
  } catch { /* return an explicit no-result response */ }
  return Response.json({ error: "Destination not found", source: "none" }, { status: 404 });
}
