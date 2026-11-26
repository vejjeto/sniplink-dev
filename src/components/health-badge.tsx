"use client";

import { useQuery } from "@tanstack/react-query";

interface HealthPayload {
  status: "ok" | "degraded";
  dbLatencyMs?: number;
}

/** Live service health indicator polling /api/health. */
export function HealthBadge({
  endpoint = "/api/health",
}: {
  endpoint?: string;
}): React.ReactElement {
  const { data, isError, isPending } = useQuery<HealthPayload>({
    queryKey: ["health-badge", endpoint],
    queryFn: async () => {
      const res = await fetch(endpoint);
      if (!res.ok) {
        throw new Error("Health check degraded");
      }
      return (await res.json()) as HealthPayload;
    },
    refetchInterval: 30_000,
    retry: 1,
  });

  const healthy = !isError && data?.status === "ok";
  const label = isPending
    ? "Checking..."
    : healthy
      ? `API Online${typeof data?.dbLatencyMs === "number" ? ` · ${data.dbLatencyMs}ms` : ""}`
      : "Degraded";

  return (
    <span
      title={label}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
        isPending
          ? "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
          : healthy
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isPending
            ? "bg-slate-400"
            : healthy
              ? "bg-emerald-500"
              : "bg-amber-500"
        }`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}
