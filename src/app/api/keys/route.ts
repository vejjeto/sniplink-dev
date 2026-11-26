import { ensureInitialized } from "@/db";
import { apiKeys } from "@/db/schema";
import { generateApiKey } from "@/lib/api-keys";
import { createRequestLogger } from "@/lib/logger";
import {
  jsonWithRequestId,
  problemResponse,
  resolveRequestId,
} from "@/lib/problem-details";
import { computeExpiresAt } from "@/lib/ttl";
import { desc } from "drizzle-orm";
import type { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createKeySchema = z.object({
  label: z
    .string()
    .trim()
    .min(2, "Label must be at least 2 characters")
    .max(60),
  userId: z.string().trim().min(2).max(40).optional(),
  ttl: z.enum(["24h", "7d", "30d", "never"]).optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = resolveRequestId(request.headers);
  const log = createRequestLogger(requestId);
  try {
    const db = await ensureInitialized();
    const rows = await db
      .select({
        id: apiKeys.id,
        keyPrefix: apiKeys.keyPrefix,
        label: apiKeys.label,
        userId: apiKeys.userId,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .orderBy(desc(apiKeys.createdAt));

    return jsonWithRequestId({ keys: rows }, requestId, { status: 200 });
  } catch (err: unknown) {
    log.error({ err }, "[GET /api/keys] Failed to list API keys");
    return problemResponse({
      status: 500,
      detail: "Failed to list API keys.",
      requestId,
    });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = resolveRequestId(request.headers);
  const log = createRequestLogger(requestId);

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

  const parsed = createKeySchema.safeParse(body);
  if (!parsed.success) {
    return problemResponse({
      status: 400,
      detail: parsed.error.issues[0]?.message ?? "Invalid API key request.",
      requestId,
      errors: parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "body",
        message: issue.message,
      })),
    });
  }

  try {
    const db = await ensureInitialized();
    const generated = generateApiKey();
    const expiresAt = computeExpiresAt(parsed.data.ttl ?? "30d");
    const createdAt = new Date().toISOString();

    const [inserted] = await db
      .insert(apiKeys)
      .values({
        keyHash: generated.keyHash,
        keyPrefix: generated.keyPrefix,
        label: parsed.data.label,
        userId: parsed.data.userId ?? "dev-team",
        expiresAt,
        createdAt,
      })
      .returning({
        id: apiKeys.id,
        keyPrefix: apiKeys.keyPrefix,
        label: apiKeys.label,
        userId: apiKeys.userId,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
      });

    return jsonWithRequestId(
      {
        apiKey: generated.plaintext,
        key: inserted,
      },
      requestId,
      { status: 201 },
    );
  } catch (err: unknown) {
    log.error({ err }, "[POST /api/keys] Failed to generate API key");
    return problemResponse({
      status: 500,
      detail: "Failed to generate API key.",
      requestId,
    });
  }
}
