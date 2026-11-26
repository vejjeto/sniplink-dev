import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "SnipLink Dev — Developer URL Shortener, TTL & Click Telemetry",
  description:
    "Zero-friction URL shortener with Base62 slugs, SSRF protection, HTTP 302 click analytics, 410 Gone TTL enforcement, and instant QR codes.",
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("sniplink-theme")||localStorage.getItem("theme");if(t==="light"){document.documentElement.classList.remove("dark");}else{document.documentElement.classList.add("dark");}}catch(e){document.documentElement.classList.add("dark");}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactElement {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: inline theme init prevents dark-mode FOUC */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <Providers>
          <SiteHeader />
          <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
