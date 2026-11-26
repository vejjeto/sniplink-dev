import { ensureInitialized } from "@/db";
import { links } from "@/db/schema";
import { recordClickAndIncrement } from "@/lib/links-service";
import { createRequestLogger } from "@/lib/logger";
import { resolveRequestId } from "@/lib/problem-details";
import { type ExpirationReason, isLinkExpired } from "@/lib/ttl";
import { parseCountry, parseUserAgent } from "@/lib/user-agent";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

function wantsJson(request: NextRequest): boolean {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/json") && !accept.includes("text/html");
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function describeExpiration(reason: ExpirationReason): {
  headline: string;
  detail: string;
} {
  if (reason === "max_clicks") {
    return {
      headline: "Click Limit Reached",
      detail:
        "This short link has reached its maximum configured number of clicks.",
    };
  }
  if (reason === "inactive") {
    return {
      headline: "Link Deactivated",
      detail: "This short link was deactivated or cleaned up by its owner.",
    };
  }
  return {
    headline: "TTL Expired",
    detail: "This short link has passed its scheduled expiration timestamp.",
  };
}

function renderStatusHtml(params: {
  code: 404 | 410;
  title: string;
  badge: string;
  detail: string;
  slug: string;
}): string {
  const accent = params.code === 410 ? "#f59e0b" : "#ef4444";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${params.code} — ${escapeHtml(params.title)} | SnipLink Dev</title>
  <style>
    body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; background:#090d16; color:#e2e8f0; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
    .card { max-width:520px; width:100%; background:#111827; border:1px solid #1f2937; border-radius:16px; padding:32px; box-shadow:0 20px 50px rgba(0,0,0,0.45); }
    .badge { display:inline-block; font-family: ui-monospace, monospace; font-size:12px; font-weight:700; color:${accent}; background:rgba(245,158,11,0.12); border:1px solid ${accent}; border-radius:999px; padding:4px 10px; margin-bottom:16px; }
    h1 { margin:0 0 10px; font-size:24px; color:#f8fafc; }
    p { margin:0 0 20px; line-height:1.6; color:#94a3b8; font-size:15px; }
    code { font-family: ui-monospace, monospace; background:#1e293b; color:#38bdf8; padding:2px 6px; border-radius:6px; }
    .actions { display:flex; gap:12px; flex-wrap:wrap; }
    a { text-decoration:none; padding:10px 16px; border-radius:10px; font-size:14px; font-weight:600; }
    .primary { background:#3b82f6; color:#ffffff; }
    .secondary { background:#1e293b; color:#e2e8f0; border:1px solid #334155; }
  </style>
</head>
<body>
  <main class="card" role="main">
    <span class="badge">HTTP ${params.code} · ${escapeHtml(params.badge)}</span>
    <h1>${escapeHtml(params.title)}</h1>
    <p>${escapeHtml(params.detail)}</p>
    <p>Requested slug: <code>/${escapeHtml(params.slug)}</code></p>
    <div class="actions">
      <a class="primary" href="/">Create a New Short Link</a>
      <a class="secondary" href="/dashboard">Open Demo Dashboard</a>
    </div>
  </main>
</body>
</html>`;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const requestId = resolveRequestId(request.headers);
  const log = createRequestLogger(requestId);
  const { slug } = await context.params;
  const db = await ensureInitialized();

  const [link] = await db
    .select()
    .from(links)
    .where(eq(links.slug, slug))
    .limit(1);

  if (!link) {
    if (wantsJson(request)) {
      return NextResponse.json(
        { error: "Short link not found.", slug },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    return new NextResponse(
      renderStatusHtml({
        code: 404,
        title: "Short Link Not Found",
        badge: "Not Found",
        detail:
          "No destination is mapped to this slug. Check the URL or create a new link.",
        slug,
      }),
      {
        status: 404,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const expiry = isLinkExpired(link);
  if (expiry.expired) {
    const info = describeExpiration(expiry.reason);
    if (wantsJson(request)) {
      return NextResponse.json(
        {
          error: "Short link has expired.",
          reason: expiry.reason,
          slug: link.slug,
        },
        { status: 410, headers: { "Cache-Control": "no-store" } },
      );
    }
    return new NextResponse(
      renderStatusHtml({
        code: 410,
        title: info.headline,
        badge: "Gone",
        detail: info.detail,
        slug: link.slug,
      }),
      {
        status: 410,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const { deviceType, browser } = parseUserAgent(
    request.headers.get("user-agent"),
  );
  const country = parseCountry({
    cfIpCountry: request.headers.get("cf-ipcountry"),
    vercelIpCountry: request.headers.get("x-vercel-ip-country"),
    acceptLanguage: request.headers.get("accept-language"),
  });
  const referrer = request.headers.get("referer") ?? null;

  queueMicrotask(() => {
    void recordClickAndIncrement(db, link.id, {
      referrer,
      deviceType,
      browser,
      country,
    }).catch((err: unknown) => {
      log.error({ err, slug }, "[GET /[slug]] Async click tracking failed");
    });
  });

  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: link.originalUrl,
      "Cache-Control": "no-store",
      "x-request-id": requestId,
    },
  });
}
