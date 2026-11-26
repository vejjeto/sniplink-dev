import { GET as redirectHandler } from "@/app/[slug]/route";
import { GET as docsHtmlHandler } from "@/app/api/docs/route";
import { GET as healthHandler } from "@/app/api/health/route";
import { GET as linkStatsHandler } from "@/app/api/links/[slug]/stats/route";
import { POST as createLinkHandler } from "@/app/api/links/route";
import { GET as ogPreviewHandler } from "@/app/api/og-preview/route";
import { GET as openApiHandler } from "@/app/api/openapi.json/route";
import { ensureInitialized, resetDbCache } from "@/db";
import { apiKeys } from "@/db/schema";
import { extractBearerKey, generateApiKey, hashApiKey } from "@/lib/api-keys";
import { getEnv, resetEnvCache } from "@/lib/env";
import {
  cleanupExpiredLinks,
  createShortLink,
  getLinkStats,
  resolveUserIdFromApiKey,
} from "@/lib/links-service";
import { checkRateLimit, clearRateLimits } from "@/lib/rate-limit";
import {
  SlugConflictError,
  createSlugWithRetry,
  generateSlug,
  validateCustomAlias,
} from "@/lib/slug";
import { computeExpiresAt, isLinkExpired } from "@/lib/ttl";
import { normalizeAndValidateUrl } from "@/lib/url-security";
import { parseCountry, parseUserAgent } from "@/lib/user-agent";
import { signHmacSha256, verifyHmacSha256 } from "@/lib/webhooks";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  service: z.string(),
  dbLatencyMs: z.number().nonnegative(),
  uptimeSeconds: z.number().nonnegative(),
  version: z.string(),
  timestamp: z.string(),
});

describe("SnipLink Dev — Core Domain & Integration Suite", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = ":memory:";
    resetDbCache();
    resetEnvCache();
    clearRateLimits();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.WEBHOOK_URL = undefined;
    process.env.WEBHOOK_SECRET = undefined;
  });

  it("1. generates 7-char Base62 slugs and enforces 5-attempt collision retry", async () => {
    const slug = generateSlug(7);
    expect(slug).toHaveLength(7);
    expect(slug).toMatch(/^[0-9A-Za-z]{7}$/);

    let calls = 0;
    const allocated = await createSlugWithRetry(async () => {
      calls += 1;
      return calls === 5;
    });
    expect(calls).toBe(5);
    expect(allocated).toMatch(/^[0-9A-Za-z]{7}$/);

    await expect(
      createSlugWithRetry(async () => false, undefined, 5),
    ).rejects.toBeInstanceOf(SlugConflictError);
  });

  it("2. validates custom aliases against regex and reserved routes", () => {
    expect(validateCustomAlias("launch-2026_v1")).toEqual({
      valid: true,
      slug: "launch-2026_v1",
    });

    for (const reserved of [
      "api",
      "Dashboard",
      "demo",
      "login",
      "docs",
      "expired",
      "admin",
      "_next",
      "health",
    ]) {
      const check = validateCustomAlias(reserved);
      expect(check.valid).toBe(false);
    }

    expect(validateCustomAlias("ab").valid).toBe(false);
    expect(validateCustomAlias("bad slug!").valid).toBe(false);
  });

  it("3. blocks unsafe schemes and SSRF private/loopback hosts", () => {
    const blocked = [
      "javascript:alert(1)",
      "data:text/html,<h1>x</h1>",
      "file:///etc/passwd",
      "http://localhost:3001/admin",
      "http://127.0.0.1:8080",
      "http://10.0.0.42/internal",
      "http://192.168.1.10",
      "http://172.16.5.4",
      "http://172.31.255.254",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]:3000",
      "http://0.0.0.0:3001",
    ];

    for (const candidate of blocked) {
      expect(normalizeAndValidateUrl(candidate).ok).toBe(false);
    }

    const valid = normalizeAndValidateUrl("  https://nextjs.org/docs  ");
    expect(valid).toEqual({ ok: true, url: "https://nextjs.org/docs" });
  });

  it("4. enforces TTL & maxClicks expiration and returns 302 or 410 Gone on redirect", async () => {
    const fixedNow = new Date("2026-01-10T00:00:00.000Z");
    const expires24h = computeExpiresAt("24h", fixedNow);
    expect(expires24h).toBe("2026-01-11T00:00:00.000Z");

    expect(
      isLinkExpired(
        {
          expiresAt: "2026-01-09T23:59:59.000Z",
          maxClicks: null,
          clickCount: 0,
          isActive: true,
        },
        fixedNow,
      ),
    ).toEqual({ expired: true, reason: "ttl" });

    expect(
      isLinkExpired(
        {
          expiresAt: null,
          maxClicks: 5,
          clickCount: 5,
          isActive: true,
        },
        fixedNow,
      ),
    ).toEqual({ expired: true, reason: "max_clicks" });

    await ensureInitialized();

    const activeReq = new NextRequest("http://localhost:3001/nextjs-15", {
      headers: { "user-agent": "Mozilla/5.0 Chrome/120.0.0.0" },
    });
    const activeRes = await redirectHandler(activeReq, {
      params: Promise.resolve({ slug: "nextjs-15" }),
    });
    expect(activeRes.status).toBe(302);
    expect(activeRes.headers.get("location")).toBe("https://nextjs.org/docs");
    expect(activeRes.headers.get("cache-control")).toBe("no-store");

    const expiredReq = new NextRequest("http://localhost:3001/legacy-docs-v1", {
      headers: { accept: "application/json" },
    });
    const expiredRes = await redirectHandler(expiredReq, {
      params: Promise.resolve({ slug: "legacy-docs-v1" }),
    });
    expect(expiredRes.status).toBe(410);
    const expiredBody = (await expiredRes.json()) as { reason: string };
    expect(expiredBody.reason).toBe("ttl");
  });

  it("5. deduplicates anonymous standard links while keeping campaign slugs distinct", async () => {
    const db = await ensureInitialized();

    const firstAnon = await createShortLink(db, {
      url: "https://orm.drizzle.team/docs/sql",
    });
    const secondAnon = await createShortLink(db, {
      url: "https://orm.drizzle.team/docs/sql",
    });

    expect(firstAnon.deduplicated).toBe(false);
    expect(secondAnon.deduplicated).toBe(true);
    expect(secondAnon.link.slug).toBe(firstAnon.link.slug);

    const campaignOne = await createShortLink(db, {
      url: "https://orm.drizzle.team/docs/sql",
      userId: "dev-team",
    });
    const campaignTwo = await createShortLink(db, {
      url: "https://orm.drizzle.team/docs/sql",
      userId: "dev-team",
    });

    expect(campaignOne.deduplicated).toBe(false);
    expect(campaignTwo.deduplicated).toBe(false);
    expect(campaignOne.link.slug).not.toBe(campaignTwo.link.slug);

    const stats = await getLinkStats(
      db,
      campaignOne.link.slug,
      "http://localhost:3001",
    );
    expect(stats?.qr.svg).toContain("<svg");
    expect(stats?.qr.pngDataUrl).toMatch(/^data:image\/png;base64,/);

    const cleanup = await cleanupExpiredLinks(db, false);
    expect(cleanup.deactivatedCount).toBe(1);
    expect(cleanup.cleanedSlugs).toContain("legacy-docs-v1");
  });

  it("6. enforces sliding-window IP rate limit and recovers after window elapses", () => {
    const baseTime = 1_700_000_000_000;
    expect(checkRateLimit("10.1.1.1", 2, 10_000, baseTime).allowed).toBe(true);
    expect(checkRateLimit("10.1.1.1", 2, 10_000, baseTime + 100).allowed).toBe(
      true,
    );

    const blocked = checkRateLimit("10.1.1.1", 2, 10_000, baseTime + 200);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);

    const recovered = checkRateLimit("10.1.1.1", 2, 10_000, baseTime + 10_001);
    expect(recovered.allowed).toBe(true);
  });

  it("7. parses User-Agent devices/browsers and country headers accurately", () => {
    expect(
      parseUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toEqual({ deviceType: "Mobile", browser: "Safari" });

    expect(
      parseUserAgent(
        "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/121.0 Mobile/15E148 Safari/604.1",
      ),
    ).toEqual({ deviceType: "Tablet", browser: "Chrome" });

    expect(
      parseUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/122.0.0.0",
      ),
    ).toEqual({ deviceType: "Desktop", browser: "Edge" });

    expect(parseUserAgent("curl/8.5.0")).toEqual({
      deviceType: "Bot",
      browser: "Other",
    });

    expect(
      parseCountry({ cfIpCountry: "mx", acceptLanguage: "en-US,en;q=0.9" }),
    ).toBe("MX");
    expect(parseCountry({ acceptLanguage: "es-ES,es;q=0.8" })).toBe("ES");
  });

  it("8. generates slk_live_ API keys, hashes with SHA-256, and authenticates Bearer headers", async () => {
    const db = await ensureInitialized();
    const generated = generateApiKey();
    expect(generated.plaintext).toMatch(/^slk_live_[0-9a-f]{24}$/);
    expect(generated.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey(generated.plaintext)).toBe(generated.keyHash);

    await db.insert(apiKeys).values({
      keyHash: generated.keyHash,
      keyPrefix: generated.keyPrefix,
      label: "Vitest Key",
      userId: "ci-runner",
      expiresAt: null,
      createdAt: new Date().toISOString(),
    });

    expect(extractBearerKey(`Bearer ${generated.plaintext}`)).toBe(
      generated.plaintext,
    );

    const authOk = await resolveUserIdFromApiKey(
      db,
      `Bearer ${generated.plaintext}`,
    );
    expect(authOk).toEqual({ valid: true, userId: "ci-runner" });

    const authBad = await resolveUserIdFromApiKey(
      db,
      "Bearer slk_live_invalid",
    );
    expect(authBad).toEqual({ valid: false, userId: null });
  });

  it("9. /api/health returns 200, x-request-id header, and validates against HealthResponseSchema", async () => {
    const req = new NextRequest("http://localhost:3001/api/health", {
      headers: { "x-request-id": "health-req-123" },
    });
    const res = await healthHandler(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBe("health-req-123");
    const json: unknown = await res.json();
    const parsed = HealthResponseSchema.safeParse(json);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.status).toBe("ok");
      expect(parsed.data.service).toBe("sniplink-dev");
      expect(parsed.data.dbLatencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("10. /api/openapi.json and /api/docs expose valid OpenAPI 3.1.0 spec for all routes", async () => {
    const req = new NextRequest("http://localhost:3001/api/openapi.json");
    const specRes = await openApiHandler(req);
    expect(specRes.status).toBe(200);
    const spec = (await specRes.json()) as {
      openapi: string;
      info: { title: string };
      paths: Record<string, Record<string, unknown>>;
    };
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toBe("SnipLink Dev API");
    for (const expectedPath of [
      "/api/links",
      "/api/links/{slug}/stats",
      "/api/links/cleanup",
      "/api/og-preview",
      "/api/keys",
      "/api/health",
    ]) {
      expect(spec.paths[expectedPath]).toBeDefined();
    }

    const docsReq = new NextRequest("http://localhost:3001/api/docs");
    const docsRes = await docsHtmlHandler(docsReq);
    expect(docsRes.status).toBe(200);
    expect(docsRes.headers.get("content-type")).toContain("text/html");
    const html = await docsRes.text();
    expect(html).toContain("/api/openapi.json");
    expect(html).toContain("SnipLink Dev API");
  });

  it("11. signs HMAC-SHA256 webhooks and emits non-blocking link.created event when WEBHOOK_URL is set", async () => {
    const secret = "test-webhook-secret";
    const sampleBody = JSON.stringify({
      event: "link.created",
      slug: "demo123",
    });
    const sig = signHmacSha256(sampleBody, secret);
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(verifyHmacSha256(sampleBody, sig, secret)).toBe(true);
    expect(verifyHmacSha256(sampleBody, sig, "wrong-secret")).toBe(false);

    process.env.WEBHOOK_URL = "http://localhost:3009/api/hook/ecosystem-bin";
    process.env.WEBHOOK_SECRET = secret;

    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody = "";

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        capturedUrl = typeof input === "string" ? input : input.toString();
        capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
        capturedBody = typeof init?.body === "string" ? init.body : "";
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      });

    const postReq = new NextRequest("http://localhost:3001/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://vitest.dev/guide/",
        ttl: "24h",
      }),
    });

    const postRes = await createLinkHandler(postReq);
    expect(postRes.status).toBe(201);

    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    expect(capturedUrl).toBe("http://localhost:3009/api/hook/ecosystem-bin");
    expect(capturedHeaders["X-Webhook-Event"]).toBe("link.created");
    expect(capturedHeaders["X-Webhook-Source"]).toBe("sniplink-dev");
    expect(
      verifyHmacSha256(
        capturedBody,
        capturedHeaders["X-Portfolio-Signature"],
        secret,
      ),
    ).toBe(true);
  });

  it("12. returns RFC 7807 application/problem+json with x-request-id on API errors", async () => {
    const badOgReq = new NextRequest(
      "http://localhost:3001/api/og-preview?url=http://127.0.0.1:8080",
      { headers: { "x-request-id": "og-req-42" } },
    );
    const badOgRes = await ogPreviewHandler(badOgReq);
    expect(badOgRes.status).toBe(400);
    expect(badOgRes.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(badOgRes.headers.get("x-request-id")).toBe("og-req-42");
    const ogBody = (await badOgRes.json()) as {
      status: number;
      title: string;
      detail: string;
      requestId: string;
    };
    expect(ogBody.status).toBe(400);
    expect(ogBody.requestId).toBe("og-req-42");

    const missingStatsReq = new NextRequest(
      "http://localhost:3001/api/links/missing-slug/stats",
    );
    const missingStatsRes = await linkStatsHandler(missingStatsReq, {
      params: Promise.resolve({ slug: "missing-slug" }),
    });
    expect(missingStatsRes.status).toBe(404);
    expect(missingStatsRes.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(missingStatsRes.headers.get("x-request-id")).toBeTruthy();
  });

  it("13. validates environment variables with Zod and honors SKIP_ENV_VALIDATION=true", () => {
    const valid = getEnv({
      DATABASE_URL: ":memory:",
      RATE_LIMIT_MAX: "50",
    });
    expect(valid.RATE_LIMIT_MAX).toBe(50);

    expect(() =>
      getEnv({
        POSTGRES_URL: "not-a-valid-url",
      }),
    ).toThrow(/Invalid environment configuration/);

    const skipped = getEnv({
      SKIP_ENV_VALIDATION: "true",
      POSTGRES_URL: "not-a-valid-url",
    });
    expect(skipped.POSTGRES_URL).toBe("not-a-valid-url");
  });
});
