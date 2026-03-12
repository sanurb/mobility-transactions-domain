/**
 * Dispatch Audit Writer Port
 *
 * SRP-compliant abstraction for persisting dispatch audit records.
 * Separates audit concerns from driver repository.
 */

import type { Result } from "../../../../shared/core/result.js";
import type { DomainError } from "../../../../shared/errors/error-types.js";

/**
 * Dispatch outcome types
 */
export type DispatchOutcome =
  | "SUCCEEDED"
  | "CONFLICT"
  | "NO_ELIGIBLE"
  | "FAILED";

/**
 * Search center location
 */
export interface SearchCenter {
  latitude: number;
  longitude: number;
}

/**
 * Evaluated candidate information
 */
export interface EvaluatedCandidate {
  driverId: string;
  distanceMeters: number;
}

/**
 * Dispatch audit record
 */
export interface DispatchAuditRecord {
  rideId: string;
  tenantId: string;
  correlationId: string;
  dispatchedAt: string;
  searchRadiusMeters: number;
  searchCenter: SearchCenter;
  candidatesEvaluated: number;
  candidates: readonly EvaluatedCandidate[];
  selectedDriverId: string | null;
  selectionCriteria: string;
  outcome: DispatchOutcome;
  failureCode: string | null;
}

/**
 * Dispatch Audit Writer Port
 */
export interface DispatchAuditWriter {
  /**
   * Write a dispatch attempt audit record
   *
   * @param audit - Dispatch audit record
   * @returns Result with void on success or DomainError on failure
   */
  writeDispatchAttempt(
    audit: DispatchAuditRecord
  ): Promise<Result<void, DomainError>>;
}
