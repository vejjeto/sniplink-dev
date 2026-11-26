// shortcut: in-memory Map per process, swap for Redis INCR/EXPIRE in multi-instance prod
const requestBuckets = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/** Sliding-window per-key rate limiter. */
export function checkRateLimit(
  key: string,
  limit = 40,
  windowMs = 60_000,
  now = Date.now(),
): RateLimitResult {
  const windowStart = now - windowMs;
  const timestamps = (requestBuckets.get(key) ?? []).filter(
    (ts) => ts > windowStart,
  );

  if (timestamps.length >= limit) {
    requestBuckets.set(key, timestamps);
    const oldest = timestamps[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      resetAt: oldest + windowMs,
    };
  }

  timestamps.push(now);
  requestBuckets.set(key, timestamps);

  const oldest = timestamps[0] ?? now;
  return {
    allowed: true,
    remaining: Math.max(0, limit - timestamps.length),
    resetAt: oldest + windowMs,
  };
}

/** Reset in-memory rate limit buckets (intended for automated tests). */
export function clearRateLimits(): void {
  requestBuckets.clear();
}
