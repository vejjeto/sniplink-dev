import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export interface ProblemFieldError {
  field: string;
  message: string;
}

export interface ProblemDetailsBody {
  type: string;
  title: string;
  status: number;
  detail: string;
  requestId: string;
  errors?: ProblemFieldError[];
}

const STATUS_TITLES: Record<number, { type: string; title: string }> = {
  400: { type: "https://httpstatuses.io/400", title: "Bad Request" },
  401: { type: "https://httpstatuses.io/401", title: "Unauthorized" },
  404: { type: "https://httpstatuses.io/404", title: "Not Found" },
  409: { type: "https://httpstatuses.io/409", title: "Conflict" },
  410: { type: "https://httpstatuses.io/410", title: "Gone" },
  429: { type: "https://httpstatuses.io/429", title: "Too Many Requests" },
  500: { type: "https://httpstatuses.io/500", title: "Internal Server Error" },
};

/** Resolve an existing x-request-id header or allocate a new UUID. */
export function resolveRequestId(headers?: Headers): string {
  const incoming = headers?.get("x-request-id")?.trim();
  return incoming && incoming.length > 0 ? incoming : randomUUID();
}

/** Build an RFC 7807 application/problem+json response with x-request-id. */
export function problemResponse(options: {
  status: number;
  detail: string;
  requestId: string;
  title?: string;
  type?: string;
  errors?: ProblemFieldError[];
  headers?: Record<string, string>;
}): NextResponse {
  const defaults = STATUS_TITLES[options.status] ?? {
    type: `https://httpstatuses.io/${options.status}`,
    title: "Error",
  };

  const body: ProblemDetailsBody = {
    type: options.type ?? defaults.type,
    title: options.title ?? defaults.title,
    status: options.status,
    detail: options.detail,
    requestId: options.requestId,
    ...(options.errors && options.errors.length > 0
      ? { errors: options.errors }
      : {}),
  };

  return NextResponse.json(body, {
    status: options.status,
    headers: {
      "Content-Type": "application/problem+json",
      "x-request-id": options.requestId,
      ...(options.headers ?? {}),
    },
  });
}

/** Build a JSON response with x-request-id header attached. */
export function jsonWithRequestId<T>(
  data: T,
  requestId: string,
  init: { status?: number; headers?: Record<string, string> } = {},
): NextResponse {
  return NextResponse.json(data, {
    status: init.status ?? 200,
    headers: {
      "x-request-id": requestId,
      ...(init.headers ?? {}),
    },
  });
}
