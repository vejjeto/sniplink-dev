import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const linksPg = pgTable(
  "links",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    originalUrl: text("original_url").notNull(),
    title: text("title"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    maxClicks: integer("max_clicks"),
    clickCount: integer("click_count").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    userId: text("user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_pg_links_original_url").on(table.originalUrl),
    index("idx_pg_links_user_id").on(table.userId),
  ],
);

export const clicksPg = pgTable(
  "clicks",
  {
    id: serial("id").primaryKey(),
    linkId: integer("link_id")
      .notNull()
      .references(() => linksPg.id, { onDelete: "cascade" }),
    referrer: text("referrer"),
    deviceType: text("device_type").notNull(),
    browser: text("browser").notNull(),
    country: text("country").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_pg_clicks_link_id").on(table.linkId),
    index("idx_pg_clicks_created_at").on(table.createdAt),
  ],
);

export const apiKeysPg = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
  label: text("label").notNull(),
  userId: text("user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
