/**
 * @fileoverview
 * Observability module exports.
 * OTel-first observability with traces, metrics, logs, and correlation.
 */

// Correlation context
export {
  type CorrelationContext,
  getCorrelation,
  getCorrelationId,
  runWithCorrelation,
  withUseCase,
} from "./correlation.js";
// Metrics facade
export {
  recordError,
  recordSuccess,
  recordUseCaseDuration,
  recordUseCaseRequest,
  type UseCaseMetricAttributes,
  type UseCaseOutcome,
} from "./metrics.js";
// OTel SDK initialization
export { initOtel, shutdownOtel } from "./otel.js";

// Use case observability wrapper
export {
  getTracer,
  type UseCaseObservabilityOptions,
  withUseCaseObservability,
} from "./use-case-observability.js";
