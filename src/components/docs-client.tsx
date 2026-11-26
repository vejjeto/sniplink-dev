"use client";

import { useUiToast } from "@/components/toast-provider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound, Loader2, Plus, Terminal } from "lucide-react";
import { useEffect, useState } from "react";

interface MaskedApiKey {
  id: number;
  keyPrefix: string;
  label: string;
  userId: string;
  expiresAt: string | null;
  createdAt: string;
}

function CopyableCodeBlock({
  title,
  code,
}: {
  title: string;
  code: string;
}): React.ReactElement {
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-slate-100 dark:border-slate-800">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2">
        <span className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <Terminal className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
          {title}
        </span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          aria-label={`Copy ${title} snippet`}
          className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-800"
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-sky-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function DocsClient(): React.ReactElement {
  const queryClient = useQueryClient();
  const { pushToast } = useUiToast();

  const [origin, setOrigin] = useState("http://localhost:3001");
  const [label, setLabel] = useState("CI Release Pipeline");
  const [ttl, setTtl] = useState<"24h" | "7d" | "30d" | "never">("30d");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const keysQuery = useQuery<MaskedApiKey[]>({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const res = await fetch("/api/keys");
      if (!res.ok) {
        throw new Error("Failed to load existing API keys.");
      }
      const data = (await res.json()) as { keys?: MaskedApiKey[] };
      return data.keys ?? [];
    },
  });

  const generateKeyMutation = useMutation({
    mutationFn: async (payload: {
      label: string;
      userId: string;
      ttl: "24h" | "7d" | "30d" | "never";
    }): Promise<{ apiKey: string; key?: MaskedApiKey | undefined }> => {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        apiKey?: string;
        key?: MaskedApiKey;
        detail?: string;
        error?: string;
      };
      if (!res.ok || !data.apiKey) {
        throw new Error(
          data.detail ?? data.error ?? "Could not create API key.",
        );
      }
      return { apiKey: data.apiKey, key: data.key };
    },
    onSuccess: (data) => {
      setGeneratedKey(data.apiKey);
      if (data.key) {
        queryClient.setQueryData<MaskedApiKey[]>(["api-keys"], (prev) =>
          prev ? [data.key!, ...prev] : [data.key!],
        );
      }
      void queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      pushToast({
        title: "API key generated",
        description:
          "Copy the plaintext key now; only its SHA-256 hash is stored.",
        variant: "success",
      });
    },
    onError: (err) => {
      pushToast({
        title: "API key generation failed",
        description:
          err instanceof Error
            ? err.message
            : "Network error while generating API key.",
        variant: "error",
      });
    },
  });

  function handleGenerateKey(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    generateKeyMutation.mutate({ label, userId: "dev-team", ttl });
  }

  async function copyGeneratedKey(): Promise<void> {
    if (!generatedKey) return;
    await navigator.clipboard.writeText(generatedKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 1600);
  }

  const keys = keysQuery.data ?? [];
  const loadingKeys = keysQuery.isPending;
  const creating = generateKeyMutation.isPending;
  const error =
    generateKeyMutation.error instanceof Error
      ? generateKeyMutation.error.message
      : keysQuery.error instanceof Error
        ? keysQuery.error.message
        : null;

  const activeBearer = generatedKey ?? "slk_live_demo00000000000000000001";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Developer API &amp; Key Management
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Generate temporary SHA-256 hashed API keys for Campaign Mode or test
          the REST endpoints directly from your terminal.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-sky-500" aria-hidden="true" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Live API Key Generator
          </h2>
        </div>

        <form
          onSubmit={handleGenerateKey}
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_160px_auto]"
        >
          <div>
            <label htmlFor="key-label" className="sr-only">
              Key Label
            </label>
            <input
              id="key-label"
              type="text"
              required
              minLength={2}
              maxLength={60}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. GitHub Actions Deploy"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="key-ttl" className="sr-only">
              Key Expiration
            </label>
            <select
              id="key-ttl"
              value={ttl}
              onChange={(e) =>
                setTtl(e.target.value as "24h" | "7d" | "30d" | "never")
              }
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="24h">24 hours</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="never">No expiry</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Generate Key
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-3 text-xs text-rose-500">
            {error}
          </p>
        )}

        {generatedKey && (
          <output className="mt-4 block rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              Plaintext key shown once (stored as SHA-256 hash only):
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950 px-3 py-2">
              <code className="text-xs text-emerald-300">{generatedKey}</code>
              <button
                type="button"
                onClick={() => void copyGeneratedKey()}
                className="inline-flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-xs text-white hover:bg-slate-700"
              >
                {copiedKey ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copiedKey ? "Copied" : "Copy"}
              </button>
            </div>
          </output>
        )}

        <div className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Issued Keys (Masked)
          </h3>
          {loadingKeys ? (
            <div className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          ) : (
            <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 text-xs dark:divide-slate-800 dark:border-slate-800">
              {keys.map((k) => (
                <li
                  key={k.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                >
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {k.label}
                    </span>
                    <span className="ml-2 font-mono text-slate-500">
                      {k.keyPrefix}••••••••
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-500">
                    <span className="font-mono">@{k.userId}</span>
                    <span>
                      {k.expiresAt
                        ? `Expires ${new Date(k.expiresAt).toLocaleDateString()}`
                        : "Never expires"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Copyable cURL Snippets
        </h2>

        <CopyableCodeBlock
          title="POST /api/links — Create Campaign Short Link"
          code={`curl -X POST "${origin}/api/links" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${activeBearer}" \\
  -d '{
    "url": "https://nextjs.org/docs/app",
    "customAlias": "next-app-docs",
    "ttl": "7d",
    "maxClicks": 250
  }'`}
        />

        <CopyableCodeBlock
          title="GET /api/links/:slug/stats — Fetch 14-Day Telemetry & QR"
          code={`curl "${origin}/api/links/nextjs-15/stats"`}
        />

        <CopyableCodeBlock
          title="DELETE /api/links/cleanup — Deactivate Expired Links"
          code={`curl -X DELETE "${origin}/api/links/cleanup"`}
        />
      </section>
    </div>
  );
}
