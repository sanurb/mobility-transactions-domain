/**
 * Test factories for Fare domain.
 *
 * Provide sensible defaults with typed overrides.
 */

import { createRideId } from "../../../../shared/types/ids/index.js";
import type { CalculateFareInput } from "../../application/use-cases/index.js";
import type { FareInput } from "../../domain/index.js";

/**
 * Build FareInput for domain tests.
 */
export const buildFareInput = (overrides?: Partial<FareInput>): FareInput => {
  return {
    baseFareCOP: 3500,
    distanceKm: 5.0,
    durationMinutes: 10,
    ...overrides,
  };
};

/**
 * Build CalculateFareInput for use case tests.
 */
export const buildCalculateFareInput = (
  overrides?: Partial<CalculateFareInput>
): CalculateFareInput => {
  return {
    rideId: createRideId("ride_test123"),
    baseFareCOP: 3500,
    distanceKm: 5.0,
    durationMinutes: 10,
    minimumFareCOP: 5000,
    pricingVersionString: "v1.0.0",
    ...overrides,
  };
};

/**
 * Build JSON:API request body for calculate fare.
 */
export const buildCalculateFareJsonApiBody = (overrides?: {
  rideId?: string;
  baseFareCOP?: number;
  distanceKm?: number;
  durationMinutes?: number;
  minimumFareCOP?: number;
  pricingVersion?: string;
}) => {
  return {
    data: {
      type: "fares" as const,
      attributes: {
        rideId: "ride_test123",
        baseFareCOP: 3500,
        distanceKm: 5.0,
        durationMinutes: 10,
        minimumFareCOP: 5000,
        pricingVersion: "v1.0.0",
        ...overrides,
      },
    },
  };
};

/**
 * Build a RideId string for tests.
 */
export const buildRideId = (suffix = "123"): string => {
  return `ride_test${suffix}`;
};

/**
 * Build a pricing version string.
 */
export const buildPricingVersionString = (version = "1.0.0"): string => {
  return `v${version}`;
};
