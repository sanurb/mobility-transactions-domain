/**
 * Legacy ride repository types and stub.
 *
 * DEPRECATED: Legacy repository was removed. This file exists only so that
 * ride.service.ts and its dependents compile. Use adapters/outbound/ride.repository
 * and use cases in new code.
 */

import type { Result } from "../../../shared/core/result.js";
import type { DomainError } from "../../../shared/errors/error-types.js";
import type { Ride } from "../domain/ride.aggregate.js";
import type { RideState } from "../domain/ride-states.js";

/** @deprecated Use Ride from domain or use cases. */
export type RideDTO = Ride;

export type RideWithTransitions = Ride & { tenantId: string };

/** @deprecated Legacy create params. */
export interface CreateRideParams {
  tenantId: string;
  riderId: string;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
}

/** @deprecated Legacy list result. */
export interface ListResult {
  rides: RideWithTransitions[];
  total: number;
}

/** @deprecated Legacy repository interface. Use RideRepositoryPort and use cases. */
export interface IRideRepository {
  create(
    params: CreateRideParams
  ): Promise<Result<RideWithTransitions, DomainError>>;
  findById(
    rideId: string,
    _tenantId: string,
    opts?: { includeTransitions?: boolean }
  ): Promise<Result<RideWithTransitions | null, DomainError>>;
  transition(params: {
    rideId: string;
    tenantId: string;
    expectedVersion: number;
    toState: RideState;
    changedBy: string;
    changedByRole: "rider" | "driver" | "system";
    reason?: string;
    correlationId?: string;
    startedAt?: Date;
    completedAt?: Date;
    expiresAt?: Date | null;
    driverId?: string;
  }): Promise<Result<RideWithTransitions, DomainError>>;
  list(params: {
    tenantId: string;
    riderId?: string;
    driverId?: string;
    state?: RideState;
    limit?: number;
    offset?: number;
  }): Promise<Result<ListResult, DomainError>>;
}

/**
 * Stub implementation. All methods throw.
 *
 * @deprecated Legacy repository removed. Use createRideRepository from adapters/outbound and wire use cases.
 */
class LegacyRideRepositoryStub implements IRideRepository {
  async create(): Promise<Result<RideWithTransitions, DomainError>> {
    throw new Error(
      "Legacy ride repository removed. Use CreateRideUseCase and adapters/outbound/ride.repository."
    );
  }

  async findById(): Promise<Result<RideWithTransitions | null, DomainError>> {
    throw new Error(
      "Legacy ride repository removed. Use GetRideUseCase and adapters/outbound/ride.repository."
    );
  }

  async transition(): Promise<Result<RideWithTransitions, DomainError>> {
    throw new Error(
      "Legacy ride repository removed. Use TransitionRideUseCase and adapters/outbound/ride.repository."
    );
  }

  async list(): Promise<Result<ListResult, DomainError>> {
    throw new Error(
      "Legacy ride repository removed. Use ListRidesUseCase and adapters/outbound/ride.repository."
    );
  }
}

/**
 * @deprecated Returns a stub that throws. Wire use cases and adapters/outbound/ride.repository in app bootstrap.
 */
export function createRideRepository(): IRideRepository {
  return new LegacyRideRepositoryStub();
}
