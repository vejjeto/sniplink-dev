import { hashApiKey } from "@/lib/api-keys";
import { count, eq } from "drizzle-orm";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import type * as schema from "./schema";
import { apiKeys, clicks, links } from "./schema";

type DbInstance = SqliteRemoteDatabase<typeof schema>;

interface SeedLinkSpec {
  slug: string;
  originalUrl: string;
  title: string;
  expiresOffsetDays: number | null;
  maxClicks: number | null;
  isActive: boolean;
  userId: string | null;
  targetClicks: number;
}

const DEMO_LINKS: SeedLinkSpec[] = [
  {
    slug: "nextjs-15",
    originalUrl: "https://nextjs.org/docs",
    title: "Next.js 15 App Router Documentation",
    expiresOffsetDays: 30,
    maxClicks: null,
    isActive: true,
    userId: null,
    targetClicks: 38,
  },
  {
    slug: "drizzle-orm",
    originalUrl: "https://orm.drizzle.team/docs/overview",
    title: "Drizzle ORM — TypeScript SQL ORM",
    expiresOffsetDays: 30,
    maxClicks: null,
    isActive: true,
    userId: null,
    targetClicks: 29,
  },
  {
    slug: "zod-docs",
    originalUrl: "https://zod.dev",
    title: "Zod — TypeScript-first Schema Validation",
    expiresOffsetDays: 14,
    maxClicks: null,
    isActive: true,
    userId: null,
    targetClicks: 24,
  },
  {
    slug: "ts-handbook",
    originalUrl: "https://www.typescriptlang.org/docs/handbook/intro.html",
    title: "The TypeScript Handbook",
    expiresOffsetDays: null,
    maxClicks: null,
    isActive: true,
    userId: null,
    targetClicks: 22,
  },
  {
    slug: "tailwind-v4",
    originalUrl: "https://tailwindcss.com/docs",
    title: "Tailwind CSS Documentation",
    expiresOffsetDays: 7,
    maxClicks: null,
    isActive: true,
    userId: "dev-team",
    targetClicks: 21,
  },
  {
    slug: "vitest-guide",
    originalUrl: "https://vitest.dev/guide/",
    title: "Vitest — Blazing Fast Unit Test Framework",
    expiresOffsetDays: 30,
    maxClicks: 500,
    isActive: true,
    userId: "dev-team",
    targetClicks: 19,
  },
  {
    slug: "demo-qr",
    originalUrl: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/302",
    title: "HTTP 302 Found Redirect Specification (MDN)",
    expiresOffsetDays: 7,
    maxClicks: null,
    isActive: true,
    userId: "dev-team",
    targetClicks: 17,
  },
  {
    slug: "legacy-docs-v1",
    originalUrl: "https://legacy.sniplink.example.com/v1/docs",
    title: "Legacy API Docs v1 (Expired TTL Demo)",
    expiresOffsetDays: -3,
    maxClicks: null,
    isActive: true,
    userId: "dev-team",
    targetClicks: 10,
  },
];

const DEVICES = ["Desktop", "Desktop", "Desktop", "Mobile", "Mobile", "Tablet"];
const BROWSERS = ["Chrome", "Chrome", "Firefox", "Safari", "Edge"];
const COUNTRIES = ["US", "ES", "MX", "DE", "GB", "CA", "BR", "JP"];
const REFERRERS = [
  "https://github.com/dev-team/sniplink",
  "https://news.ycombinator.com",
  "https://x.com",
  "https://docs.internal.dev",
  null,
];

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SeedResult {
  seeded: boolean;
  linksInserted: number;
  clicksInserted: number;
}

/** Populate idempotent demo links, ~180 historical clicks, and a sample API key. */
export async function seedDatabase(db: DbInstance): Promise<SeedResult> {
  const [existing] = await db.select({ total: count() }).from(links);
  if ((existing?.total ?? 0) > 0) {
    return { seeded: false, linksInserted: 0, clicksInserted: 0 };
  }

  const now = Date.now();
  let linksInserted = 0;
  let clicksInserted = 0;

  for (let idx = 0; idx < DEMO_LINKS.length; idx += 1) {
    const spec = DEMO_LINKS[idx]!;
    const createdAt = new Date(now - (14 - idx) * DAY_MS).toISOString();
    const expiresAt =
      spec.expiresOffsetDays !== null
        ? new Date(now + spec.expiresOffsetDays * DAY_MS).toISOString()
        : null;

    const [inserted] = await db
      .insert(links)
      .values({
        slug: spec.slug,
        originalUrl: spec.originalUrl,
        title: spec.title,
        expiresAt,
        maxClicks: spec.maxClicks,
        clickCount: spec.targetClicks,
        isActive: spec.isActive,
        userId: spec.userId,
        createdAt,
      })
      .returning({ id: links.id });

    if (!inserted) continue;
    linksInserted += 1;

    const clickRows = Array.from({ length: spec.targetClicks }, (_, c) => {
      const daysAgo = (c * 3 + idx) % 14;
      const hoursOffset = ((c * 7 + idx * 5) % 23) * 60 * 60 * 1000;
      const clickTime = new Date(
        now - daysAgo * DAY_MS - hoursOffset,
      ).toISOString();

      return {
        linkId: inserted.id,
        referrer: REFERRERS[(c + idx) % REFERRERS.length] ?? null,
        deviceType: DEVICES[(c + idx) % DEVICES.length] ?? "Desktop",
        browser: BROWSERS[(c * 2 + idx) % BROWSERS.length] ?? "Chrome",
        country: COUNTRIES[(c + idx * 3) % COUNTRIES.length] ?? "US",
        createdAt: clickTime,
      };
    });

    if (clickRows.length > 0) {
      await db.insert(clicks).values(clickRows);
      clicksInserted += clickRows.length;
    }
  }

  const demoPlainKey = "slk_live_demo00000000000000000001";
  const [existingKey] = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hashApiKey(demoPlainKey)))
    .limit(1);

  if (!existingKey) {
    await db.insert(apiKeys).values({
      keyHash: hashApiKey(demoPlainKey),
      keyPrefix: demoPlainKey.slice(0, 16),
      label: "Demo Dev Workspace",
      userId: "dev-team",
      expiresAt: new Date(now + 90 * DAY_MS).toISOString(),
      createdAt: new Date(now).toISOString(),
    });
  }

  return { seeded: true, linksInserted, clicksInserted };
}
