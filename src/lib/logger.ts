import pino from "pino";

export const logger = pino({
  level:
    process.env.LOG_LEVEL ??
    (process.env.NODE_ENV === "test" ? "silent" : "info"),
  base: { service: "sniplink-dev" },
  redact: {
    paths: [
      "authorization",
      "cookie",
      "*.authorization",
      "*.cookie",
      "*.secret",
      "*.apiKey",
      "*.token",
      "*.password",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[REDACTED]",
  },
});

/** Create a child logger bound to a correlation requestId. */
export function createRequestLogger(requestId: string): pino.Logger {
  return logger.child({ requestId });
}
