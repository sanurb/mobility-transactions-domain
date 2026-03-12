import type { Counter, Histogram, Meter } from "@opentelemetry/api";
import { metrics } from "@opentelemetry/api";
import type { FastifyReply, FastifyRequest } from "fastify";

const REQUESTS_TOTAL = "mobility_http_requests_total";
const REQUEST_DURATION_MS = "mobility_http_request_duration_ms";
const UNKNOWN_ROUTE = "unknown";
const HEALTH_PATH_PREFIX = "/api/v1/health";
const METRICS_PATH_PREFIX = "/metrics";

let meter: Meter | null = null;
let requestsTotal: Counter | null = null;
let requestDurationMs: Histogram | null = null;

interface HttpMetricAttributes {
  http_method: string;
  http_route: string;
  http_status_code: number;
}

const shouldIgnorePath = (url: string): boolean => {
  return (
    url.startsWith(HEALTH_PATH_PREFIX) || url.startsWith(METRICS_PATH_PREFIX)
  );
};

const initHttpMetrics = (): void => {
  if (meter !== null) {
    return;
  }

  meter = metrics.getMeter("mobility-transactions");
  requestsTotal = meter.createCounter(REQUESTS_TOTAL, {
    description: "Total HTTP requests by route, method, and status code",
    unit: "1",
  });
  requestDurationMs = meter.createHistogram(REQUEST_DURATION_MS, {
    description:
      "HTTP request duration in milliseconds by route, method, and status code",
    unit: "ms",
  });
};

const getAttributes = (
  request: FastifyRequest,
  reply: FastifyReply
): HttpMetricAttributes => {
  const route = request.routeOptions.url ?? UNKNOWN_ROUTE;
  return {
    http_method: request.method,
    http_route: route,
    http_status_code: reply.statusCode,
  };
};

export const recordHttpRequestMetrics = (
  request: FastifyRequest,
  reply: FastifyReply
): void => {
  if (shouldIgnorePath(request.url)) {
    return;
  }

  if (requestsTotal === null || requestDurationMs === null) {
    initHttpMetrics();
  }

  const attributes = getAttributes(request, reply) as unknown as Record<
    string,
    string | number | boolean
  >;
  requestsTotal?.add(1, attributes);
  requestDurationMs?.record(reply.elapsedTime, attributes);
};
