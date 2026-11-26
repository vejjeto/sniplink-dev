const MAX_URL_LENGTH = 2048;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "0.0.0.0",
  "::",
  "::1",
  "metadata.google.internal",
]);

function isPrivateIpv4(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;

  const octets = match.slice(1, 5).map(Number);
  if (octets.some((n) => n < 0 || n > 255)) return true;

  const [a, b] = octets;
  if (a === undefined || b === undefined) return true;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const clean = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (clean === "::" || clean === "::1") return true;
  if (clean.startsWith("::ffff:")) {
    return isPrivateIpv4(clean.slice(7));
  }
  if (clean.startsWith("fc") || clean.startsWith("fd")) return true;
  return /^fe[89ab]/.test(clean);
}

/** Check whether a hostname resolves structurally to a private or loopback target. */
export function isBlockedHost(rawHostname: string): boolean {
  const host = rawHostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) return true;
  return isPrivateIpv4(host) || isPrivateIpv6(host);
}

/** Normalize and validate an external HTTP/HTTPS URL against SSRF and unsafe schemes. */
export function normalizeAndValidateUrl(
  rawUrl: string,
): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { ok: false, error: "URL is required." };
  }
  if (trimmed.length > MAX_URL_LENGTH) {
    return {
      ok: false,
      error: `URL exceeds maximum length of ${MAX_URL_LENGTH} characters.`,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      ok: false,
      error: "Invalid URL format. Include http:// or https://.",
    };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return {
      ok: false,
      error: `Protocol '${parsed.protocol}' is not allowed. Use http: or https:.`,
    };
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      error: "Embedded URL credentials are not permitted.",
    };
  }

  if (isBlockedHost(parsed.hostname)) {
    return {
      ok: false,
      error: "Target host is blocked (private, loopback, or local address).",
    };
  }

  return { ok: true, url: parsed.toString() };
}
