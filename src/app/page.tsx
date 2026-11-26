import { ShortenerWorkbench } from "@/components/shortener-workbench";
import { Activity, Clock, Shield } from "lucide-react";

const HIGHLIGHTS = [
  {
    icon: Activity,
    title: "302 Found + Async Telemetry",
    description:
      "Zero-cache 302 redirects keep click counts accurate while queueMicrotask records device, browser, and country non-blocking.",
  },
  {
    icon: Shield,
    title: "SSRF Guard & Base62 Slugs",
    description:
      "Blocks private/loopback IP ranges and unsafe schemes before persisting 7-char crypto Base62 slugs with 5-retry collision protection.",
  },
  {
    icon: Clock,
    title: "TTL & Max-Clicks 410 Gone",
    description:
      "Links past their expiration timestamp or click cap return HTTP 410 Gone with a clean status page or JSON payload.",
  },
] as const;

export default function HomePage(): React.ReactElement {
  return (
    <div className="space-y-8">
      <ShortenerWorkbench />

      <section
        aria-label="Core architecture highlights"
        className="grid gap-4 sm:grid-cols-3"
      >
        {HIGHLIGHTS.map(({ icon: Icon, title, description }) => (
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
    </div>
  );
}
