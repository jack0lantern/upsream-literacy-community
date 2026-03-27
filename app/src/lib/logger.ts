import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

let requestCounter = 0;

export function createRequestLogger(pathname: string) {
  requestCounter += 1;
  return logger.child({
    requestId: `req_${Date.now()}_${requestCounter}`,
    pathname,
  });
}
