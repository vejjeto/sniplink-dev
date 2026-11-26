export type DeviceType = "Desktop" | "Mobile" | "Tablet" | "Bot";
export type BrowserName = "Chrome" | "Firefox" | "Safari" | "Edge" | "Other";

const BOT_PATTERN =
  /bot|crawl|spider|slurp|curl|wget|python-requests|go-http-client|headless|lighthouse/i;
const TABLET_PATTERN = /ipad|tablet|playbook|silk|kindle|android(?!.*mobile)/i;
const MOBILE_PATTERN =
  /mobi|iphone|ipod|android.*mobile|windows phone|blackberry/i;

function detectDeviceType(ua: string): DeviceType {
  if (!ua || BOT_PATTERN.test(ua)) return "Bot";
  if (TABLET_PATTERN.test(ua)) return "Tablet";
  if (MOBILE_PATTERN.test(ua)) return "Mobile";
  return "Desktop";
}

function detectBrowser(ua: string): BrowserName {
  if (!ua) return "Other";
  if (/edg\/|edge\//i.test(ua)) return "Edge";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/chrome|crios|chromium/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  return "Other";
}

/** Parse a User-Agent header into device category and browser family. */
export function parseUserAgent(userAgent?: string | null): {
  deviceType: DeviceType;
  browser: BrowserName;
} {
  const ua = (userAgent ?? "").trim();
  return {
    deviceType: detectDeviceType(ua),
    browser: detectBrowser(ua),
  };
}

export interface CountryHeaderInput {
  cfIpCountry?: string | null;
  vercelIpCountry?: string | null;
  acceptLanguage?: string | null;
}

/** Infer a 2-letter country code from CDN headers or Accept-Language fallback. */
export function parseCountry(headers: CountryHeaderInput): string {
  const cdnCountry = headers.cfIpCountry ?? headers.vercelIpCountry;
  if (cdnCountry && /^[A-Za-z]{2}$/.test(cdnCountry.trim())) {
    return cdnCountry.trim().toUpperCase();
  }

  const acceptLang = headers.acceptLanguage ?? "";
  const regionMatch = /^[a-z]{2,3}[-_]([A-Za-z]{2})\b/.exec(acceptLang.trim());
  if (regionMatch?.[1]) {
    return regionMatch[1].toUpperCase();
  }

  return "US";
}
