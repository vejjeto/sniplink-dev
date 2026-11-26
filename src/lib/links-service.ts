import type { AppDatabase } from "@/db";
import { type LinkRecord, apiKeys, clicks, links } from "@/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { extractBearerKey, hashApiKey } from "./api-keys";
import { type QrAssets, generateQrAssets } from "./qr";
import { createSlugWithRetry } from "./slug";
import { type ExpirationReason, computeExpiresAt, isLinkExpired } from "./ttl";
import { normalizeAndValidateUrl } from "./url-security";

export interface CreateLinkInput {
  url: string;
  customAlias?: string | undefined;
  ttl?: string | undefined;
  maxClicks?: number | null | undefined;
  userId?: string | null | undefined;
  title?: string | null | undefined;
}

export interface LinkWithStatus extends LinkRecord {
  expired: boolean;
  expirationReason: ExpirationReason;
}

export interface DailyClickPoint {
  date: string;
  clicks: number;
}

export interface BreakdownItem {
  label: string;
  count: number;
  percentage: number;
}

export interface LinkStatsPayload {
  link: LinkWithStatus;
  shortUrl: string;
  dailyHistogram: DailyClickPoint[];
  devices: BreakdownItem[];
  browsers: BreakdownItem[];
  countries: BreakdownItem[];
  recentClicks: Array<{
    id: number;
    referrer: string | null;
    deviceType: string;
    browser: string;
    country: string;
    createdAt: string;
  }>;
  qr: QrAssets;
}

export class InvalidUrlInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUrlInputError";
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes("unique") || msg.includes("constraint");
}

function enrichLinkStatus(link: LinkRecord, now = new Date()): LinkWithStatus {
  const status = isLinkExpired(link, now);
  return {
    ...link,
    expired: status.expired,
    expirationReason: status.reason,
  };
}

function buildBreakdown(
  counts: Map<string, number>,
  total: number,
): BreakdownItem[] {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, itemCount]) => ({
      label,
      count: itemCount,
      percentage: total > 0 ? Math.round((itemCount / total) * 100) : 0,
    }));
}

function buildFourteenDayHistogram(
  clickRows: Array<{ createdAt: string }>,
  now = new Date(),
): DailyClickPoint[] {
  const dayBuckets = new Map<string, number>();
  for (let offset = 13; offset >= 0; offset -= 1) {
    const d = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
    dayBuckets.set(d.toISOString().slice(0, 10), 0);
  }

  for (const row of clickRows) {
    const dateKey = row.createdAt.slice(0, 10);
    if (dayBuckets.has(dateKey)) {
      dayBuckets.set(dateKey, (dayBuckets.get(dateKey) ?? 0) + 1);
    }
  }

  return Array.from(dayBuckets.entries()).map(([date, dayClicks]) => ({
    date,
    clicks: dayClicks,
  }));
}

/** Resolve userId from an Authorization Bearer API key when valid and unexpired. */
export async function resolveUserIdFromApiKey(
  db: AppDatabase,
  authHeader: string | null,
): Promise<{ valid: boolean; userId: string | null }> {
  const token = extractBearerKey(authHeader);
  if (!token) {
    return { valid: false, userId: null };
  }

  const keyHash = hashApiKey(token);
  const [record] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!record) {
    return { valid: false, userId: null };
  }

  if (record.expiresAt && Date.parse(record.expiresAt) <= Date.now()) {
    return { valid: false, userId: null };
  }

  return { valid: true, userId: record.userId };
}

/** Create a shortened link or deduplicate an anonymous standard URL. */
export async function createShortLink(
  db: AppDatabase,
  input: CreateLinkInput,
): Promise<{ link: LinkWithStatus; deduplicated: boolean }> {
  const urlCheck = normalizeAndValidateUrl(input.url);
  if (!urlCheck.ok) {
    throw new InvalidUrlInputError(urlCheck.error);
  }

  const normalizedUrl = urlCheck.url;
  let expiresAt: string | null;
  try {
    expiresAt = computeExpiresAt(input.ttl);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Invalid TTL value provided.";
    throw new InvalidUrlInputError(message);
  }

  const maxClicks = input.maxClicks ?? null;
  const userId = input.userId?.trim() || null;
  const customAlias = input.customAlias?.trim() || undefined;
  const isAnonymousStandard =
    userId === null &&
    customAlias === undefined &&
    expiresAt === null &&
    maxClicks === null;

  if (isAnonymousStandard) {
    const [existing] = await db
      .select()
      .from(links)
      .where(
        and(
          eq(links.originalUrl, normalizedUrl),
          isNull(links.userId),
          eq(links.isActive, true),
          isNull(links.expiresAt),
          isNull(links.maxClicks),
        ),
      )
      .limit(1);

    if (existing) {
      return { link: enrichLinkStatus(existing), deduplicated: true };
    }
  }

  const nowIso = new Date().toISOString();
  let insertedRecord: LinkRecord | undefined;

  await createSlugWithRetry(async (candidateSlug) => {
    try {
      const [row] = await db
        .insert(links)
        .values({
          slug: candidateSlug,
          originalUrl: normalizedUrl,
          title: input.title?.trim() || new URL(normalizedUrl).hostname,
          expiresAt,
          maxClicks,
          clickCount: 0,
          isActive: true,
          userId,
          createdAt: nowIso,
        })
        .returning();
      insertedRecord = row;
      return true;
    } catch (err: unknown) {
      if (isUniqueConstraintError(err)) {
        return false;
      }
      throw err;
    }
  }, customAlias);

  if (!insertedRecord) {
    throw new Error("Failed to persist shortened link.");
  }

  return { link: enrichLinkStatus(insertedRecord), deduplicated: false };
}

/** List links with computed expiration status and optional filters. */
export async function listLinksWithStatus(
  db: AppDatabase,
  options: {
    userId?: string | null;
    status?: "all" | "active" | "expired";
    query?: string | null;
  } = {},
): Promise<{
  links: LinkWithStatus[];
  summary: {
    total: number;
    active: number;
    expired: number;
    totalClicks: number;
  };
}> {
  const rows = options.userId
    ? await db
        .select()
        .from(links)
        .where(eq(links.userId, options.userId))
        .orderBy(desc(links.createdAt))
    : await db.select().from(links).orderBy(desc(links.createdAt));

  const now = new Date();
  const enriched = rows.map((row) => enrichLinkStatus(row, now));
  const summary = {
    total: enriched.length,
    active: enriched.filter((l) => !l.expired).length,
    expired: enriched.filter((l) => l.expired).length,
    totalClicks: enriched.reduce((sum, l) => sum + l.clickCount, 0),
  };

  const search = options.query?.trim().toLowerCase() ?? "";
  const statusFilter = options.status ?? "all";
  const filtered = enriched.filter((item) => {
    if (statusFilter === "active" && item.expired) return false;
    if (statusFilter === "expired" && !item.expired) return false;
    if (!search) return true;
    return (
      item.slug.toLowerCase().includes(search) ||
      item.originalUrl.toLowerCase().includes(search) ||
      (item.title ?? "").toLowerCase().includes(search)
    );
  });

  return { links: filtered, summary };
}

/** Aggregate 14-day click telemetry and QR assets for a single link slug. */
export async function getLinkStats(
  db: AppDatabase,
  slug: string,
  origin: string,
): Promise<LinkStatsPayload | null> {
  const [link] = await db
    .select()
    .from(links)
    .where(eq(links.slug, slug))
    .limit(1);

  if (!link) return null;

  const clickRows = await db
    .select()
    .from(clicks)
    .where(eq(clicks.linkId, link.id))
    .orderBy(desc(clicks.createdAt));

  const deviceCounts = new Map<string, number>();
  const browserCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();

  for (const row of clickRows) {
    deviceCounts.set(
      row.deviceType,
      (deviceCounts.get(row.deviceType) ?? 0) + 1,
    );
    browserCounts.set(row.browser, (browserCounts.get(row.browser) ?? 0) + 1);
    countryCounts.set(row.country, (countryCounts.get(row.country) ?? 0) + 1);
  }

  const shortUrl = `${origin}/${link.slug}`;
  const qr = await generateQrAssets(shortUrl);

  return {
    link: enrichLinkStatus(link),
    shortUrl,
    dailyHistogram: buildFourteenDayHistogram(clickRows),
    devices: buildBreakdown(deviceCounts, clickRows.length),
    browsers: buildBreakdown(browserCounts, clickRows.length),
    countries: buildBreakdown(countryCounts, clickRows.length),
    recentClicks: clickRows.slice(0, 15).map((row) => ({
      id: row.id,
      referrer: row.referrer,
      deviceType: row.deviceType,
      browser: row.browser,
      country: row.country,
      createdAt: row.createdAt,
    })),
    qr,
  };
}

/** Deactivate or purge expired links and return affected summary counts. */
export async function cleanupExpiredLinks(
  db: AppDatabase,
  purge = false,
): Promise<{
  deactivatedCount: number;
  deletedCount: number;
  totalAffected: number;
  cleanedSlugs: string[];
}> {
  const allLinks = await db.select().from(links);
  const now = new Date();
  const cleanedSlugs: string[] = [];
  let deactivatedCount = 0;
  let deletedCount = 0;

  for (const link of allLinks) {
    const status = isLinkExpired(link, now);
    if (!status.expired) continue;

    if (purge) {
      await db.delete(links).where(eq(links.id, link.id));
      deletedCount += 1;
      cleanedSlugs.push(link.slug);
    } else if (link.isActive) {
      await db
        .update(links)
        .set({ isActive: false })
        .where(eq(links.id, link.id));
      deactivatedCount += 1;
      cleanedSlugs.push(link.slug);
    }
  }

  return {
    deactivatedCount,
    deletedCount,
    totalAffected: deactivatedCount + deletedCount,
    cleanedSlugs,
  };
}

/** Persist a click event and atomically increment the parent link's click count. */
export async function recordClickAndIncrement(
  db: AppDatabase,
  linkId: number,
  meta: {
    referrer: string | null;
    deviceType: string;
    browser: string;
    country: string;
  },
): Promise<void> {
  await db.insert(clicks).values({
    linkId,
    referrer: meta.referrer,
    deviceType: meta.deviceType,
    browser: meta.browser,
    country: meta.country,
    createdAt: new Date().toISOString(),
  });

  await db
    .update(links)
    .set({ clickCount: sql`${links.clickCount} + 1` })
    .where(eq(links.id, linkId));
}
