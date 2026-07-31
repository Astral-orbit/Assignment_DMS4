import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { reviews } from "../../../db/schema";

export async function GET(request: Request) {
  const placeId = new URL(request.url).searchParams.get("placeId")?.trim();
  if (!placeId) return Response.json({ error: "Missing placeId", reviews: [] }, { status: 400 });
  try {
    const rows = await getDb().select().from(reviews).where(eq(reviews.placeId, placeId)).orderBy(desc(reviews.id)).limit(30);
    return Response.json({ reviews: rows });
  } catch {
    return Response.json({ reviews: [], error: "Reviews are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as { placeId?: string; author?: string; rating?: number; content?: string };
  if (!body.placeId || body.placeId.length > 250 || !body.content?.trim() || body.content.trim().length > 3000 || typeof body.rating !== "number" || !Number.isFinite(body.rating) || body.rating < 1 || body.rating > 10 || (body.author?.length || 0) > 60) {
    return Response.json({ error: "Invalid review" }, { status: 400 });
  }
  try {
    const [review] = await getDb().insert(reviews).values({
      placeId: body.placeId,
      author: body.author?.trim() || "LOCI traveler",
      rating: body.rating,
      content: body.content.trim(),
    }).returning();
    return Response.json({ review }, { status: 201 });
  } catch { return Response.json({ error: "Review could not be saved." }, { status: 503 }); }
}
