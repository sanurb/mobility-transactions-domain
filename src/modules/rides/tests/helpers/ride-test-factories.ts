/**
 * Test factories for Ride domain
 *
 * Provides typed builders with meaningful defaults and override support.
 * Follows Testing Rules for AI: explicit, predictable, no hidden state.
 */

import { Location } from "../../../../shared/domain/value-objects/location.js";
import { createRideId } from "../../../../shared/types/ids/ride-id.js";
import { createRiderId } from "../../../../shared/types/ids/rider-id.js";
import type {
  CreateRideProps,
  ReconstitutedRideProps,
  TransitionParams,
} from "../../domain/ride.aggregate.js";
import { RIDE_STATES } from "../../domain/ride-states.js";

/**
 * Build CreateRideProps with defaults
 */
export const buildRideCreateRequest = (
  overrides?: Partial<CreateRideProps>
): CreateRideProps => {
  const pickupResult = Location.create(4.6097, -74.0817); // Bogotá center
  const dropoffResult = Location.create(4.6517, -74.063); // North Bogotá

  if (pickupResult.isErr() || dropoffResult.isErr()) {
    throw new Error("Test location creation failed");
  }

  return {
    id: createRideId("test-ride-1"),
    riderId: createRiderId("test-rider-1"),
    pickup: pickupResult.value,
    dropoff: dropoffResult.value,
    nowUTC: "2026-02-13T14:00:00.000Z",
    marketId: null,
    ...overrides,
  };
};

/**
 * Build TransitionParams with defaults
 */
export const buildTransitionRequest = (
  overrides?: Partial<TransitionParams>
): TransitionParams => {
  return {
    toState: RIDE_STATES.DISPATCHING,
    changedBy: "test-system",
    changedByRole: "system",
    nowUTC: "2026-02-13T14:01:00.000Z",
    ...overrides,
  };
};

/**
 * Build ReconstitutedRideProps with defaults
 */
export const buildRideSnapshot = (
  overrides?: Partial<ReconstitutedRideProps>
): ReconstitutedRideProps => {
  const pickupResult = Location.create(4.6097, -74.0817);
  const dropoffResult = Location.create(4.6517, -74.063);

  if (pickupResult.isErr() || dropoffResult.isErr()) {
    throw new Error("Test location creation failed");
  }

  return {
    id: createRideId("test-ride-1"),
    riderId: createRiderId("test-rider-1"),
    driverId: null,
    marketId: null,
    state: RIDE_STATES.CREATED,
    pickup: pickupResult.value,
    dropoff: dropoffResult.value,
    requestedAtUTC: "2026-02-13T14:00:00.000Z",
    startedAtUTC: null,
    completedAtUTC: null,
    expiresAtUTC: null,
    version: 1,
    ...overrides,
  };
};
