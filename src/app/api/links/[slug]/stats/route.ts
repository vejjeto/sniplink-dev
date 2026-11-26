import { ensureInitialized } from "@/db";
import { getLinkStats } from "@/lib/links-service";
import { createRequestLogger } from "@/lib/logger";
import {
  jsonWithRequestId,
  problemResponse,
  resolveRequestId,
} from "@/lib/problem-details";
import type { NextRequest, NextResponse } from "next/server";

function getRequestOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") ?? "http";
    return `${proto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const requestId = resolveRequestId(request.headers);
  const log = createRequestLogger(requestId);
  try {
    const { slug } = await context.params;
    const db = await ensureInitialized();
    const stats = await getLinkStats(db, slug, getRequestOrigin(request));
    if (!stats) {
      return problemResponse({
        status: 404,
        detail: `Link '${slug}' not found.`,
        requestId,
      });
    }
    return jsonWithRequestId(stats, requestId, { status: 200 });
  } catch (err: unknown) {
    log.error(
      { err },
      "[GET /api/links/[slug]/stats] Failed to load link analytics",
    );
    return problemResponse({
      status: 500,
      detail: "Failed to load link analytics.",
      requestId,
    });
  }
}
