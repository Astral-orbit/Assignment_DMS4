type Region = {
  id: string;
  name: string;
  originalName: string | null;
  adminLevel: number;
  latitude: number | null;
  longitude: number | null;
};

type OverpassElement = {
  id: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

const cache = new Map<string, { expires: number; regions: Region[] }>();
const languageCodes: Record<string, string> = { KR: "ko", EN: "en", ZH: "zh", JA: "ja", VI: "vi" };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const countryCode = url.searchParams.get("countryCode")?.trim().toUpperCase() || "";
  const languageCode = languageCodes[url.searchParams.get("lang") || "KR"] || "en";
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return Response.json({ error: "A valid ISO country code is required." }, { status: 400 });
  }

  const cacheKey = `${countryCode}:${languageCode}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return Response.json({ countryCode, regions: cached.regions, source: "OpenStreetMap", cached: true });
  }

  try {
    const query = `[out:json][timeout:25];
      area["ISO3166-1"="${countryCode}"]["boundary"="administrative"]["admin_level"="2"]->.country;
      rel(area.country)["boundary"="administrative"]["admin_level"~"4|5|6"];
      out tags center 350;`;
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "LOCI-Travel-Planner/1.0",
      },
      body: new URLSearchParams({ data: query }),
    });
    if (!response.ok) throw new Error(`Overpass returned ${response.status}`);
    const data = await response.json() as { elements?: OverpassElement[] };
    const seen = new Set<string>();
    const regions = (data.elements || []).flatMap((element): Region[] => {
      const tags = element.tags || {};
      const originalName = tags.name;
      const localizedName = tags[`name:${languageCode}`] || originalName;
      const adminLevel = Number(tags.admin_level);
      if (!localizedName || !Number.isFinite(adminLevel) || adminLevel < 4 || adminLevel > 6) return [];
      const dedupe = `${localizedName.toLocaleLowerCase()}:${adminLevel}`;
      if (seen.has(dedupe)) return [];
      seen.add(dedupe);
      return [{
        id: tags["ISO3166-2"] || `osm-relation-${element.id}`,
        name: localizedName,
        originalName: originalName && originalName !== localizedName ? originalName : null,
        adminLevel,
        latitude: typeof element.center?.lat === "number" ? element.center.lat : null,
        longitude: typeof element.center?.lon === "number" ? element.center.lon : null,
      }];
    }).sort((a, b) => a.adminLevel - b.adminLevel || a.name.localeCompare(b.name, languageCode)).slice(0, 180);

    cache.set(cacheKey, { expires: Date.now() + 24 * 60 * 60 * 1000, regions });
    return Response.json({
      countryCode,
      regions,
      source: "OpenStreetMap administrative boundaries",
    }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
  } catch {
    return Response.json({
      countryCode,
      regions: [],
      source: "unavailable",
      error: "Regional boundaries are temporarily unavailable. The country can still be selected.",
    }, { status: 503 });
  }
}
