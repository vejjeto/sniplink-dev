"use client";

import {
  Activity,
  BarChart3,
  BookOpen,
  FileCode2,
  Link2,
  Moon,
  Search,
  Sparkles,
  Sun,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

interface PaletteCommand {
  id: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

/** Keyboard-driven command palette (Ctrl+K / Cmd+K) for SnipLink navigation and theme toggle. */
export function CommandPalette(): React.ReactElement | null {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dark, setDark] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    function onKeyDown(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const commands = useMemo<PaletteCommand[]>(() => {
    const navigate = (href: string, external = false) => {
      setOpen(false);
      setQuery("");
      if (external) {
        window.open(href, "_blank", "noopener,noreferrer");
      } else {
        router.push(href);
      }
    };

    return [
      {
        id: "home",
        label: "Shortener Workbench",
        hint: "/",
        icon: Link2,
        action: () => navigate("/"),
      },
      {
        id: "demo",
        label: "Instant Demo (No Login)",
        hint: "/demo",
        icon: Sparkles,
        action: () => navigate("/demo"),
      },
      {
        id: "dashboard",
        label: "Analytics Dashboard",
        hint: "/dashboard",
        icon: BarChart3,
        action: () => navigate("/dashboard"),
      },
      {
        id: "docs",
        label: "Developer API & Keys",
        hint: "/docs",
        icon: BookOpen,
        action: () => navigate("/docs"),
      },
      {
        id: "openapi",
        label: "OpenAPI Interactive Reference",
        hint: "/api/docs",
        icon: FileCode2,
        action: () => navigate("/api/docs", true),
      },
      {
        id: "health",
        label: "Service Health JSON",
        hint: "/api/health",
        icon: Activity,
        action: () => navigate("/api/health", true),
      },
      {
        id: "theme",
        label: dark ? "Switch to Light Mode" : "Switch to Dark Mode",
        hint: "Theme",
        icon: dark ? Sun : Moon,
        action: () => {
          const next = !dark;
          setDark(next);
          const mode = next ? "dark" : "light";
          document.documentElement.classList.toggle("dark", next);
          window.localStorage.setItem("sniplink-theme", mode);
          window.localStorage.setItem("theme", mode);
          setOpen(false);
          setQuery("");
        },
      },
    ];
  }, [dark, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.hint.toLowerCase().includes(q),
    );
  }, [commands, query]);

  if (!open) return null;

  return (
    <dialog
      open
      aria-label="Command Palette"
      className="fixed inset-0 z-50 m-0 flex h-full w-full max-w-none items-start justify-center border-0 bg-slate-950/70 px-4 pt-24 backdrop-blur-sm"
    >
      <button
        type="button"
        aria-label="Close command palette"
        onClick={() => setOpen(false)}
        className="fixed inset-0 cursor-default bg-transparent"
      />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or route..."
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
          />
          <kbd className="rounded border border-slate-300 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:border-slate-700">
            ESC
          </kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-slate-500">
              No matching commands.
            </li>
          ) : (
            filtered.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <li key={cmd.id}>
                  <button
                    type="button"
                    onClick={cmd.action}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon
                        className="h-4 w-4 text-sky-500"
                        aria-hidden="true"
                      />
                      <span>{cmd.label}</span>
                    </span>
                    <span className="font-mono text-xs text-slate-400">
                      {cmd.hint}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </dialog>
  );
}
