/**
 * @fileoverview
 * Pino logger configuration and factory.
 * Responsibility: create and provide a shared logger with structured JSON and PII redaction.
 * Boundaries: reads from config for level/pretty; uses pii-redactor serializers and redact.
 * Invariants: single shared instance via {@link getLogger}; all log output passes through redaction.
 */

import { context, trace } from "@opentelemetry/api";
import type { Logger } from "pino";
import pino from "pino";
import { config } from "../../../config/index.js";
import { Singleton } from "../../core/singleton.js";
import { getCorrelation } from "../observability/correlation.js";
import { redact, safeSerializers } from "./pii-redactor.js";

const DEFAULT_SERVICE_NAME = "mobility-transactions";
const DEFAULT_NODE_ENV = "development";
const REDACT_CENSOR = "[REDACTED]";
const PINO_PRETTY_TARGET = "pino-pretty";
const PINO_PRETTY_IGNORE = "pid,hostname";
const PINO_PRETTY_TRANSLATE_TIME = "SYS:standard";

const PINO_REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
  "*.password",
  "*.secret",
  "*.token",
  "*.apiKey",
  "*.email",
  "*.phone",
  "*.cardNumber",
  "*.providerRef",
  "*.provider_ref",
  "*.paymentToken",
  "*.payment_token",
  "*.idempotencyKey",
  "*.idempotency_key",
] as const;

export type LoggerOptions = {
  readonly level?: string;
  readonly pretty?: boolean;
  readonly serviceName?: string;
};

const readNodeEnv = (): string => process.env.NODE_ENV ?? DEFAULT_NODE_ENV;

const shouldPrettyPrint = (
  explicitPretty: boolean | undefined,
  nodeEnv: string
): boolean => {
  if (explicitPretty != null) {
    return explicitPretty;
  }

  // Pretty only in development and only on interactive terminals.
  // Avoid pretty logs in CI or redirected output.
  const isDev = nodeEnv === "development";
  const isTTY = Boolean(process.stdout.isTTY);
  return isDev && isTTY;
};

const buildBaseConfig = (
  level: string,
  serviceName: string,
  nodeEnv: string
): pino.LoggerOptions => {
  return {
    level,
    serializers: safeSerializers,
    base: {
      service: serviceName,
      env: nodeEnv,
    },
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => ({
        pid: bindings.pid,
        host: bindings.hostname,
      }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [...PINO_REDACT_PATHS],
      censor: REDACT_CENSOR,
    },
    mixin() {
      const span = trace.getSpan(context.active());
      const sc = span?.spanContext();
      const c = getCorrelation();

      return {
        ...(c?.requestId && { request_id: c.requestId }),
        ...(c?.correlationId && { correlation_id: c.correlationId }),
        ...(c?.useCase && { use_case: c.useCase }),
        ...(sc?.traceId && { trace_id: sc.traceId }),
        ...(sc?.spanId && { span_id: sc.spanId }),
      };
    },
  };
};

const buildPrettyTransport = (): pino.TransportSingleOptions => {
  return {
    target: PINO_PRETTY_TARGET,
    options: {
      colorize: true,
      translateTime: PINO_PRETTY_TRANSLATE_TIME,
      singleLine: true,
      messageKey: "msg",
      levelFirst: true,
      ignore: PINO_PRETTY_IGNORE,
    },
  };
};

export const createLogger = (options: LoggerOptions = {}): Logger => {
  const nodeEnv = readNodeEnv();

  const serviceName = options.serviceName ?? DEFAULT_SERVICE_NAME;
  const level = options.level ?? config.logging.level;

  const configPretty = config.logging.pretty;
  const pretty = shouldPrettyPrint(options.pretty ?? configPretty, nodeEnv);

  const baseConfig = buildBaseConfig(level, serviceName, nodeEnv);

  if (!pretty) {
    return pino(baseConfig);
  }

  return pino({
    ...baseConfig,
    transport: buildPrettyTransport(),
  });
};

const loggerSingleton = new Singleton<Logger>(() => createLogger());

export const getLogger = (): Logger => loggerSingleton.get();

export const createChildLogger = (
  bindings: Record<string, unknown>
): Logger => {
  return getLogger().child(redact(bindings) as Record<string, unknown>);
};

type LogSafeFn = (obj: Record<string, unknown>, msg?: string) => void;

const makeLogSafeFn =
  (level: "trace" | "debug" | "info" | "warn" | "error" | "fatal"): LogSafeFn =>
  (obj, msg) => {
    getLogger()[level](redact(obj) as Record<string, unknown>, msg);
  };

export const logSafe = {
  trace: makeLogSafeFn("trace"),
  debug: makeLogSafeFn("debug"),
  info: makeLogSafeFn("info"),
  warn: makeLogSafeFn("warn"),
  error: makeLogSafeFn("error"),
  fatal: makeLogSafeFn("fatal"),
} as const;

export const logger = getLogger();
