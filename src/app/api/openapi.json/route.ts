import { getSnipLinkOpenApiSpec } from "@/lib/openapi";
import { jsonWithRequestId, resolveRequestId } from "@/lib/problem-details";
import type { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = resolveRequestId(request.headers);
  const origin = new URL(request.url).origin;
  return jsonWithRequestId(getSnipLinkOpenApiSpec(origin), requestId, {
    status: 200,
  });
}
