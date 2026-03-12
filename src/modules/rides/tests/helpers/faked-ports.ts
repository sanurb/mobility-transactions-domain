/**
 * Faked ports for Ride application tests
 *
 * In-memory implementations for deterministic, fast testing.
 * Follows Testing Rules for AI: explicit, no hidden behavior.
 */

import { Result } from "../../../../shared/core/result.js";
import {
  ConflictError,
  type DomainError,
} from "../../../../shared/errors/error-types.js";
import type { RideId } from "../../../../shared/types/ids/ride-id.js";
import type { ClockPort } from "../../application/ports/clock.port.js";
import type {
  ListRidesQuery,
  ListRidesResult,
  RideRepositoryPort,
  RideTransitionDTO,
} from "../../application/ports/ride-repository.port.js";
import type { Ride } from "../../domain/ride.aggregate.js";

/**
 * Fake RideRepository using Map
 */
export class FakeRideRepository implements RideRepositoryPort {
  private rides = new Map<RideId, Ride>();
  private savedVersions = new Map<RideId, number>();

  async save(aggregate: Ride): Promise<Result<void, DomainError>> {
    const savedVersion = this.savedVersions.get(aggregate.id);

    // Optimistic locking: check version on update (not on create)
    if (
      savedVersion !== undefined &&
      savedVersion !== aggregate.getVersion() - 1
    ) {
      return Result.err(
        new ConflictError("Version mismatch", {
          currentState: aggregate.state,
          attemptedAction: "save",
        })
      );
    }

    this.savedVersions.set(aggregate.id, aggregate.getVersion());
    this.rides.set(aggregate.id, aggregate);
    return Result.ok(undefined);
  }

  async findById(id: RideId): Promise<Result<Ride | null, DomainError>> {
    const ride = this.rides.get(id) ?? null;
    return Result.ok(ride);
  }

  async findExpired(params: {
    nowUTC: string;
    limit: number;
  }): Promise<Result<Ride[], DomainError>> {
    const expired = Array.from(this.rides.values())
      .filter((ride) => ride.isExpiredAt(params.nowUTC))
      .slice(0, params.limit);
    return Result.ok(expired);
  }

  async findTransitions(
    _rideId: RideId
  ): Promise<Result<RideTransitionDTO[], DomainError>> {
    return Result.ok([]);
  }

  async list(
    query: ListRidesQuery
  ): Promise<Result<ListRidesResult, DomainError>> {
    let filtered = Array.from(this.rides.values());

    if (query.riderId) {
      filtered = filtered.filter((r) => r.riderId === query.riderId);
    }
    if (query.driverId) {
      filtered = filtered.filter((r) => r.driverId === query.driverId);
    }
    if (query.state) {
      filtered = filtered.filter((r) => r.state === query.state);
    }

    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    const rides = filtered.slice(offset, offset + limit);

    return Result.ok({
      rides,
      total: filtered.length,
    });
  }

  // Test helpers
  clear(): void {
    this.rides.clear();
    this.savedVersions.clear();
  }

  getAll(): Ride[] {
    return Array.from(this.rides.values());
  }
}

/**
 * Fake Clock with fixed time
 */
export class FakeClock implements ClockPort {
  constructor(private fixedNow = "2026-02-13T14:00:00.000Z") {}

  now(): string {
    return this.fixedNow;
  }

  // Test helper
  setNow(isoString: string): void {
    this.fixedNow = isoString;
  }
}
