"use client";

import { useCallback, useEffect, useState } from "react";

export type Locale = "es" | "en";

const STORAGE_KEY = "sniplink-lang";
const LANG_EVENT = "sniplink-lang-change";

export interface TranslationDict {
  nav: {
    shortener: string;
    demo: string;
    dashboard: string;
    docs: string;
  };
  hero: {
    badge: string;
    title: string;
    subtitle: string;
    demoCta: string;
    dashboardCta: string;
  };
  highlights: {
    sectionLabel: string;
    telemetryTitle: string;
    telemetryDesc: string;
    ssrfTitle: string;
    ssrfDesc: string;
    ttlTitle: string;
    ttlDesc: string;
  };
  workbench: {
    urlLabel: string;
    ogPreview: string;
    shortenButton: string;
    shortening: string;
    customAliasLabel: string;
    customAliasPlaceholder: string;
    ttlLabel: string;
    ttlNever: string;
    ttl1h: string;
    ttl24h: string;
    ttl7d: string;
    ttl30d: string;
    maxClicksLabel: string;
    maxClicksPlaceholder: string;
    campaignModeLabel: string;
    campaignModeHint: string;
    anonymousModeHint: string;
    dismiss: string;
    offlineFallback: string;
    deduplicatedBadge: string;
    readyBadge: string;
    destinationLabel: string;
    copyShortUrl: string;
    copied: string;
    downloadSvg: string;
    downloadPng: string;
  };
  dashboard: {
    title: string;
    subtitle: string;
    refresh: string;
    totalLinks: string;
    totalClicks: string;
  };
  docs: {
    title: string;
    subtitle: string;
    openApiSpec: string;
  };
}

export const TRANSLATIONS: Record<Locale, TranslationDict> = {
  es: {
    nav: {
      shortener: "Acortador",
      demo: "Demo",
      dashboard: "Dashboard",
      docs: "API Docs",
    },
    hero: {
      badge: "Acortador técnico sin fricción · HTTP 302 + 410 Gone",
      title: "Shorten, track & expire links in seconds.",
      subtitle:
        "Sin muro de registro. Slugs criptográficos Base62, vistas previas OpenGraph seguras contra SSRF, expiración determinista por TTL y códigos QR SVG/PNG descargables.",
      demoCta: "Abrir Demo (Sin registro)",
      dashboardCta: "Ver Dashboard Demo",
    },
    highlights: {
      sectionLabel: "Aspectos clave de arquitectura",
      telemetryTitle: "302 Found + Telemetría Asíncrona",
      telemetryDesc:
        "Las redirecciones 302 sin caché mantienen el conteo exacto mientras queueMicrotask registra dispositivo, navegador y país sin bloquear.",
      ssrfTitle: "Protección SSRF y Slugs Base62",
      ssrfDesc:
        "Bloquea rangos IP privados/loopback y esquemas inseguros antes de guardar slugs Base62 de 7 caracteres con 5 reintentos ante colisiones.",
      ttlTitle: "TTL y Máx. Clics 410 Gone",
      ttlDesc:
        "Los enlaces que superan su fecha de expiración o límite de clics devuelven HTTP 410 Gone con página de estado o JSON.",
    },
    workbench: {
      urlLabel: "URL de destino",
      ogPreview: "Vista OG",
      shortenButton: "Shorten URL",
      shortening: "Acortando...",
      customAliasLabel: "Alias personalizado (opcional)",
      customAliasPlaceholder: "ej. launch-v2",
      ttlLabel: "Tiempo de vida (TTL)",
      ttlNever: "Sin expiración",
      ttl1h: "1 hora",
      ttl24h: "24 horas",
      ttl7d: "7 días",
      ttl30d: "30 días",
      maxClicksLabel: "Máx. clics (opcional)",
      maxClicksPlaceholder: "Ilimitado",
      campaignModeLabel: "Modo Campaña (@dev-team)",
      campaignModeHint:
        "Modo Campaña activo: crea slugs distintos por campaña bajo @dev-team incluso para URLs idénticas.",
      anonymousModeHint:
        "Modo Anónimo: las URLs estándar sin alias ni TTL se deduplican para reutilizar slugs activos.",
      dismiss: "Cerrar",
      offlineFallback: "Respaldo sin conexión",
      deduplicatedBadge: "Enlace activo reutilizado",
      readyBadge: "Enlace corto listo",
      destinationLabel: "Destino",
      copyShortUrl: "Copy Short URL",
      copied: "¡Copiado!",
      downloadSvg: "Descargar SVG",
      downloadPng: "Descargar PNG",
    },
    dashboard: {
      title: "Analytics Dashboard",
      subtitle: "Telemetría en tiempo real, filtros por campaña y exportación.",
      refresh: "Actualizar",
      totalLinks: "Enlaces totales",
      totalClicks: "Clics totales",
    },
    docs: {
      title: "Referencia de API",
      subtitle: "Endpoints REST, validación Zod y errores RFC 7807.",
      openApiSpec: "Especificación OpenAPI 3.1.0",
    },
  },
  en: {
    nav: {
      shortener: "Shortener",
      demo: "Demo",
      dashboard: "Dashboard",
      docs: "API Docs",
    },
    hero: {
      badge: "Zero-Friction URL Shortener · HTTP 302 + 410 Gone",
      title: "Shorten, track & expire links in seconds.",
      subtitle:
        "No login wall. Cryptographic Base62 slugs, SSRF-safe OpenGraph previews, deterministic TTL expiration, and downloadable SVG/PNG QR codes.",
      demoCta: "Open Demo (No signup)",
      dashboardCta: "View Demo Dashboard",
    },
    highlights: {
      sectionLabel: "Core architecture highlights",
      telemetryTitle: "302 Found + Async Telemetry",
      telemetryDesc:
        "Zero-cache 302 redirects keep click counts accurate while queueMicrotask records device, browser, and country non-blocking.",
      ssrfTitle: "SSRF Guard & Base62 Slugs",
      ssrfDesc:
        "Blocks private/loopback IP ranges and unsafe schemes before persisting 7-char crypto Base62 slugs with 5-retry collision protection.",
      ttlTitle: "TTL & Max-Clicks 410 Gone",
      ttlDesc:
        "Links past their expiration timestamp or click cap return HTTP 410 Gone with a clean status page or JSON payload.",
    },
    workbench: {
      urlLabel: "Destination URL",
      ogPreview: "OG Preview",
      shortenButton: "Shorten URL",
      shortening: "Shortening...",
      customAliasLabel: "Custom Alias (optional)",
      customAliasPlaceholder: "e.g. launch-v2",
      ttlLabel: "Time To Live (TTL)",
      ttlNever: "No expiration",
      ttl1h: "1 hour",
      ttl24h: "24 hours",
      ttl7d: "7 days",
      ttl30d: "30 days",
      maxClicksLabel: "Max Clicks (optional)",
      maxClicksPlaceholder: "Unlimited",
      campaignModeLabel: "Campaign Mode (@dev-team)",
      campaignModeHint:
        "Campaign Mode active: creates distinct slugs per campaign under @dev-team even for identical URLs.",
      anonymousModeHint:
        "Anonymous Mode: standard URLs without custom alias/TTL are deduplicated to reuse active short slugs.",
      dismiss: "Dismiss",
      offlineFallback: "Offline Fallback",
      deduplicatedBadge: "Deduplicated Active Link",
      readyBadge: "Short Link Ready",
      destinationLabel: "Destination",
      copyShortUrl: "Copy Short URL",
      copied: "Copied!",
      downloadSvg: "Download SVG",
      downloadPng: "Download PNG",
    },
    dashboard: {
      title: "Analytics Dashboard",
      subtitle: "Real-time click telemetry, campaign filters, and exports.",
      refresh: "Refresh",
      totalLinks: "Total Links",
      totalClicks: "Total Clicks",
    },
    docs: {
      title: "API Reference",
      subtitle: "REST endpoints, Zod validation, and RFC 7807 errors.",
      openApiSpec: "OpenAPI 3.1.0 Spec",
    },
  },
};

function readStoredLocale(): Locale {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "en" || stored === "es" ? stored : "es";
}

export function useLocale(): {
  locale: Locale;
  setLocale: (next: Locale) => void;
  toggleLocale: () => void;
  t: TranslationDict;
} {
  const [locale, setLocaleState] = useState<Locale>("es");

  useEffect(() => {
    const initial = readStoredLocale();
    setLocaleState(initial);
    document.documentElement.lang = initial;

    function handleLangChange(): void {
      const next = readStoredLocale();
      setLocaleState(next);
      document.documentElement.lang = next;
    }

    window.addEventListener(LANG_EVENT, handleLangChange);
    return () => {
      window.removeEventListener(LANG_EVENT, handleLangChange);
    };
  }, []);

  const setLocale = useCallback((next: Locale): void => {
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
    setLocaleState(next);
    window.dispatchEvent(new Event(LANG_EVENT));
  }, []);

  const toggleLocale = useCallback((): void => {
    setLocale(locale === "es" ? "en" : "es");
  }, [locale, setLocale]);

  return {
    locale,
    setLocale,
    toggleLocale,
    t: TRANSLATIONS[locale],
  };
}
