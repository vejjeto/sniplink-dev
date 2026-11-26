export const TTL_PRESETS = ["1h", "24h", "7d", "30d", "never"] as const;
export type TtlPreset = (typeof TTL_PRESETS)[number];

const PRESET_MS: Record<Exclude<TtlPreset, "never">, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export interface ExpirationCheckInput {
  expiresAt: string | null;
  maxClicks: number | null;
  clickCount: number;
  isActive: boolean;
}

export type ExpirationReason = "inactive" | "ttl" | "max_clicks" | null;

/** Compute an ISO expiration timestamp from a preset or custom ISO date string. */
export function computeExpiresAt(
  ttlInput?: string | null,
  now = new Date(),
): string | null {
  if (!ttlInput || ttlInput === "never") {
    return null;
  }

  if (ttlInput in PRESET_MS) {
    const delta = PRESET_MS[ttlInput as Exclude<TtlPreset, "never">];
    return new Date(now.getTime() + delta).toISOString();
  }

  const parsed = new Date(ttlInput);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid TTL preset or ISO timestamp: '${ttlInput}'.`);
  }
  if (parsed.getTime() <= now.getTime()) {
    throw new Error("Custom expiration timestamp must be in the future.");
  }
  return parsed.toISOString();
}

/** Determine whether a link has expired due to deactivation, TTL, or max clicks. */
export function isLinkExpired(
  link: ExpirationCheckInput,
  now = new Date(),
): { expired: boolean; reason: ExpirationReason } {
  if (!link.isActive) {
    return { expired: true, reason: "inactive" };
  }
  if (link.expiresAt !== null) {
    const expiresMs = Date.parse(link.expiresAt);
    if (!Number.isNaN(expiresMs) && expiresMs <= now.getTime()) {
      return { expired: true, reason: "ttl" };
    }
  }
  if (link.maxClicks !== null && link.clickCount >= link.maxClicks) {
    return { expired: true, reason: "max_clicks" };
  }
  return { expired: false, reason: null };
}
