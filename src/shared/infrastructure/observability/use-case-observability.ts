/**
 * @fileoverview
 * Use case observability wrapper - creates span, logs entry/exit/error, records metrics.
 * Wraps use case execution at adapter boundary (NOT in application layer).
 *
 * DESIGN:
 * - Span: usecase.<name> with attributes (use_case, correlation_id, request_id)
 * - Logs: entry, exit, error with traceId/spanId/correlationId/durationMs
 * - Metrics: counter + histogram per use case
 * - PII redaction via redact function
 * - Error classification via errorType
 */

import { context, type Span, type Tracer, trace } from "@opentelemetry/api";
import { redact } from "../logging/pii-redactor.js";
import { getCorrelation } from "./correlation.js";
import { recordError, recordSuccess } from "./metrics.js";

// ============================================
// Configuration
// ============================================

/** Minimal logger interface compatible with Pino and Fastify request.log */
export interface UseCaseLogger {
  info(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

/**
 * Options for use case observability wrapper
 */
export interface UseCaseObservabilityOptions {
  /** Use case name (stable identifier, e.g., "Payments.CreatePaymentIntent") */
  useCase: string;
  /** OpenTelemetry tracer */
  tracer: Tracer;
  /** Logger (Pino or Fastify request.log) */
  logger: UseCaseLogger;
  /** Function to get current time (injectable for testing) */
  now?: () => number;
}

// ============================================
// Error Classification
// ============================================

/**
 * Classify error into stable errorType for metrics
 */
const classifyError = (error: unknown): string => {
  if (typeof error !== "object" || error === null) {
    return "UNKNOWN";
  }

  // Domain errors have _tag property
  if ("_tag" in error && typeof error._tag === "string") {
    return error._tag;
  }

  // Standard Error types
  if (error instanceof Error) {
    return error.name;
  }

  return "UNKNOWN";
};

// ============================================
// Trace Context Helpers
// ============================================

/**
 * Extract trace ID and span ID from active span
 */
const getTraceContext = (span: Span) => {
  const spanContext = span.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
};

// ============================================
// Wrapper API
// ============================================

/**
 * Wrap a use case execution with observability:
 * - Creates a span named "usecase.<name>"
 * - Logs entry, exit, and errors with correlation context
 * - Records metrics (counter + histogram)
 * - Redacts PII from logs
 *
 * @param options - Configuration for observability
 * @returns Wrapper function for async execution
 *
 * @example
 * ```ts
 * const wrapper = withUseCaseObservability({
 *   useCase: 'Payments.CreatePaymentIntent',
 *   tracer: trace.getTracer('mobility-transactions'),
 *   logger: request.log,
 * });
 *
 * const result = await wrapper(async () => {
 *   return useCases.createPaymentIntent.execute(input);
 * });
 * ```
 */
export const withUseCaseObservability = (
  options: UseCaseObservabilityOptions
) => {
  const { useCase, tracer, logger, now = Date.now } = options;

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    const startTime = now();
    const correlation = getCorrelation();

    // Create span with use case name
    const spanName = `usecase.${useCase}`;
    const span = tracer.startSpan(spanName, {
      attributes: {
        use_case: useCase,
        correlation_id: correlation?.correlationId ?? "unknown",
        request_id: correlation?.requestId ?? "unknown",
        ...(correlation?.userId && { user_id: correlation.userId }),
        ...(correlation?.role && { user_role: correlation.role }),
      },
    });

    // Execute within span context
    return context.with(trace.setSpan(context.active(), span), async () => {
      const { traceId, spanId } = getTraceContext(span);

      try {
        // Log entry
        logger.info(
          redact({
            event: "use_case_start",
            useCase,
            correlationId: correlation?.correlationId,
            requestId: correlation?.requestId,
            traceId,
            spanId,
          }) as Record<string, unknown>,
          `Use case started: ${useCase}`
        );

        // Execute use case
        const result = await fn();

        // Success path
        const durationMs = now() - startTime;

        // Log exit
        logger.info(
          redact({
            event: "use_case_complete",
            useCase,
            correlationId: correlation?.correlationId,
            requestId: correlation?.requestId,
            traceId,
            spanId,
            durationMs,
          }) as Record<string, unknown>,
          `Use case completed: ${useCase} (${durationMs}ms)`
        );

        // Record metrics
        recordSuccess(useCase, durationMs);

        // Set span status OK
        span.setStatus({ code: 1 }); // OK = 1

        return result;
      } catch (error) {
        // Error path
        const durationMs = now() - startTime;
        const errorType = classifyError(error);

        // Log error
        logger.error(
          redact({
            event: "use_case_error",
            useCase,
            correlationId: correlation?.correlationId,
            requestId: correlation?.requestId,
            traceId,
            spanId,
            durationMs,
            errorType,
            errorMessage:
              error instanceof Error ? error.message : String(error),
          }) as Record<string, unknown>,
          `Use case failed: ${useCase} (${durationMs}ms) - ${errorType}`
        );

        // Record metrics
        recordError(useCase, durationMs, errorType);

        // Set span status ERROR
        span.setStatus({
          code: 2, // ERROR = 2
          message: error instanceof Error ? error.message : String(error),
        });

        // Record exception on span
        if (error instanceof Error) {
          span.recordException(error);
        }

        // Re-throw to preserve error handling
        throw error;
      } finally {
        // Always end span
        span.end();
      }
    });
  };
};

/**
 * Get a tracer instance for use case instrumentation
 *
 * @param name - Tracer name (typically service name)
 * @returns Tracer instance
 */
export const getTracer = (name = "mobility-transactions"): Tracer => {
  return trace.getTracer(name);
};
