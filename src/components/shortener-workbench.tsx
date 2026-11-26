"use client";

import { useUiToast } from "@/components/toast-provider";
import type { LinkWithStatus } from "@/lib/links-service";
import type { OpenGraphPreview } from "@/lib/opengraph";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface CreatedResult {
  link: LinkWithStatus;
  shortUrl: string;
  deduplicated: boolean;
  qrSvg: string;
  qrPngDataUrl: string;
}

const TTL_OPTIONS = [
  { value: "never", label: "No expiration" },
  { value: "1h", label: "1 hour" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
] as const;

export function ShortenerWorkbench(): React.ReactElement {
  const queryClient = useQueryClient();
  const { pushToast } = useUiToast();

  const [url, setUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [ttl, setTtl] = useState<string>("never");
  const [maxClicks, setMaxClicks] = useState("");
  const [campaignMode, setCampaignMode] = useState(false);

  const [previewTarget, setPreviewTarget] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const previewQuery = useQuery<OpenGraphPreview>({
    queryKey: ["og-preview", previewTarget],
    queryFn: async () => {
      const res = await fetch(
        `/api/og-preview?url=${encodeURIComponent(previewTarget ?? "")}`,
      );
      const data = (await res.json()) as OpenGraphPreview & {
        detail?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.detail ?? data.error ?? "Unable to preview URL.");
      }
      return data;
    },
    enabled: Boolean(previewTarget),
    retry: false,
  });

  const shortenMutation = useMutation({
    mutationFn: async (payload: {
      url: string;
      customAlias?: string | undefined;
      ttl: string;
      maxClicks: number | null;
      userId: string | null;
      title?: string | undefined;
    }): Promise<CreatedResult> => {
      const createRes = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const createData = (await createRes.json()) as {
        link?: LinkWithStatus;
        shortUrl?: string;
        deduplicated?: boolean;
        detail?: string;
        error?: string;
      };

      if (!createRes.ok || !createData.link || !createData.shortUrl) {
        throw new Error(
          createData.detail ??
            createData.error ??
            "Could not create short link.",
        );
      }

      const statsRes = await fetch(
        `/api/links/${encodeURIComponent(createData.link.slug)}/stats`,
      );
      const statsData = (await statsRes.json()) as {
        qr?: { svg: string; pngDataUrl: string };
      };

      return {
        link: createData.link,
        shortUrl: createData.shortUrl,
        deduplicated: Boolean(createData.deduplicated),
        qrSvg: statsData.qr?.svg ?? "",
        qrPngDataUrl: statsData.qr?.pngDataUrl ?? "",
      };
    },
    onSuccess: (created) => {
      setCopied(false);
      void queryClient.invalidateQueries({ queryKey: ["links"] });
      pushToast({
        title: created.deduplicated ? "Active link reused" : "Short link ready",
        description: created.shortUrl,
        variant: "success",
      });
    },
    onError: (err) => {
      pushToast({
        title: "Could not shorten URL",
        description:
          err instanceof Error
            ? err.message
            : "Request failed. Check your connection and retry.",
        variant: "error",
      });
    },
  });

  function handleFetchPreview(targetUrl: string): void {
    const trimmed = targetUrl.trim();
    if (!trimmed) {
      setPreviewTarget(null);
      return;
    }
    if (trimmed === previewTarget) {
      void previewQuery.refetch();
    } else {
      setPreviewTarget(trimmed);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const parsedMaxClicks =
      maxClicks.trim() !== "" ? Number.parseInt(maxClicks, 10) : null;

    shortenMutation.mutate({
      url: url.trim(),
      customAlias: customAlias.trim() || undefined,
      ttl,
      maxClicks:
        parsedMaxClicks && !Number.isNaN(parsedMaxClicks)
          ? parsedMaxClicks
          : null,
      userId: campaignMode ? "dev-team" : null,
      title: previewQuery.data?.title ?? undefined,
    });
  }

  async function copyShortUrl(): Promise<void> {
    if (!shortenMutation.data) return;
    await navigator.clipboard.writeText(shortenMutation.data.shortUrl);
    setCopied(true);
    pushToast({
      title: "Copied to clipboard",
      description: shortenMutation.data.shortUrl,
      variant: "info",
    });
    setTimeout(() => setCopied(false), 1800);
  }

  function downloadQrSvg(): void {
    const result = shortenMutation.data;
    if (!result?.qrSvg) return;
    const blob = new Blob([result.qrSvg], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${result.link.slug}-qr.svg`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  function downloadQrPng(): void {
    const result = shortenMutation.data;
    if (!result?.qrPngDataUrl) return;
    const anchor = document.createElement("a");
    anchor.href = result.qrPngDataUrl;
    anchor.download = `${result.link.slug}-qr.png`;
    anchor.click();
  }

  const preview = previewQuery.data ?? null;
  const previewLoading = previewQuery.isFetching;
  const previewError =
    previewQuery.error instanceof Error ? previewQuery.error.message : null;
  const submitting = shortenMutation.isPending;
  const submitError =
    shortenMutation.error instanceof Error
      ? shortenMutation.error.message
      : null;
  const result = shortenMutation.data ?? null;

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-700 dark:text-sky-300">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Zero-Friction URL Shortener · HTTP 302 + 410 Gone
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Shorten, track &amp; expire links in seconds.
            </h1>
            <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300 sm:text-base">
              No login wall. Cryptographic Base62 slugs, SSRF-safe OpenGraph
              previews, deterministic TTL expiration, and downloadable SVG/PNG
              QR codes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/demo"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-500/20 dark:text-sky-300"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Abrir Demo (Sin registro)
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              Ver Dashboard Demo
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="target-url" className="sr-only">
              Destination URL
            </label>
            <input
              id="target-url"
              type="url"
              required
              placeholder="https://nextjs.org/docs/app/building-your-application"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => {
                if (url.trim().startsWith("http")) {
                  handleFetchPreview(url);
                }
              }}
              className="w-full flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => handleFetchPreview(url)}
              disabled={!url.trim() || previewLoading}
              aria-label="Preview OpenGraph metadata"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {previewLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
              <span>OG Preview</span>
            </button>
            <button
              type="submit"
              disabled={submitting || !url.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <QrCode className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{submitting ? "Shortening..." : "Shorten URL"}</span>
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                htmlFor="custom-alias"
                className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                Custom Alias (optional)
              </label>
              <input
                id="custom-alias"
                type="text"
                placeholder="e.g. launch-v2"
                value={customAlias}
                onChange={(e) => setCustomAlias(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="ttl-select"
                className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                Time To Live (TTL)
              </label>
              <select
                id="ttl-select"
                value={ttl}
                onChange={(e) => setTtl(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {TTL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="max-clicks"
                className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                Max Clicks (optional)
              </label>
              <input
                id="max-clicks"
                type="number"
                min={1}
                max={1000000}
                placeholder="Unlimited"
                value={maxClicks}
                onChange={(e) => setMaxClicks(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                role="switch"
                aria-checked={campaignMode}
                onClick={() => setCampaignMode((prev) => !prev)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  campaignMode
                    ? "border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300"
                    : "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                }`}
              >
                <span>Modo Campaña (@dev-team)</span>
                <span
                  className={`inline-flex h-4 w-7 items-center rounded-full p-0.5 transition ${
                    campaignMode
                      ? "bg-sky-500"
                      : "bg-slate-400 dark:bg-slate-600"
                  }`}
                >
                  <span
                    className={`h-3 w-3 rounded-full bg-white transition ${
                      campaignMode ? "translate-x-3" : "translate-x-0"
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {campaignMode
              ? "Campaign Mode active: creates distinct slugs per campaign under @dev-team even for identical URLs."
              : "Anonymous Mode: standard URLs without custom alias/TTL are deduplicated to reuse active short slugs."}
          </p>
        </form>

        {submitError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{submitError}</span>
            </div>
            <button
              type="button"
              onClick={() => shortenMutation.reset()}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-400/40 px-2.5 py-1 text-xs font-medium hover:bg-rose-500/10"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Dismiss
            </button>
          </div>
        )}

        {(previewLoading || preview || previewError) && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
            {previewLoading ? (
              <div className="flex animate-pulse items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-slate-200 dark:bg-slate-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
                </div>
              </div>
            ) : previewError ? (
              <p className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                {previewError}
              </p>
            ) : preview ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {preview.image && (
                  <img
                    src={preview.image}
                    alt={preview.title}
                    className="h-16 w-28 rounded-lg border border-slate-200 object-cover dark:border-slate-800"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                      {preview.siteName}
                    </span>
                    {preview.fallback && (
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Offline Fallback
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {preview.title}
                  </p>
                  <p className="line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                    {preview.description}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {result && (
        <section
          aria-live="polite"
          className="grid gap-6 rounded-2xl border border-emerald-500/30 bg-white p-6 shadow-sm dark:bg-slate-900/80 md:grid-cols-[1fr_auto]"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                {result.deduplicated
                  ? "Deduplicated Active Link"
                  : "Short Link Ready"}
              </span>
              {result.link.userId && (
                <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 font-mono text-xs text-sky-700 dark:text-sky-300">
                  @{result.link.userId}
                </span>
              )}
              {result.link.expiresAt && (
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs text-amber-700 dark:text-amber-300">
                  Expires {new Date(result.link.expiresAt).toLocaleString()}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/${result.link.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-lg font-bold text-sky-600 hover:underline dark:text-sky-400"
              >
                {result.shortUrl}
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>

            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              Destination: {result.link.originalUrl}
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyShortUrl()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                {copied ? (
                  <Check
                    className="h-3.5 w-3.5 text-emerald-500"
                    aria-hidden="true"
                  />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {copied ? "Copied!" : "Copy Short URL"}
              </button>
              <button
                type="button"
                onClick={downloadQrSvg}
                disabled={!result.qrSvg}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download SVG
              </button>
              <button
                type="button"
                onClick={downloadQrPng}
                disabled={!result.qrPngDataUrl}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download PNG
              </button>
            </div>
          </div>

          {result.qrPngDataUrl && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700">
              <img
                src={result.qrPngDataUrl}
                alt={`QR code for ${result.shortUrl}`}
                className="h-32 w-32"
              />
              <span className="mt-1 font-mono text-[11px] text-slate-500">
                /{result.link.slug}
              </span>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
