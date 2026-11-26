"use client";

import { useUiToast } from "@/components/toast-provider";
import type {
  BreakdownItem,
  DailyClickPoint,
  LinkStatsPayload,
  LinkWithStatus,
} from "@/lib/links-service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  ExternalLink,
  Link2Off,
  Loader2,
  QrCode,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface LinksListResponse {
  links: LinkWithStatus[];
  summary: {
    total: number;
    active: number;
    expired: number;
    totalClicks: number;
  };
}

interface CleanupResponse {
  deactivatedCount?: number;
  cleanedSlugs?: string[];
}

function DailyBarChart({
  data,
}: {
  data: DailyClickPoint[];
}): React.ReactElement {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-52 w-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/60" />
    );
  }

  const chartData = data.map((point) => ({
    ...point,
    shortDate: point.date.slice(5),
  }));

  return (
    <div
      role="img"
      aria-label="14-day daily click activity area chart"
      className="h-52 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="clicksGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#334155"
            opacity={0.25}
          />
          <XAxis
            dataKey="shortDate"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              borderColor: "#1e293b",
              borderRadius: "0.75rem",
              fontSize: "12px",
              color: "#f8fafc",
            }}
          />
          <Area
            type="monotone"
            dataKey="clicks"
            stroke="#38bdf8"
            strokeWidth={2}
            fill="url(#clicksGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function BreakdownCard({
  title,
  items,
  barColor,
}: {
  title: string;
  items: BreakdownItem[];
  barColor: string;
}): React.ReactElement {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">No telemetry recorded yet.</p>
      ) : !mounted ? (
        <div className="h-36 w-full animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
      ) : (
        <div className="h-36 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={items}
              margin={{ top: 4, right: 8, left: -24, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#334155"
                opacity={0.2}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#1e293b",
                  borderRadius: "0.75rem",
                  fontSize: "12px",
                  color: "#f8fafc",
                }}
              />
              <Bar dataKey="count" fill={barColor} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function DashboardClient(): React.ReactElement {
  const queryClient = useQueryClient();
  const { pushToast } = useUiToast();

  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "expired"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [cleanupNotice, setCleanupNotice] = useState<string | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const linksQuery = useQuery<LinksListResponse>({
    queryKey: ["links", statusFilter, searchQuery.trim()],
    queryFn: async () => {
      const params = new URLSearchParams({ status: statusFilter });
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      const res = await fetch(`/api/links?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Unable to load links from SQLite store.");
      }
      return (await res.json()) as LinksListResponse;
    },
  });

  const links = linksQuery.data?.links ?? [];
  const activeSlug =
    selectedSlug && links.some((l) => l.slug === selectedSlug)
      ? selectedSlug
      : (links[0]?.slug ?? null);

  const statsQuery = useQuery<LinkStatsPayload>({
    queryKey: ["link-stats", activeSlug],
    queryFn: async () => {
      const res = await fetch(
        `/api/links/${encodeURIComponent(activeSlug ?? "")}/stats`,
      );
      if (!res.ok) {
        throw new Error(`Unable to load analytics for /${activeSlug}.`);
      }
      return (await res.json()) as LinkStatsPayload;
    },
    enabled: Boolean(activeSlug),
  });

  const cleanupMutation = useMutation({
    mutationFn: async (): Promise<CleanupResponse> => {
      const res = await fetch("/api/links/cleanup", { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Cleanup failed. Please retry.");
      }
      return (await res.json()) as CleanupResponse;
    },
    onSuccess: (data) => {
      const count = data.deactivatedCount ?? 0;
      const notice =
        count > 0
          ? `Deactivated ${count} expired link(s): ${(data.cleanedSlugs ?? []).join(", ")}.`
          : "No active expired links needed cleanup.";
      setCleanupNotice(notice);
      void queryClient.invalidateQueries({ queryKey: ["links"] });
      void queryClient.invalidateQueries({ queryKey: ["link-stats"] });
      pushToast({
        title: "Expired link cleanup complete",
        description: notice,
        variant: "success",
      });
    },
    onError: () => {
      setCleanupNotice("Cleanup failed. Please retry.");
      pushToast({
        title: "Cleanup failed",
        description: "Unable to deactivate expired links.",
        variant: "error",
      });
    },
  });

  async function copyLink(slug: string): Promise<void> {
    const shortUrl = `${window.location.origin}/${slug}`;
    await navigator.clipboard.writeText(shortUrl);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 1500);
  }

  function downloadQr(type: "svg" | "png"): void {
    const stats = statsQuery.data;
    if (!stats) return;
    const anchor = document.createElement("a");
    if (type === "svg") {
      const blob = new Blob([stats.qr.svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      anchor.href = url;
      anchor.download = `${stats.link.slug}-qr.svg`;
      anchor.click();
      URL.revokeObjectURL(url);
      return;
    }
    anchor.href = stats.qr.pngDataUrl;
    anchor.download = `${stats.link.slug}-qr.png`;
    anchor.click();
  }

  const listData = linksQuery.data;
  const listLoading = linksQuery.isPending;
  const listError =
    linksQuery.error instanceof Error ? linksQuery.error.message : null;
  const stats = statsQuery.data ?? null;
  const statsLoading = Boolean(activeSlug) && statsQuery.isPending;
  const statsError =
    statsQuery.error instanceof Error ? statsQuery.error.message : null;

  const summary = listData?.summary ?? {
    total: 0,
    active: 0,
    expired: 0,
    totalClicks: 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Analytics Dashboard
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Inspect 14-day click telemetry, test HTTP 302 &amp; 410 Gone
            responses, and download QR codes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => cleanupMutation.mutate()}
          disabled={cleanupMutation.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-500/20 disabled:opacity-50 dark:text-amber-300"
        >
          {cleanupMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          )}
          Clean Expired Links
        </button>
      </div>

      {cleanupNotice && (
        <output className="flex items-center justify-between rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-xs font-medium text-sky-700 dark:text-sky-300">
          <span>{cleanupNotice}</span>
          <button
            type="button"
            onClick={() => setCleanupNotice(null)}
            aria-label="Dismiss cleanup notice"
          >
            <X className="h-4 w-4" />
          </button>
        </output>
      )}

      <section
        aria-label="Link summary KPIs"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {[
          { label: "Total Links", value: summary.total },
          { label: "Active", value: summary.active },
          { label: "Expired / Inactive", value: summary.expired },
          { label: "Total Clicks", value: summary.totalClicks },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/70"
          >
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {kpi.label}
            </p>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900 dark:text-white">
              {kpi.value}
            </p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Filter links by slug or URL"
              placeholder="Search slug, title, or URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-950">
            {(["all", "active", "expired"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition ${
                  statusFilter === tab
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {listLoading ? (
            <div className="space-y-2" aria-label="Loading links">
              {["s1", "s2", "s3", "s4", "s5"].map((id) => (
                <div
                  key={id}
                  className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
                />
              ))}
            </div>
          ) : listError ? (
            <div
              role="alert"
              className="space-y-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-700 dark:text-rose-300"
            >
              <p className="flex items-center gap-1.5 font-medium">
                <AlertCircle className="h-4 w-4" />
                {listError}
              </p>
              <button
                type="button"
                onClick={() => void linksQuery.refetch()}
                className="inline-flex items-center gap-1 rounded bg-rose-600 px-2.5 py-1 text-white"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            </div>
          ) : !listData || listData.links.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
              <Link2Off
                className="mx-auto mb-2 h-6 w-6 text-slate-400"
                aria-hidden="true"
              />
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                No links match this filter.
              </p>
            </div>
          ) : (
            <ul className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {listData.links.map((item) => {
                const selected = item.slug === activeSlug;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedSlug(item.slug)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        selected
                          ? "border-sky-500 bg-sky-500/10"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-semibold text-sky-600 dark:text-sky-400">
                          /{item.slug}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            item.expired
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          }`}
                        >
                          {item.expired ? "410 Expired" : "Active"}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-400">
                        {item.originalUrl}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{item.clickCount} clicks</span>
                        {item.userId && (
                          <span className="font-mono">@{item.userId}</span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/70 sm:p-6">
          {statsLoading ? (
            <div className="space-y-4" aria-label="Loading analytics">
              <div className="h-8 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-48 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="h-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                <div className="h-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              </div>
            </div>
          ) : statsError ? (
            <div role="alert" className="space-y-3 p-4 text-sm text-rose-500">
              <p>{statsError}</p>
              {activeSlug && (
                <button
                  type="button"
                  onClick={() => void statsQuery.refetch()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </button>
              )}
            </div>
          ) : !stats ? (
            <div className="flex h-64 flex-col items-center justify-center text-center text-sm text-slate-500">
              Select a link on the left to inspect click telemetry and QR code.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-center">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-mono text-xl font-bold text-slate-900 dark:text-white">
                      /{stats.link.slug}
                    </h2>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        stats.link.expired
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {stats.link.expired ? "HTTP 410 Gone" : "HTTP 302 Active"}
                    </span>
                  </div>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {stats.link.originalUrl}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyLink(stats.link.slug)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    {copiedSlug === stats.link.slug ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    QR Modal
                  </button>
                  <a
                    href={`/${stats.link.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
                  >
                    Test Redirect
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  14-Day Click Activity ({stats.link.clickCount} total clicks)
                </h3>
                <DailyBarChart data={stats.dailyHistogram} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <BreakdownCard
                  title="Devices"
                  items={stats.devices}
                  barColor="#0ea5e9"
                />
                <BreakdownCard
                  title="Browsers"
                  items={stats.browsers}
                  barColor="#10b981"
                />
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Recent Click Events
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Device</th>
                        <th className="px-3 py-2">Browser</th>
                        <th className="px-3 py-2">Country</th>
                        <th className="px-3 py-2">Referrer</th>
                        <th className="px-3 py-2">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {stats.recentClicks.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-3 py-4 text-center text-slate-500"
                          >
                            No clicks recorded yet.
                          </td>
                        </tr>
                      ) : (
                        stats.recentClicks.slice(0, 8).map((click) => (
                          <tr key={click.id}>
                            <td className="px-3 py-2 font-medium">
                              {click.deviceType}
                            </td>
                            <td className="px-3 py-2">{click.browser}</td>
                            <td className="px-3 py-2 font-mono">
                              {click.country}
                            </td>
                            <td className="max-w-[180px] truncate px-3 py-2 text-slate-500">
                              {click.referrer ?? "Direct"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-slate-500">
                              {new Date(click.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {qrModalOpen && stats && (
        <dialog
          open
          aria-labelledby="qr-modal-title"
          className="fixed inset-0 z-50 m-0 flex h-full w-full max-w-none items-center justify-center border-0 bg-slate-950/70 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2
                id="qr-modal-title"
                className="font-mono text-base font-bold text-slate-900 dark:text-white"
              >
                QR Code · /{stats.link.slug}
              </h2>
              <button
                type="button"
                onClick={() => setQrModalOpen(false)}
                aria-label="Close QR modal"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="my-5 flex justify-center rounded-xl bg-white p-4">
              <img
                src={stats.qr.pngDataUrl}
                alt={`QR code for ${stats.shortUrl}`}
                className="h-48 w-48"
              />
            </div>
            <p className="mb-4 truncate text-center font-mono text-xs text-slate-500">
              {stats.shortUrl}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => downloadQr("svg")}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" />
                SVG
              </button>
              <button
                type="button"
                onClick={() => downloadQr("png")}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500"
              >
                <Download className="h-3.5 w-3.5" />
                PNG
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
