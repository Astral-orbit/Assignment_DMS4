import { env } from "cloudflare:workers";

const photoPattern = /^places\/[^/]+\/photos\/[^/]+$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const name = url.searchParams.get("name")?.trim() || "";
  if (!photoPattern.test(name)) {
    return Response.json({ error: "Invalid Google Places photo resource." }, { status: 400 });
  }

  const bindings = env as typeof env & { GOOGLE_MAPS_API_KEY?: string };
  if (!bindings.GOOGLE_MAPS_API_KEY) {
    return Response.json({ error: "Google Places photos are not configured." }, { status: 503 });
  }

  try {
    const media = new URL(`https://places.googleapis.com/v1/${name}/media`);
    media.searchParams.set("maxWidthPx", "1200");
    media.searchParams.set("maxHeightPx", "800");
    media.searchParams.set("skipHttpRedirect", "true");
    const response = await fetch(media, {
      headers: { "X-Goog-Api-Key": bindings.GOOGLE_MAPS_API_KEY },
    });
    if (!response.ok) {
      return Response.json({ error: "Google Places photo is unavailable." }, { status: response.status });
    }
    const data = await response.json() as { photoUri?: string };
    if (!data.photoUri || !data.photoUri.startsWith("https://")) {
      return Response.json({ error: "Google Places photo URI was not returned." }, { status: 502 });
    }
    return new Response(null, {
      status: 302,
      headers: {
        Location: data.photoUri,
        "Cache-Control": "public, max-age=1800, s-maxage=3600",
      },
    });
  } catch {
    return Response.json({ error: "Google Places photo is temporarily unavailable." }, { status: 503 });
  }
}
