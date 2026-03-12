/**
 * FareRepositoryPort - Application-defined persistence interface
 *
 * Defines write-once semantics for fare calculations.
 * Each ride can have exactly one fare calculation.
 */

import type { Result } from "../../../../shared/core/result.js";
import type {
  FareAmount,
  MoneyCOP,
  PricingVersion,
} from "../../../../shared/domain/value-objects/index.js";
import type { DomainError } from "../../../../shared/errors/error-types.js";
import type { RideId } from "../../../../shared/types/ids/index.js";

/**
 * FareRecord represents a persisted fare calculation.
 * Pure data structure with VOs.
 */
export interface FareRecord {
  readonly id: string;
  readonly rideId: RideId;
  readonly baseFare: MoneyCOP;
  readonly distanceKm: number;
  readonly durationMinutes: number;
  readonly distanceComponent: MoneyCOP;
  readonly timeComponent: MoneyCOP;
  readonly totalFare: FareAmount;
  readonly pricingVersion: PricingVersion;
  readonly calculatedAtUTC: string;
  readonly createdAtUTC: string;
}

/**
 * FareRepositoryPort - Write-once fare persistence.
 *
 * Invariants:
 * - One fare per rideId (enforced via unique constraint)
 * - Duplicate save returns Conflict DomainError
 * - No update or delete operations (immutable audit trail)
 */
export interface FareRepositoryPort {
  /**
   * Save a new fare calculation.
   *
   * Returns ConflictError if fare already exists for this ride.
   */
  save(
    record: Omit<FareRecord, "id" | "createdAtUTC">
  ): Promise<Result<FareRecord, DomainError>>;

  /**
   * Find fare calculation by ride ID.
   *
   * Returns null if not found (not an error condition).
   */
  findByRideId(rideId: RideId): Promise<Result<FareRecord | null, DomainError>>;
}
