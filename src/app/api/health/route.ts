import { ensureInitialized } from "@/db";
import { createRequestLogger } from "@/lib/logger";
import { jsonWithRequestId, resolveRequestId } from "@/lib/problem-details";
import { sql } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = resolveRequestId(request.headers);
  const log = createRequestLogger(requestId);
  const start = performance.now();

  try {
    const db = await ensureInitialized();
    await db.run(sql`SELECT 1`);
    const dbLatencyMs = Math.max(
      0,
      Math.round((performance.now() - start) * 100) / 100,
    );

    return jsonWithRequestId(
      {
        status: "ok",
        service: "sniplink-dev",
        dbLatencyMs,
        uptimeSeconds: Math.floor(process.uptime()),
        version: "2.0.0",
        timestamp: new Date().toISOString(),
      },
      requestId,
      { status: 200 },
    );
  } catch (err: unknown) {
    const dbLatencyMs = Math.max(
      0,
      Math.round((performance.now() - start) * 100) / 100,
    );
    log.error({ err }, "[GET /api/health] Database health check failed");
    return jsonWithRequestId(
      {
        status: "degraded",
        service: "sniplink-dev",
        dbLatencyMs,
        uptimeSeconds: Math.floor(process.uptime()),
        version: "2.0.0",
        timestamp: new Date().toISOString(),
      },
      requestId,
      { status: 503 },
    );
  }
}
