import { ensureInitialized } from "@/db";
import { env } from "@/lib/env";
import {
  InvalidUrlInputError,
  createShortLink,
  listLinksWithStatus,
  resolveUserIdFromApiKey,
} from "@/lib/links-service";
import { createRequestLogger } from "@/lib/logger";
import {
  jsonWithRequestId,
  problemResponse,
  resolveRequestId,
} from "@/lib/problem-details";
import { checkRateLimit } from "@/lib/rate-limit";
import { SlugConflictError, SlugValidationError } from "@/lib/slug";
import { emitSignedWebhook } from "@/lib/webhooks";
import type { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createLinkSchema = z.object({
  url: z.string().min(1, "URL is required"),
  customAlias: z.string().optional(),
  ttl: z.string().optional(),
  maxClicks: z.number().int().positive().max(1_000_000).nullable().optional(),
  userId: z.string().max(64).nullable().optional(),
  title: z.string().max(200).nullable().optional(),
});

function getRequestOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") ?? "http";
    return `${proto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "127.0.0.1";
  }
  return request.headers.get("x-real-ip")?.trim() || "127.0.0.1";
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = resolveRequestId(request.headers);
  const log = createRequestLogger(requestId);
  try {
    const db = await ensureInitialized();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const rawStatus = searchParams.get("status");
    const status =
      rawStatus === "active" || rawStatus === "expired" ? rawStatus : "all";
    const query = searchParams.get("q");

    const data = await listLinksWithStatus(db, { userId, status, query });
    return jsonWithRequestId(data, requestId, { status: 200 });
  } catch (err: unknown) {
    log.error({ err }, "[GET /api/links] Failed to load links");
    return problemResponse({
      status: 500,
      detail: "Failed to load links.",
      requestId,
    });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = resolveRequestId(request.headers);
  const log = createRequestLogger(requestId);
  const ip = getClientIp(request);
  const limitMax = env.RATE_LIMIT_MAX ?? 40;
  const limitResult = checkRateLimit(`links:${ip}`, limitMax, 60_000);

  if (!limitResult.allowed) {
    const retryAfter = Math.max(
      1,
      Math.ceil((limitResult.resetAt - Date.now()) / 1000),
    );
    return problemResponse({
      status: 429,
      detail: "Rate limit exceeded. Try again shortly.",
      requestId,
      headers: { "Retry-After": String(retryAfter) },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problemResponse({
      status: 400,
      detail: "Invalid JSON body.",
      requestId,
    });
  }

  const parsed = createLinkSchema.safeParse(body);
  if (!parsed.success) {
    return problemResponse({
      status: 400,
      detail: parsed.error.issues[0]?.message ?? "Invalid request payload.",
      requestId,
      errors: parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "body",
        message: issue.message,
      })),
    });
  }

  try {
    const db = await ensureInitialized();
    const authHeader = request.headers.get("authorization");
    let effectiveUserId = parsed.data.userId ?? null;

    if (authHeader) {
      const keyResult = await resolveUserIdFromApiKey(db, authHeader);
      if (!keyResult.valid) {
        return problemResponse({
          status: 401,
          detail: "Invalid or expired API key.",
          requestId,
        });
      }
      effectiveUserId = keyResult.userId;
    }

    const result = await createShortLink(db, {
      ...parsed.data,
      userId: effectiveUserId,
    });
    const origin = getRequestOrigin(request);

    if (!result.deduplicated && process.env.WEBHOOK_URL) {
      void emitSignedWebhook({
        event: "link.created",
        source: "sniplink-dev",
        data: {
          slug: result.link.slug,
          originalUrl: result.link.originalUrl,
          expiresAt: result.link.expiresAt,
        },
      }).catch((err: unknown) => {
        log.warn({ err }, "[POST /api/links] Webhook delivery failed");
      });
    }

    return jsonWithRequestId(
      {
        link: result.link,
        shortUrl: `${origin}/${result.link.slug}`,
        deduplicated: result.deduplicated,
      },
      requestId,
      { status: result.deduplicated ? 200 : 201 },
    );
  } catch (err: unknown) {
    if (
      err instanceof InvalidUrlInputError ||
      err instanceof SlugValidationError
    ) {
      return problemResponse({
        status: 400,
        detail: err.message,
        requestId,
      });
    }
    if (err instanceof SlugConflictError) {
      return problemResponse({
        status: 409,
        detail: err.message,
        requestId,
      });
    }
    log.error({ err }, "[POST /api/links] Failed to shorten link");
    return problemResponse({
      status: 500,
      detail: "Failed to shorten link.",
      requestId,
    });
  }
}
