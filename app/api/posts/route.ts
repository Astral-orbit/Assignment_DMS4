import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { posts } from "../../../db/schema";

async function hashToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function GET(request: Request) {
  const region = new URL(request.url).searchParams.get("region")?.trim();
  if (!region) return Response.json({ error: "Missing region", posts: [] }, { status: 400 });
  try {
    const rows = await getDb().select({
      id: posts.id,
      region: posts.region,
      author: posts.author,
      title: posts.title,
      content: posts.content,
      likes: posts.likes,
      createdAt: posts.createdAt,
    }).from(posts).where(eq(posts.region, region)).orderBy(desc(posts.id)).limit(40);
    return Response.json({ posts: rows });
  } catch {
    return Response.json({ posts: [], error: "Community posts are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as { region?: string; author?: string; title?: string; content?: string };
  if (!body.region || body.region.length > 80 || !body.title?.trim() || body.title.trim().length > 160 || !body.content?.trim() || body.content.trim().length > 5000 || (body.author?.length || 0) > 60) {
    return Response.json({ error: "Invalid post" }, { status: 400 });
  }
  try {
    const editToken = crypto.randomUUID();
    const [post] = await getDb().insert(posts).values({
      region: body.region,
      author: body.author?.trim() || "LOCI traveler",
      title: body.title.trim(),
      content: body.content.trim(),
      editTokenHash: await hashToken(editToken),
    }).returning();
    return Response.json({ post: { ...post, editTokenHash: undefined }, editToken }, { status: 201 });
  } catch { return Response.json({ error: "Post could not be saved." }, { status: 503 }); }
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as { id?: number; title?: string; content?: string; editToken?: string };
  if (!body.id || !body.title?.trim() || body.title.trim().length > 160 || !body.content?.trim() || body.content.trim().length > 5000 || !body.editToken) return Response.json({ error: "Invalid post" }, { status: 400 });
  try {
    const [existing] = await getDb().select({ editTokenHash: posts.editTokenHash }).from(posts).where(eq(posts.id, body.id)).limit(1);
    if (!existing?.editTokenHash || existing.editTokenHash !== await hashToken(body.editToken)) return Response.json({ error: "You do not own this post." }, { status: 403 });
    const [post] = await getDb().update(posts).set({ title: body.title.trim(), content: body.content.trim() }).where(eq(posts.id, body.id)).returning();
    return Response.json({ post: { ...post, editTokenHash: undefined } });
  } catch { return Response.json({ error: "Post could not be updated." }, { status: 503 }); }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  const editToken = url.searchParams.get("editToken") || "";
  if (!Number.isInteger(id) || id <= 0 || !editToken) return Response.json({ error: "Invalid post request" }, { status: 400 });
  try {
    const [existing] = await getDb().select({ editTokenHash: posts.editTokenHash }).from(posts).where(eq(posts.id, id)).limit(1);
    if (!existing?.editTokenHash || existing.editTokenHash !== await hashToken(editToken)) return Response.json({ error: "You do not own this post." }, { status: 403 });
    await getDb().delete(posts).where(eq(posts.id, id));
    return Response.json({ deleted: id });
  } catch { return Response.json({ error: "Post could not be deleted." }, { status: 503 }); }
}
