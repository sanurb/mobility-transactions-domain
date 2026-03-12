/**
 * @fileoverview
 * OpenTelemetry Node SDK bootstrap: traces, metrics, and Fastify instrumentation.
 * Single initialization; idempotent. Reads config from env.
 */

import FastifyOtelModule from "@fastify/otel";
import type { Span } from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import type { NodeSDKConfiguration } from "@opentelemetry/sdk-node";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-base";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from "@opentelemetry/semantic-conventions";
import consola from "consola";
import type { FastifyRequest, HTTPMethods } from "fastify";
import type { IncomingMessage } from "http";

const DEFAULT_SERVICE_NAME = "mobility-transactions";
const DEFAULT_SERVICE_VERSION = "dev";
const DEFAULT_ENVIRONMENT = "development";
const DEFAULT_OTLP_ENDPOINT = "http://127.0.0.1:4318";
const DEFAULT_SAMPLING_RATIO_STR = "1.0";
const EXPORT_INTERVAL_MILLIS = 10_000;
const TRACES_PATH = "/v1/traces";
const METRICS_PATH = "/v1/metrics";
const HEALTH_PATH_PREFIX = "/health";
const METRICS_PATH_PREFIX = "/metrics";
const HTTP_ROUTE_ATTR = "http.route";
const UNKNOWN_ROUTE = "unknown";

/** @see https://github.com/fastify/otel/issues/24 — ESM default export typing with export= */
type FastifyOtelCtor = new (
  opts?: import("@fastify/otel").FastifyOtelInstrumentationOpts
) => { init(): unknown[] };
const FastifyOtelInstrumentation =
  FastifyOtelModule as unknown as FastifyOtelCtor;

let sdk: NodeSDK | null = null;

function shouldIgnorePath(opts: {
  url?: string;
  method?: HTTPMethods;
}): boolean {
  const url = opts.url ?? "";
  return (
    url.startsWith(HEALTH_PATH_PREFIX) || url.startsWith(METRICS_PATH_PREFIX)
  );
}

function setRouteAttribute(span: Span, request: FastifyRequest): void {
  const route = request.routeOptions?.url ?? UNKNOWN_ROUTE;
  span.setAttribute(HTTP_ROUTE_ATTR, route);
}

function buildInstrumentations(): NodeSDKConfiguration["instrumentations"] {
  const fastifyOtel = new FastifyOtelInstrumentation({
    registerOnInitialization: true,
    ignorePaths: shouldIgnorePath,
    requestHook: setRouteAttribute,
    recordExceptions: true,
  });
  return [
    new HttpInstrumentation({
      // avoid noise
      ignoreIncomingRequestHook: (request: IncomingMessage) => {
        const url = request.url ?? "";
        return shouldIgnorePath({ url });
      },
    }),
    new PgInstrumentation({ enhancedDatabaseReporting: true }),
    fastifyOtel as unknown as NodeSDKConfiguration["instrumentations"][number],
  ];
}

export function initOtel(): void {
  if (sdk !== null) {
    return;
  }

  const serviceName = process.env.OTEL_SERVICE_NAME ?? DEFAULT_SERVICE_NAME;
  const serviceVersion = process.env.GIT_COMMIT ?? DEFAULT_SERVICE_VERSION;
  const environment = process.env.NODE_ENV ?? DEFAULT_ENVIRONMENT;
  const otlpEndpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? DEFAULT_OTLP_ENDPOINT;
  const samplingRatio = Number.parseFloat(
    process.env.OTEL_TRACES_SAMPLER_ARG ?? DEFAULT_SAMPLING_RATIO_STR
  );

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
  });

  const traceExporter = new OTLPTraceExporter({
    url: `${otlpEndpoint}${TRACES_PATH}`,
  });
  const metricExporter = new OTLPMetricExporter({
    url: `${otlpEndpoint}${METRICS_PATH}`,
  });

  sdk = new NodeSDK({
    resource,
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(samplingRatio),
    }),
    traceExporter,
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: EXPORT_INTERVAL_MILLIS,
    }),
    instrumentations: buildInstrumentations(),
  });

  sdk.start();

  consola.info(`[OTEL] Service: ${serviceName}`);
  consola.info(`[OTEL] Endpoint: ${otlpEndpoint}`);
}

/**
 * Gracefully shutdown the OTel SDK, flushing pending traces and metrics.
 * Must be called LAST in the shutdown sequence (after app and database close)
 * to capture telemetry from their shutdown operations.
 */
export async function shutdownOtel(): Promise<void> {
  if (sdk === null) {
    return;
  }
  await sdk.shutdown();
  sdk = null;
}
