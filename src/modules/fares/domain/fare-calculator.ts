/**
 * Fare Calculator - Pure Domain Logic
 *
 * Calculates ride fares using deterministic math with transparent breakdown.
 * All calculations are pure functions with zero I/O dependencies.
 *
 * Business rules:
 * 1. Total = baseFare + (distance * PRICE_PER_KM) + (duration * PRICE_PER_MINUTE)
 * 2. All components round UP (Math.ceil)
 * 3. Minimum fare enforced via policy parameter (not hardcoded)
 * 4. baseFareCOP must be integer (COP has no fractional units)
 * 5. All inputs must be non-negative and finite
 */

import { Result } from "../../../shared/core/result.js";
import {
  FareAmount,
  type FarePolicy,
  MoneyCOP,
  type PricingVersion,
} from "../../../shared/domain/value-objects/index.js";
import { ValidationError } from "../../../shared/errors/error-types.js";
import type { FareBreakdown, FareInput, FareResult } from "./fare-types.js";
import { PRICING } from "./fare-types.js";

/**
 * Policy for fare calculation.
 * Injected to avoid baking rigid global minimums into domain.
 */
export interface FareCalculationPolicy {
  readonly minimumFareCOP: number;
  readonly pricingVersion: PricingVersion;
}

/**
 * Validate fare input
 *
 * @param input - Fare calculation input
 * @returns Result with validated input or validation error
 */
const validateFareInput = (
  input: FareInput
): Result<FareInput, ValidationError> => {
  // Base fare must be non-negative integer
  if (input.baseFareCOP < 0) {
    return Result.err(new ValidationError("baseFareCOP must be non-negative"));
  }

  if (!Number.isInteger(input.baseFareCOP)) {
    return Result.err(
      new ValidationError(
        "baseFareCOP must be an integer (COP has no fractional units)"
      )
    );
  }

  if (!Number.isFinite(input.baseFareCOP)) {
    return Result.err(new ValidationError("baseFareCOP must be finite"));
  }

  // Distance must be non-negative and finite
  if (input.distanceKm < 0) {
    return Result.err(new ValidationError("distanceKm must be non-negative"));
  }

  if (!Number.isFinite(input.distanceKm)) {
    return Result.err(new ValidationError("distanceKm must be finite"));
  }

  // Duration must be non-negative and finite
  if (input.durationMinutes < 0) {
    return Result.err(
      new ValidationError("durationMinutes must be non-negative")
    );
  }

  if (!Number.isFinite(input.durationMinutes)) {
    return Result.err(new ValidationError("durationMinutes must be finite"));
  }

  return Result.ok(input);
};

/**
 * Calculate fare for a ride
 *
 * Pure function that computes total fare with detailed breakdown.
 * Follows Colombian market pricing rules with policy-driven minimum enforcement.
 *
 * @param input - Fare calculation parameters
 * @param policy - Fare calculation policy (minimum, pricing version)
 * @param calculatedAtUTC - ISO 8601 UTC timestamp (injected via clock port, never inline)
 * @returns Result with fare details or validation error
 *
 * @example
 * const policyResult = PricingVersion.create('v1.0.0');
 * if (policyResult.isErr()) { ... }
 *
 * const result = calculateFare(
 *   {
 *     baseFareCOP: 3500,
 *     distanceKm: 5.2,
 *     durationMinutes: 12
 *   },
 *   {
 *     minimumFareCOP: 5000,
 *     pricingVersion: policyResult.value
 *   },
 *   '2026-02-13T10:00:00.000Z'
 * );
 *
 * if (result.isOk()) {
 *   const total = result.value.totalFare.amount; // e.g. 8700
 * }
 */
export const calculateFare = (
  input: FareInput,
  policy: FareCalculationPolicy,
  calculatedAtUTC: string
): Result<FareResult, ValidationError> => {
  // Validate input
  const validationResult = validateFareInput(input);
  if (validationResult.isErr()) {
    return Result.err(validationResult.error);
  }

  // Calculate components (always round UP)
  const baseFareAmount = input.baseFareCOP;
  const distanceComponentAmount = Math.ceil(
    input.distanceKm * PRICING.PRICE_PER_KM_COP
  );
  const timeComponentAmount = Math.ceil(
    input.durationMinutes * PRICING.PRICE_PER_MINUTE_COP
  );

  // Create MoneyCOP VOs for breakdown
  const baseFareResult = MoneyCOP.create(baseFareAmount);
  if (baseFareResult.isErr()) {
    return Result.err(baseFareResult.error);
  }

  const distanceComponentResult = MoneyCOP.create(distanceComponentAmount);
  if (distanceComponentResult.isErr()) {
    return Result.err(distanceComponentResult.error);
  }

  const timeComponentResult = MoneyCOP.create(timeComponentAmount);
  if (timeComponentResult.isErr()) {
    return Result.err(timeComponentResult.error);
  }

  // Calculate raw total
  const rawTotal =
    baseFareAmount + distanceComponentAmount + timeComponentAmount;

  // Create FareAmount with policy-driven minimum
  const farePolicy: FarePolicy = { minimumFareCOP: policy.minimumFareCOP };
  const totalFareResult = FareAmount.create(rawTotal, farePolicy);
  if (totalFareResult.isErr()) {
    return Result.err(totalFareResult.error);
  }

  // Build breakdown with VOs
  const breakdown: FareBreakdown = {
    baseFare: baseFareResult.value,
    distanceComponent: distanceComponentResult.value,
    timeComponent: timeComponentResult.value,
  };

  // Build result with VOs
  const fareResult: FareResult = {
    totalFare: totalFareResult.value,
    breakdown,
    pricingVersion: policy.pricingVersion,
    calculatedAtUTC,
  };

  return Result.ok(fareResult);
};
