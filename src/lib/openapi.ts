import { type ZodTypeAny, z } from "zod";

interface OpenApiRouteDef {
  path: string;
  method: "get" | "post" | "put" | "patch" | "delete";
  tag: string;
  summary: string;
  requestSchema?: ZodTypeAny;
  responseDescription: string;
}

const createLinkBodySchema = z.object({
  url: z.string().url(),
  customAlias: z.string().optional(),
  ttl: z.enum(["never", "1h", "24h", "7d", "30d"]).optional(),
  maxClicks: z.number().int().positive().nullable().optional(),
  userId: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
});

const createKeyBodySchema = z.object({
  label: z.string().min(2).max(60),
  userId: z.string().optional(),
  ttl: z.enum(["24h", "7d", "30d", "never"]).optional(),
});

function zodToJsonSchema(schema: ZodTypeAny): {
  schema: Record<string, unknown>;
  optional: boolean;
} {
  let current: ZodTypeAny = schema;
  let optional = false;
  let nullable = false;

  while (
    current instanceof z.ZodOptional ||
    current instanceof z.ZodNullable ||
    current instanceof z.ZodDefault
  ) {
    if (current instanceof z.ZodOptional) {
      optional = true;
      current = current.unwrap();
    } else if (current instanceof z.ZodNullable) {
      nullable = true;
      current = current.unwrap();
    } else if (current instanceof z.ZodDefault) {
      optional = true;
      current = current._def.innerType;
    }
  }

  let json: Record<string, unknown>;
  if (current instanceof z.ZodString) {
    json = { type: "string" };
    for (const check of current._def.checks) {
      if (check.kind === "url") json.format = "uri";
      if (check.kind === "min") json.minLength = check.value;
      if (check.kind === "max") json.maxLength = check.value;
    }
  } else if (current instanceof z.ZodNumber) {
    json = { type: current.isInt ? "integer" : "number" };
    for (const check of current._def.checks) {
      if (check.kind === "min") json.minimum = check.value;
      if (check.kind === "max") json.maximum = check.value;
    }
  } else if (current instanceof z.ZodBoolean) {
    json = { type: "boolean" };
  } else if (current instanceof z.ZodEnum) {
    json = { type: "string", enum: [...current.options] };
  } else if (current instanceof z.ZodObject) {
    const shape = current.shape as Record<string, ZodTypeAny>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, fieldSchema] of Object.entries(shape)) {
      const converted = zodToJsonSchema(fieldSchema);
      properties[key] = converted.schema;
      if (!converted.optional) {
        required.push(key);
      }
    }
    json = {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  } else {
    json = { type: "object" };
  }

  if (nullable && typeof json.type === "string") {
    json = { ...json, type: [json.type, "null"] };
  }

  return { schema: json, optional };
}

/** Build an OpenAPI 3.1.0 specification from Zod schemas and route metadata. */
export function buildOpenApiSpec(options: {
  title: string;
  version: string;
  description: string;
  serverUrl: string;
  routes: OpenApiRouteDef[];
}): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of options.routes) {
    const pathEntry = paths[route.path] ?? {};
    paths[route.path] = pathEntry;
    const operation: Record<string, unknown> = {
      tags: [route.tag],
      summary: route.summary,
      responses: {
        "200": { description: route.responseDescription },
        "400": { description: "RFC 7807 Problem Details validation error" },
      },
    };

    if (route.requestSchema) {
      operation.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: zodToJsonSchema(route.requestSchema).schema,
          },
        },
      };
    }

    pathEntry[route.method] = operation;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: options.title,
      version: options.version,
      description: options.description,
    },
    servers: [{ url: options.serverUrl }],
    paths,
  };
}

/** Render interactive Scalar API documentation HTML with an offline fallback. */
export function renderOpenApiDocsHtml(options: {
  title: string;
  specUrl: string;
  spec: Record<string, unknown>;
}): string {
  const safeTitle = options.title
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const specJson = JSON.stringify(options.spec).replaceAll("</", "<\\/");

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} — OpenAPI 3.1.0</title>
  <style>
    body { margin:0; background:#020617; color:#e2e8f0; font-family: ui-sans-serif, system-ui, sans-serif; }
    .fallback { max-width:960px; margin:32px auto; padding:24px; }
    .card { background:#0f172a; border:1px solid #1e293b; border-radius:12px; padding:16px; margin-bottom:12px; }
    .badge { display:inline-block; font-family:ui-monospace,monospace; font-size:12px; font-weight:700; padding:2px 8px; border-radius:6px; background:#0284c7; color:#fff; margin-right:8px; }
    code { font-family:ui-monospace,monospace; color:#38bdf8; }
    pre { overflow:auto; background:#020617; border:1px solid #1e293b; border-radius:8px; padding:12px; font-size:12px; }
  </style>
</head>
<body>
  <script id="api-reference" data-url="${options.specUrl}"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference" onerror="window.__renderFallbackDocs && window.__renderFallbackDocs()"></script>
  <noscript>
    <div class="fallback"><h1>${safeTitle} (OpenAPI 3.1.0)</h1><pre>${specJson}</pre></div>
  </noscript>
  <div id="offline-fallback" class="fallback" hidden></div>
  <script>
    window.__SNIPLINK_SPEC__ = ${specJson};
    window.__renderFallbackDocs = function () {
      var host = document.getElementById("offline-fallback");
      if (!host) return;
      host.hidden = false;
      var spec = window.__SNIPLINK_SPEC__;
      var html = "<h1>" + spec.info.title + " · OpenAPI " + spec.openapi + "</h1><p>" + spec.info.description + "</p>";
      Object.entries(spec.paths || {}).forEach(function (entry) {
        var path = entry[0], methods = entry[1];
        Object.entries(methods).forEach(function (m) {
          html += '<div class="card"><span class="badge">' + m[0].toUpperCase() + '</span><code>' + path + '</code><p>' + (m[1].summary || "") + "</p></div>";
        });
      });
      host.innerHTML = html;
    };
    setTimeout(function () {
      if (!document.querySelector(".scalar-app") && !document.querySelector("[data-v-app]")) {
        window.__renderFallbackDocs();
      }
    }, 1800);
  </script>
</body>
</html>`;
}

export function getSnipLinkOpenApiSpec(
  serverUrl = "http://localhost:3001",
): Record<string, unknown> {
  return buildOpenApiSpec({
    title: "SnipLink Dev API",
    version: "2.0.0",
    description:
      "Developer URL shortener with Base62 slugs, SSRF-safe OpenGraph previews, HTTP 302 telemetry, 410 Gone TTL enforcement, RFC 7807 errors, and SHA-256 API keys.",
    serverUrl,
    routes: [
      {
        path: "/api/links",
        method: "get",
        tag: "Links",
        summary:
          "List short links with optional status, userId, and search query filters",
        responseDescription: "List of links and summary KPI counts",
      },
      {
        path: "/api/links",
        method: "post",
        tag: "Links",
        summary:
          "Create or deduplicate a short link and emit optional signed link.created webhook",
        requestSchema: createLinkBodySchema,
        responseDescription: "Created or deduplicated short link payload",
      },
      {
        path: "/api/links/{slug}/stats",
        method: "get",
        tag: "Analytics",
        summary:
          "Fetch 14-day click histogram, device/browser breakdowns, and SVG/PNG QR codes",
        responseDescription: "Link telemetry and QR code data",
      },
      {
        path: "/api/links/cleanup",
        method: "delete",
        tag: "Links",
        summary: "Deactivate or purge expired links (?purge=true)",
        responseDescription: "Cleanup summary with affected slugs",
      },
      {
        path: "/api/og-preview",
        method: "get",
        tag: "OpenGraph",
        summary: "Fetch SSRF-guarded OpenGraph metadata for ?url=",
        responseDescription: "Sanitized OpenGraph preview payload",
      },
      {
        path: "/api/keys",
        method: "get",
        tag: "API Keys",
        summary: "List masked API keys",
        responseDescription: "Masked API key metadata list",
      },
      {
        path: "/api/keys",
        method: "post",
        tag: "API Keys",
        summary: "Mint a new slk_live_* API key (stored as SHA-256 hash)",
        requestSchema: createKeyBodySchema,
        responseDescription:
          "Newly minted plaintext key (shown once) and masked record",
      },
      {
        path: "/api/health",
        method: "get",
        tag: "System",
        summary: "Standardized service health and SQLite latency check",
        responseDescription: "Health status payload",
      },
    ],
  });
}
