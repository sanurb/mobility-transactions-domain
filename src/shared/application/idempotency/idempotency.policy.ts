/**
 * Idempotency Policy
 *
 * Canonical idempotency contract for critical write operations.
 * Enforces that correlationId must be provided by caller (no internal generation).
 */

import { Result } from "../../core/result.js";
import { ValidationError } from "../../errors/error-types.js";

/**
 * Idempotency Policy Interface
 */
export interface IdempotencyPolicy {
  /**
   * Require and validate a correlation ID
   *
   * @param input - Correlation ID (may be undefined)
   * @returns Result with validated correlation ID or validation error
   */
  requireCorrelationId(
    input: string | undefined
  ): Result<string, ValidationError>;

  /**
   * Normalize a correlation ID
   *
   * @param input - Raw correlation ID
   * @returns Result with normalized correlation ID or validation error
   */
  normalizeCorrelationId(input: string): Result<string, ValidationError>;
}

/**
 * Standard Idempotency Policy Implementation
 */
export class StandardIdempotencyPolicy implements IdempotencyPolicy {
  requireCorrelationId(
    input: string | undefined
  ): Result<string, ValidationError> {
    if (!input) {
      return Result.err(
        new ValidationError(
          "Correlation ID is required for idempotent operations"
        )
      );
    }

    return this.normalizeCorrelationId(input);
  }

  normalizeCorrelationId(input: string): Result<string, ValidationError> {
    const trimmed = input.trim();

    if (trimmed.length === 0) {
      return Result.err(new ValidationError("Correlation ID cannot be empty"));
    }

    if (trimmed.length > 255) {
      return Result.err(
        new ValidationError("Correlation ID cannot exceed 255 characters")
      );
    }

    return Result.ok(trimmed);
  }
}

/**
 * Factory function to create an idempotency policy
 */
export const createIdempotencyPolicy = (): IdempotencyPolicy => {
  return new StandardIdempotencyPolicy();
};
