import { z } from "zod";

const emptyToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const envSchema = z.object({
  DATABASE_URL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  POSTGRES_URL: z.preprocess(
    emptyToUndefined,
    z.string().url("POSTGRES_URL must be a valid URL").optional(),
  ),
  NEXT_PUBLIC_APP_URL: z.preprocess(
    emptyToUndefined,
    z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL").optional(),
  ),
  WEBHOOK_URL: z.preprocess(
    emptyToUndefined,
    z.string().url("WEBHOOK_URL must be a valid URL").optional(),
  ),
  WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  RATE_LIMIT_MAX: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().max(10_000).optional(),
  ),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

/** Validate environment variables with Zod unless SKIP_ENV_VALIDATION=true. */
export function getEnv(
  source: Record<string, string | undefined> = process.env,
): AppEnv {
  if (source === process.env && cachedEnv) {
    return cachedEnv;
  }

  if (source.SKIP_ENV_VALIDATION === "true") {
    return {
      DATABASE_URL: source.DATABASE_URL || undefined,
      POSTGRES_URL: source.POSTGRES_URL || undefined,
      NEXT_PUBLIC_APP_URL: source.NEXT_PUBLIC_APP_URL || undefined,
      WEBHOOK_URL: source.WEBHOOK_URL || undefined,
      WEBHOOK_SECRET: source.WEBHOOK_SECRET || undefined,
      RATE_LIMIT_MAX: source.RATE_LIMIT_MAX
        ? Number.parseInt(source.RATE_LIMIT_MAX, 10) || 40
        : 40,
    };
  }

  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const normalized: AppEnv = {
    ...parsed.data,
    RATE_LIMIT_MAX: parsed.data.RATE_LIMIT_MAX ?? 40,
  };

  if (source === process.env) {
    cachedEnv = normalized;
  }
  return normalized;
}

/** Reset cached environment validation (used in automated tests). */
export function resetEnvCache(): void {
  cachedEnv = null;
}

export const env = getEnv();
