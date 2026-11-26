import { createRequestLogger } from "@/lib/logger";
import { fetchOpenGraphPreview } from "@/lib/opengraph";
import {
  jsonWithRequestId,
  problemResponse,
  resolveRequestId,
} from "@/lib/problem-details";
import type { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = resolveRequestId(request.headers);
  const log = createRequestLogger(requestId);
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl || !rawUrl.trim()) {
    return problemResponse({
      status: 400,
      detail: "Missing required 'url' query parameter.",
      requestId,
      errors: [{ field: "url", message: "Query parameter 'url' is required." }],
    });
  }

  try {
    const preview = await fetchOpenGraphPreview(rawUrl);
    return jsonWithRequestId(preview, requestId, { status: 200 });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Invalid URL for OpenGraph preview.";
    log.warn({ err, rawUrl }, "[GET /api/og-preview] Blocked or invalid URL");
    return problemResponse({
      status: 400,
      detail: message,
      requestId,
    });
  }
}
