/**
 * Dispatch Policy - Pure Domain Logic
 *
 * Deterministic driver selection based on distance and tie-breaking rules.
 * All dispatch policies are pure functions with no I/O.
 */

import { Result } from "../../../shared/core/result.js";
import { ValidationError } from "../../../shared/errors/error-types.js";
import type { Distance } from "./value-objects/distance.js";
import type { DriverId } from "./value-objects/driver-id.js";

/**
 * Dispatch candidate with distance from pickup location
 */
export interface DispatchCandidate {
  readonly driverId: DriverId;
  readonly distance: Distance;
}

/**
 * Dispatch selection result with audit trail
 */
export interface DispatchSelection {
  readonly winner: DispatchCandidate;
  readonly candidates: readonly DispatchCandidate[];
  readonly selectionCriteria: string;
}

/**
 * Dispatch policy interface
 */
export interface DispatchPolicy {
  selectDriver(
    candidates: readonly DispatchCandidate[]
  ): Result<DispatchSelection, ValidationError>;
}

/**
 * Nearest-first dispatch policy
 *
 * Selection algorithm:
 * 1. Primary: Sort by distance ascending (nearest first)
 * 2. Secondary: Sort by driverId ascending (deterministic tie-break)
 */
export class NearestFirstDispatchPolicy implements DispatchPolicy {
  selectDriver(
    candidates: readonly DispatchCandidate[]
  ): Result<DispatchSelection, ValidationError> {
    // Empty input validation
    if (candidates.length === 0) {
      return Result.err(new ValidationError("NO_ELIGIBLE_DRIVERS"));
    }

    // Sort candidates (nearest first, then by driverId for tie-breaking)
    const sorted = [...candidates].sort((a, b) => {
      // Primary: distance ascending
      const distanceDiff = a.distance.meters - b.distance.meters;
      if (distanceDiff !== 0) {
        return distanceDiff;
      }

      // Secondary: driverId ascending (alphabetical)
      return a.driverId.value.localeCompare(b.driverId.value);
    });

    // We already validated candidates.length > 0, so sorted[0] is guaranteed
    const winner = sorted[0] as DispatchCandidate;

    return Result.ok({
      winner,
      candidates,
      selectionCriteria: "nearest-first",
    });
  }
}
