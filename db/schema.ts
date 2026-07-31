import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const reviews = sqliteTable("reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  placeId: text("place_id").notNull(),
  author: text("author").notNull(),
  rating: real("rating").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  region: text("region").notNull(),
  author: text("author").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  likes: integer("likes").notNull().default(0),
  editTokenHash: text("edit_token_hash"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
