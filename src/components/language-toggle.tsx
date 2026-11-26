"use client";

import { useLocale } from "@/lib/i18n";
import { Globe } from "lucide-react";

export function LanguageToggle(): React.ReactElement {
  const { locale, toggleLocale } = useLocale();

  return (
    <button
      type="button"
      onClick={toggleLocale}
      aria-label="Cambiar idioma (ES/EN)"
      className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      <Globe className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{locale === "es" ? "ES" : "EN"}</span>
    </button>
  );
}
