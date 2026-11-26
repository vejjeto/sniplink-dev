import { createHash, randomBytes } from "node:crypto";

const KEY_PREFIX_TAG = "slk_live_";

/** Compute a SHA-256 hex hash for storing and verifying API keys. */
export function hashApiKey(plaintextKey: string): string {
  return createHash("sha256").update(plaintextKey).digest("hex");
}

/** Generate a new API key along with its SHA-256 hash and display prefix. */
export function generateApiKey(): {
  plaintext: string;
  keyHash: string;
  keyPrefix: string;
} {
  const randomHex = randomBytes(12).toString("hex"); // 24 hex chars
  const plaintext = `${KEY_PREFIX_TAG}${randomHex}`;
  return {
    plaintext,
    keyHash: hashApiKey(plaintext),
    keyPrefix: plaintext.slice(0, 16),
  };
}

/** Extract a Bearer token from an Authorization header when present. */
export function extractBearerKey(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const trimmed = authHeader.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
}
