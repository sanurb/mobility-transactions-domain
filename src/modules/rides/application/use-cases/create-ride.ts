/**
 * CreateRide Use Case
 *
 * Business intent: Create a new ride request
 *
 * Orchestrates:
 * 1. Get current time from ClockPort
 * 2. Create Ride aggregate with domain factory
 * 3. Persist via RideRepositoryPort
 *
 * No framework types, no TenantId.
 */

import { Result } from "../../../../shared/core/result.js";
import { Location } from "../../../../shared/domain/value-objects/location.js";
import type { DomainError } from "../../../../shared/errors/error-types.js";
import type { MarketId } from "../../../../shared/types/ids/market-id.js";
import type { RideId } from "../../../../shared/types/ids/ride-id.js";
import type { RiderId } from "../../../../shared/types/ids/rider-id.js";
import { Ride } from "../../domain/ride.aggregate.js";
import type { ClockPort } from "../ports/clock.port.js";
import type { RideRepositoryPort } from "../ports/ride-repository.port.js";

/**
 * Input for CreateRide use case
 */
export interface CreateRideInput {
  id: RideId;
  riderId: RiderId;
  pickup: {
    lat: number;
    lng: number;
  };
  dropoff: {
    lat: number;
    lng: number;
  };
  marketId?: MarketId;
}

/**
 * Output from CreateRide use case
 */
export interface CreateRideOutput {
  rideId: RideId;
}

/**
 * CreateRide Use Case
 */
export class CreateRideUseCase {
  constructor(
    private readonly repository: RideRepositoryPort,
    private readonly clock: ClockPort
  ) {}

  async execute(
    input: CreateRideInput
  ): Promise<Result<CreateRideOutput, DomainError>> {
    // Create Location value objects
    const pickupResult = Location.create(input.pickup.lat, input.pickup.lng);
    if (pickupResult.isErr()) {
      return pickupResult;
    }

    const dropoffResult = Location.create(input.dropoff.lat, input.dropoff.lng);
    if (dropoffResult.isErr()) {
      return dropoffResult;
    }

    // Get current time
    const nowUTC = this.clock.now();

    // Create Ride aggregate
    const ride = Ride.create({
      id: input.id,
      riderId: input.riderId,
      pickup: pickupResult.value,
      dropoff: dropoffResult.value,
      nowUTC,
      marketId: input.marketId,
    });

    // Persist
    const saveResult = await this.repository.save(ride);
    if (saveResult.isErr()) {
      return saveResult;
    }

    return Result.ok({ rideId: input.id });
  }
}
