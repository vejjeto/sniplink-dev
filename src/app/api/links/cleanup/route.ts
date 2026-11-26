import { ensureInitialized } from "@/db";
import { cleanupExpiredLinks } from "@/lib/links-service";
import { createRequestLogger } from "@/lib/logger";
import {
  jsonWithRequestId,
  problemResponse,
  resolveRequestId,
} from "@/lib/problem-details";
import type { NextRequest, NextResponse } from "next/server";

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const requestId = resolveRequestId(request.headers);
  const log = createRequestLogger(requestId);
  try {
    const { searchParams } = new URL(request.url);
    const purge = searchParams.get("purge") === "true";
    const db = await ensureInitialized();
    const result = await cleanupExpiredLinks(db, purge);
    return jsonWithRequestId(result, requestId, { status: 200 });
  } catch (err: unknown) {
    log.error({ err }, "[DELETE /api/links/cleanup] Cleanup failed");
    return problemResponse({
      status: 500,
      detail: "Failed to clean up expired links.",
      requestId,
    });
  }
}
