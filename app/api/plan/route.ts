import { env } from "cloudflare:workers";

export async function POST(request: Request) {
  const input = await request.json();
  const bindings = env as typeof env & { OPENROUTER_API_KEY?: string };
  if (!bindings.OPENROUTER_API_KEY) {
    return Response.json({ error: "AI planning is not configured. Map-based plans remain available." }, { status: 503 });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bindings.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": new URL(request.url).origin,
        "X-Title": "LOCI Travel Planner",
      },
      body: JSON.stringify({
        model: "google/gemma-4-26b-a4b-it:free",
        messages: [{
          role: "user",
          content: `Create a concise, safe, evidence-conscious trip-planning brief. Never invent live traffic or venue facts. User context: ${JSON.stringify(input)}`,
        }],
      }),
    });
    if (!response.ok) return Response.json({ error: "AI planning is temporarily unavailable." }, { status: 503 });
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const summary = data.choices?.[0]?.message?.content?.trim();
    if (!summary) return Response.json({ error: "AI planning returned no usable result." }, { status: 502 });
    return Response.json({ source: "Gemma 4 via OpenRouter", summary });
  } catch {
    return Response.json({ error: "AI planning is temporarily unavailable." }, { status: 503 });
  }
}
