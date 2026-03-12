/**
 * @fileoverview
 * Thin facade over OpenTelemetry Meter for use-case metrics.
 * Provides stable metric names/labels for Prometheus consumption.
 *
 * DESIGN:
 * - Counter: mobility_usecase_requests_total{use_case, outcome, error_type?}
 * - Histogram: mobility_usecase_duration_ms{use_case, outcome}
 * - No custom in-memory buffers (rely on Prometheus exporter)
 * - All metrics are per-use-case (adapter boundary)
 */

import type { Counter, Histogram, Meter } from "@opentelemetry/api";
import { metrics } from "@opentelemetry/api";

// ============================================
// Metric Names (stable API)
// ============================================

const REQUESTS_TOTAL = "mobility_usecase_requests_total";
const DURATION_MS = "mobility_usecase_duration_ms";

// ============================================
// Meter Singleton
// ============================================

let meter: Meter | null = null;
let requestsCounter: Counter | null = null;
let durationHistogram: Histogram | null = null;

/**
 * Initialize metrics meter
 * Must be called after OTel SDK initialization
 */
const initMetrics = (): void => {
  if (meter) {
    return;
  }

  meter = metrics.getMeter("mobility-transactions");

  requestsCounter = meter.createCounter(REQUESTS_TOTAL, {
    description: "Total use case invocations by outcome",
    unit: "1",
  });

  durationHistogram = meter.createHistogram(DURATION_MS, {
    description: "Use case execution duration in milliseconds",
    unit: "ms",
  });
};

// ============================================
// Metric Labels
// ============================================

/**
 * Outcome of a use case invocation
 */
export type UseCaseOutcome = "success" | "error";

/**
 * Attributes for use case metrics
 */
export interface UseCaseMetricAttributes {
  /** Use case name (stable identifier) */
  use_case: string;
  /** Outcome: success or error */
  outcome: UseCaseOutcome;
  /** Error type if outcome is error (optional) */
  error_type?: string;
}

// ============================================
// Metric Recording API
// ============================================

/**
 * Record a use case request completion
 *
 * @param attributes - Metric attributes (use_case, outcome, error_type?)
 */
export const recordUseCaseRequest = (
  attributes: UseCaseMetricAttributes
): void => {
  if (!requestsCounter) {
    initMetrics();
  }

  // Type assertion needed because OTel expects Record<string, string | number | boolean>
  requestsCounter?.add(
    1,
    attributes as unknown as Record<string, string | number | boolean>
  );
};

/**
 * Record use case duration
 *
 * @param durationMs - Duration in milliseconds
 * @param attributes - Metric attributes (use_case, outcome)
 */
export const recordUseCaseDuration = (
  durationMs: number,
  attributes: Omit<UseCaseMetricAttributes, "error_type">
): void => {
  if (!durationHistogram) {
    initMetrics();
  }

  // Type assertion needed because OTel expects Record<string, string | number | boolean>
  durationHistogram?.record(
    durationMs,
    attributes as unknown as Record<string, string | number | boolean>
  );
};

/**
 * Helper: Record both request count and duration for successful use case
 *
 * @param useCase - Use case name
 * @param durationMs - Duration in milliseconds
 */
export const recordSuccess = (useCase: string, durationMs: number): void => {
  const attributes: UseCaseMetricAttributes = {
    use_case: useCase,
    outcome: "success",
  };

  recordUseCaseRequest(attributes);
  recordUseCaseDuration(durationMs, attributes);
};

/**
 * Helper: Record both request count and duration for failed use case
 *
 * @param useCase - Use case name
 * @param durationMs - Duration in milliseconds
 * @param errorType - Error type classifier
 */
export const recordError = (
  useCase: string,
  durationMs: number,
  errorType: string
): void => {
  const attributes: UseCaseMetricAttributes = {
    use_case: useCase,
    outcome: "error",
    error_type: errorType,
  };

  recordUseCaseRequest(attributes);
  recordUseCaseDuration(durationMs, { use_case: useCase, outcome: "error" });
};
