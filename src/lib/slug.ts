import { randomBytes } from "node:crypto";

const BASE62_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ALPHABET_SIZE = BASE62_ALPHABET.length; // 62
const REJECTION_LIMIT = 248; // 62 * 4, avoids modulo bias

export const CUSTOM_ALIAS_REGEX = /^[a-zA-Z0-9-_]{3,32}$/;

export const RESERVED_SLUGS = new Set([
  "api",
  "dashboard",
  "demo",
  "login",
  "docs",
  "expired",
  "admin",
  "_next",
  "health",
]);

export class SlugConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlugConflictError";
  }
}

export class SlugValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlugValidationError";
  }
}

/** Generate a cryptographically random Base62 slug of fixed length. */
export function generateSlug(length = 7): string {
  let result = "";
  while (result.length < length) {
    const bytes = randomBytes(length * 2);
    for (const byte of bytes) {
      if (byte < REJECTION_LIMIT) {
        result += BASE62_ALPHABET[byte % ALPHABET_SIZE];
        if (result.length === length) break;
      }
    }
  }
  return result;
}

/** Validate a user-supplied custom alias against format and reserved words. */
export function validateCustomAlias(
  rawAlias: string,
): { valid: true; slug: string } | { valid: false; error: string } {
  const alias = rawAlias.trim();
  if (!CUSTOM_ALIAS_REGEX.test(alias)) {
    return {
      valid: false,
      error:
        "Custom alias must be 3-32 characters using letters, numbers, '-' or '_'.",
    };
  }
  if (RESERVED_SLUGS.has(alias.toLowerCase())) {
    return {
      valid: false,
      error: `Alias '${alias}' is reserved and cannot be used.`,
    };
  }
  return { valid: true, slug: alias };
}

/** Insert a slug using bounded collision retries for auto-generated Base62 codes. */
export async function createSlugWithRetry(
  tryInsert: (slug: string) => Promise<boolean>,
  customAlias?: string,
  maxAttempts = 5,
): Promise<string> {
  if (customAlias !== undefined && customAlias.trim() !== "") {
    const check = validateCustomAlias(customAlias);
    if (!check.valid) {
      throw new SlugValidationError(check.error);
    }
    const inserted = await tryInsert(check.slug);
    if (!inserted) {
      throw new SlugConflictError(`Alias '${check.slug}' is already taken.`);
    }
    return check.slug;
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const candidate = generateSlug(7);
    if (RESERVED_SLUGS.has(candidate.toLowerCase())) {
      continue;
    }
    const inserted = await tryInsert(candidate);
    if (inserted) {
      return candidate;
    }
  }

  throw new SlugConflictError(
    `Failed to allocate a unique slug after ${maxAttempts} attempts.`,
  );
}
