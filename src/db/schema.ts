import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const links = sqliteTable(
  "links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    originalUrl: text("original_url").notNull(),
    title: text("title"),
    expiresAt: text("expires_at"),
    maxClicks: integer("max_clicks"),
    clickCount: integer("click_count").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    userId: text("user_id"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_links_original_url").on(table.originalUrl),
    index("idx_links_user_id").on(table.userId),
  ],
);

export const clicks = sqliteTable(
  "clicks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    linkId: integer("link_id")
      .notNull()
      .references(() => links.id, { onDelete: "cascade" }),
    referrer: text("referrer"),
    deviceType: text("device_type").notNull(),
    browser: text("browser").notNull(),
    country: text("country").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_clicks_link_id").on(table.linkId),
    index("idx_clicks_created_at").on(table.createdAt),
  ],
);

export const apiKeys = sqliteTable("api_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
  label: text("label").notNull(),
  userId: text("user_id").notNull(),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").notNull(),
});

export type LinkRecord = typeof links.$inferSelect;
export type NewLinkRecord = typeof links.$inferInsert;
export type ClickRecord = typeof clicks.$inferSelect;
export type ApiKeyRecord = typeof apiKeys.$inferSelect;
