/**
 * Payment Domain Types - Pure Domain Types
 *
 * Defines types for payment orchestration including:
 * - Settlement outcomes (canonical states)
 * - Payment Intent (immutable binding to ride)
 * - Settlement Attempt (audit trail for each attempt)
 *
 * Following project patterns:
 * - as const objects instead of enums
 * - All interfaces readonly
 * - No default values in domain types
 */

/**
 * Canonical settlement outcomes
 * These are the only valid final states for a settlement attempt
 */
export const SETTLEMENT_OUTCOMES = {
  /** Settlement initiated, awaiting provider response */
  PENDING: "PENDING",
  /** Payment captured successfully */
  SUCCEEDED: "SUCCEEDED",
  /** Payment declined by provider (card issue, insufficient funds) */
  DECLINED: "DECLINED",
  /** Technical failure (network, provider error) */
  FAILED: "FAILED",
  /** Ambiguous state requiring investigation */
  UNKNOWN: "UNKNOWN",
} as const;

/**
 * Settlement outcome type derived from canonical values
 */
export type SettlementOutcome =
  (typeof SETTLEMENT_OUTCOMES)[keyof typeof SETTLEMENT_OUTCOMES];

/**
 * Payment policy constants
 * Business rules for settlement behavior
 */
export const PAYMENT_POLICY = {
  /** Maximum number of settlement attempts allowed per ride */
  MAX_ATTEMPTS: 3,
  /** Currency for all payments (COP = Colombian Peso) */
  CURRENCY: "COP",
} as const;

/**
 * Immutable reference to fare breakdown
 * Captures the fare components at time of payment intent creation
 */
export interface FareBreakdownRef {
  /** Base fare component in COP */
  readonly baseFare: number;
  /** Distance-based component in COP */
  readonly distanceComponent: number;
  /** Time-based component in COP */
  readonly timeComponent: number;
  /** True if minimum fare was applied */
  readonly minimumFareApplied: boolean;
}
