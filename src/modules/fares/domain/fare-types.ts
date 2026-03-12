/**
 * Fare Calculation Types - Pure Domain Types
 *
 * Defines the input, output, and constants for fare calculation.
 * All types are immutable and validation-friendly.
 *
 * Following project patterns:
 * - as const objects instead of enums
 * - Explicit type definitions
 * - No default values in domain types
 * - Use VOs (MoneyCOP, FareAmount, PricingVersion) for payments-grade correctness
 */

import type {
  FareAmount,
  MoneyCOP,
  PricingVersion,
} from "../../../shared/domain/value-objects/index.js";

/**
 * Pricing constants for fare calculation
 * Colombian market rates (COP = Colombian Peso)
 */
export const PRICING = {
  /** Price per kilometer (1,200 COP ≈ $0.30 USD) */
  PRICE_PER_KM_COP: 1200,
  /** Price per minute (200 COP ≈ $0.05 USD) */
  PRICE_PER_MINUTE_COP: 200,
} as const;

/**
 * Input for fare calculation (primitives)
 * All values must be validated before calculation
 */
export interface FareInput {
  /** Base fare in COP (must be integer >= 0) */
  readonly baseFareCOP: number;
  /** Distance in kilometers (must be >= 0) */
  readonly distanceKm: number;
  /** Duration in minutes (must be >= 0) */
  readonly durationMinutes: number;
}

/**
 * Breakdown of fare components (using VOs)
 * Shows how the total was calculated
 */
export interface FareBreakdown {
  /** Base fare component (from input) */
  readonly baseFare: MoneyCOP;
  /** Distance-based component (distanceKm * PRICE_PER_KM_COP, rounded up) */
  readonly distanceComponent: MoneyCOP;
  /** Time-based component (durationMinutes * PRICE_PER_MINUTE_COP, rounded up) */
  readonly timeComponent: MoneyCOP;
}

/**
 * Complete fare calculation result (using VOs)
 * Includes total, breakdown, and audit metadata
 */
export interface FareResult {
  /** Total fare with deterministic rounding and minimum enforcement */
  readonly totalFare: FareAmount;
  /** Detailed breakdown of fare components */
  readonly breakdown: FareBreakdown;
  /** Pricing version used for this calculation */
  readonly pricingVersion: PricingVersion;
  /** ISO 8601 UTC timestamp when calculation was performed */
  readonly calculatedAtUTC: string;
}
