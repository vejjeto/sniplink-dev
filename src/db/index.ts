import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { type SqliteRemoteDatabase, drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";
import { seedDatabase } from "./seed-data";

export type AppDatabase = SqliteRemoteDatabase<typeof schema>;

interface CachedConnection {
  location: string;
  sqlite: DatabaseSync;
  db: AppDatabase;
  initPromise: Promise<void> | null;
}

const globalForDb = globalThis as unknown as {
  __sniplinkDbCache?: CachedConnection | undefined;
};

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  original_url TEXT NOT NULL,
  title TEXT,
  expires_at TEXT,
  max_clicks INTEGER,
  click_count INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  user_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_links_original_url ON links (original_url);
CREATE INDEX IF NOT EXISTS idx_links_user_id ON links (user_id);

CREATE TABLE IF NOT EXISTS clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  referrer TEXT,
  device_type TEXT NOT NULL,
  browser TEXT NOT NULL,
  country TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clicks_link_id ON clicks (link_id);
CREATE INDEX IF NOT EXISTS idx_clicks_created_at ON clicks (created_at);

CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  label TEXT NOT NULL,
  user_id TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL
);
`;

/** Resolve the SQLite database location from DATABASE_URL or default data/app.db. */
export function resolveDbLocation(): string {
  const envUrl = process.env.DATABASE_URL?.trim();
  if (!envUrl || envUrl.startsWith("postgres")) {
    return path.resolve(process.cwd(), "data/app.db");
  }
  if (envUrl === ":memory:" || envUrl === "file::memory:") {
    return ":memory:";
  }
  const stripped = envUrl.startsWith("file:") ? envUrl.slice(5) : envUrl;
  return path.isAbsolute(stripped)
    ? stripped
    : path.resolve(process.cwd(), stripped);
}

/** Create a Drizzle sqlite-proxy instance bound to a DatabaseSync handle. */
export function createSqliteConnection(location: string): {
  sqlite: DatabaseSync;
  db: AppDatabase;
} {
  if (location !== ":memory:") {
    fs.mkdirSync(path.dirname(location), { recursive: true });
  }

  const sqlite = new DatabaseSync(location);
  sqlite.exec("PRAGMA foreign_keys = ON;");
  if (location !== ":memory:") {
    sqlite.exec("PRAGMA journal_mode = WAL;");
  }

  const db = drizzle(
    async (sql, params, method) => {
      const stmt = sqlite.prepare(sql);
      const bound = params as SQLInputValue[];

      if (method === "run") {
        stmt.run(...bound);
        return { rows: [] };
      }

      stmt.setReturnArrays(true);
      if (method === "get") {
        const row = stmt.get(...bound);
        return { rows: (row ?? undefined) as unknown as unknown[] };
      }

      const rows = stmt.all(...bound) as unknown as unknown[][];
      return { rows };
    },
    { schema },
  );

  return { sqlite, db };
}

/** Apply DDL statements idempotently onto an open SQLite database. */
export function createTables(sqlite: DatabaseSync): void {
  sqlite.exec(SCHEMA_SQL);
}

function getOrCreateCache(): CachedConnection {
  const location = resolveDbLocation();
  const cached = globalForDb.__sniplinkDbCache;
  if (cached && cached.location === location) {
    return cached;
  }
  if (cached) {
    cached.sqlite.close();
  }
  const { sqlite, db } = createSqliteConnection(location);
  const next: CachedConnection = { location, sqlite, db, initPromise: null };
  globalForDb.__sniplinkDbCache = next;
  return next;
}

/** Ensure schema tables exist and initial demo data is seeded once per DB. */
export async function ensureInitialized(
  options: { seed?: boolean } = { seed: true },
): Promise<AppDatabase> {
  const conn = getOrCreateCache();
  if (!conn.initPromise) {
    conn.initPromise = (async () => {
      createTables(conn.sqlite);
      if (options.seed !== false) {
        await seedDatabase(conn.db);
      }
    })();
  }
  await conn.initPromise;
  return conn.db;
}

/** Reset cached database connection (used in automated tests). */
export function resetDbCache(): void {
  const cached = globalForDb.__sniplinkDbCache;
  if (cached) {
    cached.sqlite.close();
    globalForDb.__sniplinkDbCache = undefined;
  }
}
