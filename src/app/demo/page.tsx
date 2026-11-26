import { DashboardClient } from "@/components/dashboard-client";
import { ShortenerWorkbench } from "@/components/shortener-workbench";
import { Sparkles } from "lucide-react";

export default function DemoPage(): React.ReactElement {
  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-5 dark:bg-sky-950/20">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Live Sandbox · No Login Required
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          SnipLink Dev — Interactive Demo
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Create a short link below or explore the pre-seeded links, 14-day
          Recharts telemetry, and QR exports immediately.
        </p>
      </section>

      <ShortenerWorkbench />
      <DashboardClient />
    </div>
  );
}
