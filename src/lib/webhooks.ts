import { createHmac, timingSafeEqual } from "node:crypto";

export interface WebhookEventPayload {
  event: string;
  source: string;
  data: Record<string, unknown>;
  timestamp?: string;
}

/** Compute an HMAC-SHA256 signature prefixed with `sha256=`. */
export function signHmacSha256(body: string, secret: string): string {
  const digest = createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${digest}`;
}

/** Verify an HMAC-SHA256 signature using constant-time comparison. */
export function verifyHmacSha256(
  body: string,
  signature: string | undefined | null,
  secret: string,
): boolean {
  if (!signature || !signature.startsWith("sha256=")) {
    return false;
  }
  const expected = signHmacSha256(body, secret);
  const actualBuf = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (actualBuf.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(actualBuf, expectedBuf);
}

/** Emit an HMAC-signed JSON webhook with a bounded 4s timeout. */
export async function emitSignedWebhook(
  payload: WebhookEventPayload,
  options: {
    url?: string;
    secret?: string;
  } = {},
): Promise<{ delivered: boolean; status?: number }> {
  const targetUrl = options.url ?? process.env.WEBHOOK_URL?.trim();
  if (!targetUrl) {
    return { delivered: false };
  }

  const secret =
    options.secret ?? process.env.WEBHOOK_SECRET ?? "sniplink-dev-webhook";
  const body = JSON.stringify({
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
  const signature = signHmacSha256(body, secret);

  const response = await fetch(targetUrl, {
    method: "POST",
    signal: AbortSignal.timeout(4000),
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Event": payload.event,
      "X-Webhook-Source": payload.source,
      "X-Portfolio-Signature": signature,
    },
    body,
  });

  return { delivered: response.ok, status: response.status };
}
