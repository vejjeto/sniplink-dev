"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type ToastVariant = "success" | "error" | "info";

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastItem extends ToastInput {
  id: number;
  variant: ToastVariant;
}

interface ToastContextValue {
  pushToast: (toast: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success:
    "border-emerald-500/40 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100",
  error:
    "border-rose-500/40 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100",
  info: "border-sky-500/40 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100",
};

/** Self-contained toast notification provider. */
export function UiToastProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      const variant = input.variant ?? "info";
      setToasts((prev) => [...prev.slice(-3), { ...input, id, variant }]);
      const timer = setTimeout(() => dismiss(id), 4000);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      for (const timer of activeTimers.values()) {
        clearTimeout(timer);
      }
      activeTimers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
      >
        {toasts.map((toast) => (
          <output
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border p-3 shadow-lg ${VARIANT_STYLES[toast.variant]}`}
          >
            {toast.variant === "success" ? (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                aria-hidden="true"
              />
            ) : toast.variant === "error" ? (
              <XCircle
                className="mt-0.5 h-4 w-4 shrink-0 text-rose-500"
                aria-hidden="true"
              />
            ) : (
              <Info
                className="mt-0.5 h-4 w-4 shrink-0 text-sky-500"
                aria-hidden="true"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 truncate text-[11px] text-slate-600 dark:text-slate-400">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </output>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Hook to trigger toast notifications from client components. */
export function useUiToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useUiToast must be used within UiToastProvider");
  }
  return ctx;
}
