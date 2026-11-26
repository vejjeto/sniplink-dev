"use client";

import { useLocale } from "@/lib/i18n";
import { Activity, Clock, Shield } from "lucide-react";

export function HomeHighlights(): React.ReactElement {
  const { t } = useLocale();

  const highlights = [
    {
      icon: Activity,
      title: t.highlights.telemetryTitle,
      description: t.highlights.telemetryDesc,
    },
    {
      icon: Shield,
      title: t.highlights.ssrfTitle,
      description: t.highlights.ssrfDesc,
    },
    {
      icon: Clock,
      title: t.highlights.ttlTitle,
      description: t.highlights.ttlDesc,
    },
  ] as const;

  return (
    <section
      aria-label={t.highlights.sectionLabel}
      className="grid gap-4 sm:grid-cols-3"
    >
      {highlights.map(({ icon: Icon, title, description }) => (
        <article
          key={title}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
        >
          <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            {title}
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {description}
          </p>
        </article>
      ))}
    </section>
  );
}
