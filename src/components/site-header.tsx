"use client";

import { HealthBadge } from "@/components/health-badge";
import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/lib/i18n";
import { BarChart3, BookOpen, Link2, Moon, Sparkles, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function SiteHeader(): React.ReactElement {
  const pathname = usePathname();
  const { t } = useLocale();
  const [dark, setDark] = useState(true);

  const navItems = [
    { href: "/", label: t.nav.shortener, icon: Link2 },
    { href: "/demo", label: t.nav.demo, icon: Sparkles },
    { href: "/dashboard", label: t.nav.dashboard, icon: BarChart3 },
    { href: "/docs", label: t.nav.docs, icon: BookOpen },
  ] as const;

  useEffect(() => {
    const stored =
      window.localStorage.getItem("sniplink-theme") ??
      window.localStorage.getItem("theme");
    const isDark = stored !== "light";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggleTheme(): void {
    const next = !dark;
    setDark(next);
    const mode = next ? "dark" : "light";
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("sniplink-theme", mode);
    window.localStorage.setItem("theme", mode);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-slate-900 dark:text-slate-100"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600 text-white shadow-sm">
              <Link2 className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="font-semibold tracking-tight">SnipLink Dev</span>
          </Link>
          <span className="hidden sm:inline-flex">
            <HealthBadge endpoint="/api/health" />
          </span>
        </div>

        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-1 sm:gap-2"
        >
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition sm:px-3 sm:text-sm ${
                  active
                    ? "bg-sky-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="hidden xs:inline sm:inline">{label}</span>
              </Link>
            );
          })}

          <LanguageToggle />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {dark ? (
              <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}
