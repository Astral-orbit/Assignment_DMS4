import { env } from "cloudflare:workers";

const weatherText: Record<number, { ko: string; en: string }> = {
  0: { ko: "맑음", en: "Clear" },
  1: { ko: "대체로 맑음", en: "Mostly clear" },
  2: { ko: "구름 조금", en: "Partly cloudy" },
  3: { ko: "흐림", en: "Overcast" },
  45: { ko: "안개", en: "Fog" },
  48: { ko: "짙은 안개", en: "Rime fog" },
  51: { ko: "약한 이슬비", en: "Light drizzle" },
  53: { ko: "이슬비", en: "Drizzle" },
  55: { ko: "강한 이슬비", en: "Heavy drizzle" },
  61: { ko: "약한 비", en: "Light rain" },
  63: { ko: "비", en: "Rain" },
  65: { ko: "강한 비", en: "Heavy rain" },
  71: { ko: "약한 눈", en: "Light snow" },
  73: { ko: "눈", en: "Snow" },
  75: { ko: "강한 눈", en: "Heavy snow" },
  80: { ko: "약한 소나기", en: "Light rain showers" },
  81: { ko: "소나기", en: "Rain showers" },
  82: { ko: "강한 소나기", en: "Heavy rain showers" },
  95: { ko: "뇌우", en: "Thunderstorm" },
  96: { ko: "우박을 동반한 뇌우", en: "Thunderstorm with hail" },
  99: { ko: "강한 우박성 뇌우", en: "Severe thunderstorm with hail" },
};

type GoogleWeatherResponse = {
  currentTime?: string;
  timeZone?: { id?: string };
  weatherCondition?: { description?: { text?: string }; type?: string };
  temperature?: { degrees?: number };
  feelsLikeTemperature?: { degrees?: number };
  relativeHumidity?: number;
  uvIndex?: number;
  precipitation?: {
    qpf?: { quantity?: number };
    probability?: { percent?: number; type?: string };
  };
  wind?: {
    direction?: { cardinal?: string; degrees?: number };
    speed?: { value?: number };
    gust?: { value?: number };
  };
  visibility?: { distance?: number };
  cloudCover?: number;
};

type GoogleDailyForecastResponse = {
  timeZone?: { id?: string };
  forecastDays?: Array<{
    displayDate?: { year?: number; month?: number; day?: number };
    maxTemperature?: { degrees?: number };
    minTemperature?: { degrees?: number };
  }>;
};

const jsonHeaders = { "Cache-Control": "public, max-age=300, s-maxage=600" };

async function resolveCoordinates(destination: string, languageCode: string, googleKey?: string) {
  if (googleKey) {
    try {
      const geocode = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      geocode.searchParams.set("address", destination);
      geocode.searchParams.set("language", languageCode);
      geocode.searchParams.set("key", googleKey);
      const response = await fetch(geocode);
      const data = await response.json() as { results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }> };
      const location = data.results?.[0]?.geometry?.location;
      if (typeof location?.lat === "number" && typeof location.lng === "number") return { lat: location.lat, lng: location.lng };
    } catch { /* fall through to the open geocoder */ }
  }
  try {
    const geocode = new URL("https://nominatim.openstreetmap.org/search");
    geocode.searchParams.set("q", destination);
    geocode.searchParams.set("format", "jsonv2");
    geocode.searchParams.set("limit", "1");
    const response = await fetch(geocode, { headers: { "User-Agent": "LOCI-Travel-Planner/1.0", "Accept-Language": languageCode } });
    const [result] = await response.json() as Array<{ lat?: string; lon?: string }>;
    const lat = Number(result?.lat);
    const lng = Number(result?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  } catch { /* return no coordinates */ }
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const latParam = url.searchParams.get("lat");
  const lngParam = url.searchParams.get("lng");
  let lat = latParam == null || latParam === "" ? Number.NaN : Number(latParam);
  let lng = lngParam == null || lngParam === "" ? Number.NaN : Number(lngParam);
  const destination = url.searchParams.get("destination")?.trim() || "";
  const languageCode = ({ KR: "ko", EN: "en", ZH: "zh-CN", JA: "ja", VI: "vi" } as const)[url.searchParams.get("lang") as "KR" | "EN" | "ZH" | "JA" | "VI"] || "en";
  const bindings = env as typeof env & {
    GOOGLE_WEATHER_API_KEY?: string;
    GOOGLE_MAPS_API_KEY?: string;
  };
  const googleKey = bindings.GOOGLE_WEATHER_API_KEY || bindings.GOOGLE_MAPS_API_KEY;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    const resolved = destination ? await resolveCoordinates(destination, languageCode, bindings.GOOGLE_MAPS_API_KEY || googleKey) : null;
    if (!resolved) return Response.json({ error: "A valid destination or coordinates are required." }, { status: 400 });
    lat = resolved.lat;
    lng = resolved.lng;
  }
  let googleError = "";

  if (googleKey) {
    try {
      const google = new URL("https://weather.googleapis.com/v1/currentConditions:lookup");
      google.searchParams.set("key", googleKey);
      google.searchParams.set("location.latitude", String(lat));
      google.searchParams.set("location.longitude", String(lng));
      google.searchParams.set("unitsSystem", "METRIC");
      google.searchParams.set("languageCode", languageCode);
      const response = await fetch(google);
      if (!response.ok) {
        googleError = `Google Weather returned ${response.status}`;
      } else {
        const data = await response.json() as GoogleWeatherResponse;
        const temp = data.temperature?.degrees;
        if (typeof temp !== "number") throw new Error("Google Weather omitted temperature");
        let daily: GoogleDailyForecastResponse | null = null;
        try {
          const forecast = new URL("https://weather.googleapis.com/v1/forecast/days:lookup");
          forecast.searchParams.set("key", googleKey);
          forecast.searchParams.set("location.latitude", String(lat));
          forecast.searchParams.set("location.longitude", String(lng));
          forecast.searchParams.set("unitsSystem", "METRIC");
          forecast.searchParams.set("languageCode", languageCode);
          forecast.searchParams.set("days", "1");
          forecast.searchParams.set("pageSize", "1");
          const dailyResponse = await fetch(forecast);
          if (dailyResponse.ok) daily = await dailyResponse.json() as GoogleDailyForecastResponse;
        } catch { /* current conditions remain useful without a daily range */ }
        const today = daily?.forecastDays?.[0];
        const displayDate = today?.displayDate;
        return Response.json({
          temp,
          feels: data.feelsLikeTemperature?.degrees ?? temp,
          condition: data.weatherCondition?.description?.text || data.weatherCondition?.type || (languageCode === "ko" ? "현재 날씨" : "Current weather"),
          humidity: data.relativeHumidity ?? null,
          precipitationProbability: data.precipitation?.probability?.percent ?? null,
          precipitationAmount: data.precipitation?.qpf?.quantity ?? null,
          precipitationType: data.precipitation?.probability?.type ?? null,
          windSpeed: data.wind?.speed?.value ?? null,
          windGust: data.wind?.gust?.value ?? null,
          windDirection: data.wind?.direction?.cardinal ?? null,
          uvIndex: data.uvIndex ?? null,
          visibility: data.visibility?.distance ?? null,
          cloudCover: data.cloudCover ?? null,
          high: today?.maxTemperature?.degrees ?? null,
          low: today?.minTemperature?.degrees ?? null,
          localDate: displayDate?.year && displayDate.month && displayDate.day ? `${displayDate.year}-${String(displayDate.month).padStart(2, "0")}-${String(displayDate.day).padStart(2, "0")}` : null,
          timeZone: daily?.timeZone?.id || data.timeZone?.id || null,
          observedAt: data.currentTime ?? null,
          source: "Google Weather API",
        }, { headers: jsonHeaders });
      }
    } catch (error) {
      googleError = error instanceof Error ? error.message : "Google Weather request failed";
    }
  }

  try {
    const fallback = new URL("https://api.open-meteo.com/v1/forecast");
    fallback.searchParams.set("latitude", String(lat));
    fallback.searchParams.set("longitude", String(lng));
    fallback.searchParams.set("current", "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover");
    fallback.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
    fallback.searchParams.set("forecast_days", "1");
    fallback.searchParams.set("timezone", "auto");
    const response = await fetch(fallback);
    if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
    const data = await response.json() as {
      current?: {
        time?: string;
        temperature_2m?: number;
        apparent_temperature?: number;
        relative_humidity_2m?: number;
        precipitation?: number;
        weather_code?: number;
        wind_speed_10m?: number;
        wind_gusts_10m?: number;
        wind_direction_10m?: number;
        cloud_cover?: number;
      };
      daily?: { time?: string[]; temperature_2m_max?: number[]; temperature_2m_min?: number[] };
      timezone?: string;
    };
    const temp = data.current?.temperature_2m;
    if (typeof temp !== "number") throw new Error("Open-Meteo omitted temperature");
    const code = data.current?.weather_code ?? 0;
    const condition = weatherText[code] || { ko: "현재 날씨", en: "Current weather" };
    return Response.json({
      temp,
      feels: data.current?.apparent_temperature ?? temp,
      condition: languageCode === "ko" ? condition.ko : condition.en,
      humidity: data.current?.relative_humidity_2m ?? null,
      precipitationProbability: null,
      precipitationAmount: data.current?.precipitation ?? null,
      precipitationType: null,
      windSpeed: data.current?.wind_speed_10m ?? null,
      windGust: data.current?.wind_gusts_10m ?? null,
      windDirection: data.current?.wind_direction_10m ?? null,
      uvIndex: null,
      visibility: null,
      cloudCover: data.current?.cloud_cover ?? null,
      high: data.daily?.temperature_2m_max?.[0] ?? null,
      low: data.daily?.temperature_2m_min?.[0] ?? null,
      localDate: data.daily?.time?.[0] ?? null,
      timeZone: data.timezone ?? null,
      observedAt: data.current?.time ?? null,
      source: "Open-Meteo fallback",
      googleStatus: googleKey ? googleError || "Google Weather unavailable" : "Google Weather API key is not configured",
    }, { headers: jsonHeaders });
  } catch {
    return Response.json({
      error: "Weather is temporarily unavailable",
      googleStatus: googleKey ? googleError || "Google Weather unavailable" : "Google Weather API key is not configured",
    }, { status: 503 });
  }
}
