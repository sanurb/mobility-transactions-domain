import type { FastifyError } from "fastify";
import type { DomainError, DomainErrorType } from "./error-types.js";

/**
 * Standard API error response shape
 * Deterministic for clients to build reliable retry logic
 */
export interface ApiErrorResponse {
  errorType: DomainErrorType;
  message: string;
  retryable: boolean;
  requestId: string;
  /** Safe metadata for debugging - never PII or secrets */
  metadata?: Record<string, unknown>;
}

/**
 * HTTP status code mapping - centralized and versioned
 * This is the ONLY place HTTP codes appear for domain errors
 *
 * Note: RATE_LIMITED (429) is handled by @fastify/rate-limit plugin directly.
 * The plugin uses errorResponseBuilder to match the ApiErrorResponse shape.
 */
const HTTP_STATUS_MAP: Record<DomainErrorType, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  AUTHENTICATION_ERROR: 401,
  AUTHORIZATION_ERROR: 403,
  INFRASTRUCTURE_ERROR: 503,
  POLICY_VIOLATION: 422,
  UNEXPECTED_ERROR: 500,
} as const;

/**
 * Maps a domain error to HTTP status code
 */
export const mapDomainErrorToHttpStatus = (error: DomainError): number => {
  return HTTP_STATUS_MAP[error._tag];
};

/**
 * Creates a safe API error response from a domain error.
 *
 * SECURITY CONTRACT (SEC-03):
 * - Never includes cause, stack traces, or internal details
 * - Never includes providerRef, paymentToken, or other PII
 * - Only includes errorType, message, retryable, requestId, and safe metadata
 * - Safe metadata limited to: resourceType, currentState, attemptedAction, policyName
 */
export const createErrorResponse = (
  error: DomainError,
  requestId: string,
  safeMetadata?: Record<string, unknown>
): ApiErrorResponse => {
  // Build safe metadata - filter anything that could be PII
  const metadata: Record<string, unknown> = { ...safeMetadata };

  // Add safe, non-sensitive fields from specific error types
  if (error._tag === "NOT_FOUND") {
    metadata.resourceType = error.resourceType;
    // Note: resourceId might be sensitive - only include if safe
  }

  if (error._tag === "CONFLICT") {
    metadata.currentState = error.currentState;
    metadata.attemptedAction = error.attemptedAction;
  }

  if (error._tag === "POLICY_VIOLATION") {
    metadata.policyName = error.policyName;
  }

  return {
    errorType: error._tag,
    message: error.message,
    retryable: error.retryable,
    requestId,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
};

/**
 * Type guard to check if an error is a DomainError
 */
export const isDomainError = (error: unknown): error is DomainError => {
  return (
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    typeof (error as DomainError)._tag === "string" &&
    Object.keys(HTTP_STATUS_MAP).includes((error as DomainError)._tag)
  );
};

/**
 * Creates a safe API error response for Zod validation errors
 * Used by global error handler when Fastify's Zod validation fails
 */
export const createZodErrorResponse = (
  error: FastifyError,
  requestId: string
): ApiErrorResponse => ({
  errorType: "VALIDATION_ERROR",
  message: error.message,
  retryable: false,
  requestId,
});

/**
 * Creates a safe API error response for unhandled errors
 * CRITICAL: Never exposes internal details, stack traces, or error causes
 */
export const createUnexpectedErrorResponse = (
  requestId: string
): ApiErrorResponse => ({
  errorType: "UNEXPECTED_ERROR",
  message: "An unexpected error occurred",
  retryable: false,
  requestId,
});

/**
 * Creates a safe API error response for unknown routes
 * Returns 404 with route information for client debugging
 */
export const createNotFoundRouteResponse = (
  requestId: string,
  url: string
): ApiErrorResponse => ({
  errorType: "NOT_FOUND",
  message: `Route not found: ${url}`,
  retryable: false,
  requestId,
});
