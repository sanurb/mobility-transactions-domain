/**
 * Ride Repository Port
 *
 * Application-layer abstraction for Ride aggregate persistence.
 * Infrastructure layer implements this port.
 *
 * PRD alignment:
 * - No TenantId parameters (scoping at inbound boundary only)
 * - Operates on Ride aggregates (not DTOs)
 * - Returns Result types for explicit error handling
 */

import type { Result } from "../../../../shared/core/result.js";
import type { DomainError } from "../../../../shared/errors/error-types.js";
import type { DriverId } from "../../../../shared/types/ids/driver-id.js";
import type { RideId } from "../../../../shared/types/ids/ride-id.js";
import type { RiderId } from "../../../../shared/types/ids/rider-id.js";
import type { Ride } from "../../domain/ride.aggregate.js";
import type { ChangedByRole, RideState } from "../../domain/ride-states.js";

/**
 * Transition record returned from repository queries
 */
export interface RideTransitionDTO {
  fromState: string;
  toState: string;
  changedBy: string;
  changedByRole: ChangedByRole;
  reason: string | null;
  createdAt: string;
}

/**
 * Query parameters for listing rides
 */
export interface ListRidesQuery {
  riderId?: RiderId;
  driverId?: DriverId;
  state?: RideState;
  limit?: number;
  offset?: number;
}

/**
 * Result of list query with pagination
 */
export interface ListRidesResult {
  rides: Ride[];
  total: number;
}

/**
 * Ride Repository Port
 *
 * Persistence operations for Ride aggregates.
 * MUST enforce optimistic concurrency using aggregate.version.
 */
export interface RideRepositoryPort {
  /**
   * Save a ride aggregate (create or update)
   *
   * MUST enforce optimistic concurrency:
   * - Compare aggregate.version with database version
   * - Return ConflictError if versions don't match
   * - Increment version on successful save
   */
  save(aggregate: Ride): Promise<Result<void, DomainError>>;

  /**
   * Find ride by ID
   *
   * @returns Ride aggregate or null if not found
   */
  findById(id: RideId): Promise<Result<Ride | null, DomainError>>;

  /**
   * Find expired rides
   *
   * @param params.nowUTC - ISO UTC timestamp to compare against expiresAtUTC
   * @param params.limit - Maximum number of expired rides to return
   * @returns Array of expired Ride aggregates
   */
  findExpired(params: {
    nowUTC: string;
    limit: number;
  }): Promise<Result<Ride[], DomainError>>;

  /**
   * List rides with filtering and pagination
   *
   * @param query - Filter and pagination parameters
   * @returns Paginated list of Ride aggregates
   */
  list(query: ListRidesQuery): Promise<Result<ListRidesResult, DomainError>>;

  /**
   * Find transitions for a ride
   *
   * @param rideId - Ride ID
   * @returns Array of transition DTOs ordered by created_at ASC
   */
  findTransitions(
    rideId: RideId
  ): Promise<Result<RideTransitionDTO[], DomainError>>;
}
