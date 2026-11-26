import { getSnipLinkOpenApiSpec, renderOpenApiDocsHtml } from "@/lib/openapi";
import { resolveRequestId } from "@/lib/problem-details";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = resolveRequestId(request.headers);
  const origin = new URL(request.url).origin;
  const spec = getSnipLinkOpenApiSpec(origin);
  const html = renderOpenApiDocsHtml({
    title: "SnipLink Dev API",
    specUrl: "/api/openapi.json",
    spec,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "x-request-id": requestId,
    },
  });
}
