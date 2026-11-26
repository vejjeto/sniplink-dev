import { normalizeAndValidateUrl } from "./url-security";

export interface OpenGraphPreview {
  url: string;
  title: string;
  description: string;
  image: string | null;
  siteName: string;
  fallback: boolean;
}

const MAX_HTML_BYTES = 128_000;

function decodeHtmlEntities(input: string): string {
  return input
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .trim();
}

function extractMetaContent(html: string, key: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1]);
    }
  }
  return null;
}

function extractTitleTag(html: string): string | null {
  const match = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  return match?.[1] ? decodeHtmlEntities(match[1]) : null;
}

function buildFallbackPreview(validUrl: string): OpenGraphPreview {
  const parsed = new URL(validUrl);
  return {
    url: validUrl,
    title: parsed.hostname,
    description:
      "URL validated for safe redirect. Live metadata unavailable offline or blocked by host.",
    image: null,
    siteName: parsed.hostname,
    fallback: true,
  };
}

function resolveSafeImageUrl(
  rawImage: string | null,
  baseUrl: string,
): string | null {
  if (!rawImage) return null;
  try {
    const resolved = new URL(rawImage, baseUrl).toString();
    const check = normalizeAndValidateUrl(resolved);
    return check.ok ? check.url : null;
  } catch {
    return null;
  }
}

/** Fetch OpenGraph metadata with SSRF validation, timeout, and offline fallback. */
export async function fetchOpenGraphPreview(
  rawUrl: string,
): Promise<OpenGraphPreview> {
  const check = normalizeAndValidateUrl(rawUrl);
  if (!check.ok) {
    throw new Error(check.error);
  }

  const targetUrl = check.url;
  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(3500),
      headers: {
        "User-Agent": "SnipLinkDev-OGFetcher/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/html")) {
      return buildFallbackPreview(targetUrl);
    }

    const rawText = await response.text();
    const html = rawText.slice(0, MAX_HTML_BYTES);
    const parsed = new URL(targetUrl);

    const title =
      extractMetaContent(html, "og:title") ??
      extractTitleTag(html) ??
      parsed.hostname;
    const description =
      extractMetaContent(html, "og:description") ??
      extractMetaContent(html, "description") ??
      `Destination on ${parsed.hostname}`;
    const image = resolveSafeImageUrl(
      extractMetaContent(html, "og:image"),
      targetUrl,
    );
    const siteName =
      extractMetaContent(html, "og:site_name") ?? parsed.hostname;

    return {
      url: targetUrl,
      title,
      description,
      image,
      siteName,
      fallback: false,
    };
  } catch {
    return buildFallbackPreview(targetUrl);
  }
}
