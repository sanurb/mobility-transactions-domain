/**
 * TransitionRide Use Case
 *
 * Business intent: Transition ride to a new state
 *
 * Orchestrates:
 * 1. Find ride aggregate by ID
 * 2. Get current time from ClockPort
 * 3. Call aggregate.transition() with state machine rules
 * 4. Persist updated aggregate (optimistic locking)
 * 5. Publish RideStateChanged event
 */

import { Result } from "../../../../shared/core/result.js";
import {
  type DomainError,
  NotFoundError,
} from "../../../../shared/errors/error-types.js";
import type { DriverId } from "../../../../shared/types/ids/driver-id.js";
import type { RideId } from "../../../../shared/types/ids/ride-id.js";
import { createRideStateChangedEvent } from "../../domain/events.js";
import type { RideState } from "../../domain/ride-states.js";
import type { ClockPort } from "../ports/clock.port.js";
import type { EventPublisherPort } from "../ports/event-publisher.port.js";
import type { RideRepositoryPort } from "../ports/ride-repository.port.js";

/**
 * Input for TransitionRide use case
 */
export interface TransitionRideInput {
  rideId: RideId;
  toState: RideState;
  changedBy: string;
  changedByRole: "rider" | "driver" | "system";
  reason?: string;
  driverId?: DriverId;
  correlationId?: string;
}

/**
 * Output from TransitionRide use case
 */
export interface TransitionRideOutput {
  rideId: RideId;
  newState: RideState;
}

/**
 * TransitionRide Use Case
 */
export class TransitionRideUseCase {
  constructor(
    private readonly repository: RideRepositoryPort,
    private readonly clock: ClockPort,
    private readonly eventBus?: EventPublisherPort
  ) {}

  async execute(
    input: TransitionRideInput
  ): Promise<Result<TransitionRideOutput, DomainError>> {
    // Find ride
    const findResult = await this.repository.findById(input.rideId);
    if (findResult.isErr()) {
      return findResult;
    }

    const ride = findResult.value;
    if (!ride) {
      return Result.err(new NotFoundError("Ride", input.rideId));
    }

    // Capture previous state for event
    const previousState = ride.state;

    // Get current time
    const nowUTC = this.clock.now();

    // Transition (domain enforces invariants)
    const transitionResult = ride.transition({
      toState: input.toState,
      changedBy: input.changedBy,
      changedByRole: input.changedByRole,
      reason: input.reason,
      driverId: input.driverId,
      nowUTC,
    });

    if (transitionResult.isErr()) {
      return transitionResult;
    }

    // Persist (optimistic locking via version)
    const saveResult = await this.repository.save(ride);
    if (saveResult.isErr()) {
      return saveResult;
    }

    // Publish RideStateChanged event (after successful persistence)
    if (this.eventBus) {
      const event = createRideStateChangedEvent(
        input.rideId,
        {
          rideId: input.rideId,
          previousState,
          newState: ride.state,
          changedBy: input.changedBy,
          changedByRole: input.changedByRole,
          reason: input.reason,
          driverId: input.driverId,
        },
        { correlationId: input.correlationId }
      );
      await this.eventBus.publish(event);
    }

    return Result.ok({
      rideId: input.rideId,
      newState: ride.state,
    });
  }
}
