/**
 * Payment Settlement Policy - Pure Domain Logic
 *
 * Enforces business rules for settlement attempts:
 * 1. Anti-duplication: Block attempts after SUCCEEDED
 * 2. Attempt limit: Maximum 3 attempts per ride
 * 3. DECLINED handling: Require rider action before retry
 *
 * All functions are pure - no I/O, no side effects.
 */

import { Result } from "../../../shared/core/result.js";
import { PolicyViolationError } from "../../../shared/errors/error-types.js";
import {
  PAYMENT_POLICY,
  SETTLEMENT_OUTCOMES,
  type SettlementOutcome,
} from "./payment-types.js";

/**
 * Structural type for settlement attempts used in policy functions.
 * Works with both SettlementAttempt entity and SettlementAttempt DTO.
 */
export interface SettlementAttemptLike {
  readonly outcome: SettlementOutcome;
}

/**
 * Parameters for checking if a settlement attempt is allowed
 */
export interface CanAttemptParams {
  /** Prior settlement attempts for this payment intent */
  readonly priorAttempts: readonly SettlementAttemptLike[];
  /** Whether the rider has acknowledged a DECLINED outcome */
  readonly riderAcknowledgedDecline?: boolean;
}

/**
 * Check if a new settlement attempt is allowed based on policy rules
 *
 * Policy rules checked in order:
 * 1. PAYMENT_ANTI_DUPLICATION - Block if any prior attempt SUCCEEDED
 * 2. PAYMENT_ATTEMPT_LIMIT - Block if MAX_ATTEMPTS already made
 * 3. PAYMENT_DECLINED_ACTION_REQUIRED - Block if last attempt was DECLINED and rider hasn't acknowledged
 *
 * @param params - Prior attempts and acknowledgment status
 * @returns Result with true on success, PolicyViolationError on failure
 */
export const canAttemptSettlement = (
  params: CanAttemptParams
): Result<true, PolicyViolationError> => {
  const { priorAttempts, riderAcknowledgedDecline = false } = params;

  // Rule 1: Anti-duplication - Block if already succeeded
  const hasSucceeded = priorAttempts.some(
    (attempt) => attempt.outcome === SETTLEMENT_OUTCOMES.SUCCEEDED
  );
  if (hasSucceeded) {
    return Result.err(
      new PolicyViolationError(
        "PAYMENT_ANTI_DUPLICATION",
        "Settlement already succeeded for this payment intent"
      )
    );
  }

  // Rule 2: Attempt limit - Block if max attempts exceeded
  if (priorAttempts.length >= PAYMENT_POLICY.MAX_ATTEMPTS) {
    return Result.err(
      new PolicyViolationError(
        "PAYMENT_ATTEMPT_LIMIT",
        `Maximum ${PAYMENT_POLICY.MAX_ATTEMPTS} settlement attempts exceeded`
      )
    );
  }

  // Rule 3: DECLINED handling - Require rider action before retry
  const lastAttempt = priorAttempts.at(-1);
  if (
    lastAttempt?.outcome === SETTLEMENT_OUTCOMES.DECLINED &&
    !riderAcknowledgedDecline
  ) {
    return Result.err(
      new PolicyViolationError(
        "PAYMENT_DECLINED_ACTION_REQUIRED",
        "Rider action required after declined payment"
      )
    );
  }

  return Result.ok(true);
};

/**
 * Calculate the next attempt number based on prior attempts
 *
 * @param priorAttempts - Array of prior settlement attempts
 * @returns The next 1-indexed attempt number
 */
export const getNextAttemptNumber = (
  priorAttempts: readonly SettlementAttemptLike[]
): number => {
  return priorAttempts.length + 1;
};

/**
 * Payment status derived from settlement attempts
 */
export type PaymentStatus = "PAID" | "UNPAID";

/**
 * Derive the payment status from settlement attempts
 *
 * PAID: At least one SUCCEEDED settlement attempt exists
 * UNPAID: No SUCCEEDED settlement attempt exists
 *
 * @param attempts - Array of settlement attempts
 * @returns PaymentStatus indicating whether payment was successful
 */
export const derivePaymentStatus = (
  attempts: readonly SettlementAttemptLike[]
): PaymentStatus => {
  const hasSucceeded = attempts.some(
    (attempt) => attempt.outcome === SETTLEMENT_OUTCOMES.SUCCEEDED
  );
  return hasSucceeded ? "PAID" : "UNPAID";
};

/**
 * Re-export MAX_SETTLEMENT_ATTEMPTS for convenience
 */
export const MAX_SETTLEMENT_ATTEMPTS = PAYMENT_POLICY.MAX_ATTEMPTS;

/**
 * Determine if a settlement outcome is retryable without rider action.
 *
 * - SUCCEEDED: terminal — no retry
 * - FAILED / UNKNOWN: retryable (transient errors)
 * - DECLINED: requires rider action — not automatically retryable
 * - PENDING: transitional — treat as non-retryable
 */
export const isRetryable = (outcome: SettlementOutcome): boolean =>
  outcome === SETTLEMENT_OUTCOMES.FAILED ||
  outcome === SETTLEMENT_OUTCOMES.UNKNOWN;
