/**
 * Test factories for Driver domain
 *
 * Provides typed builders with meaningful defaults and override support.
 * Follows Testing Rules for AI: explicit, predictable, no hidden state.
 */

import { DRIVER_STATES, type DriverState } from "../../domain/driver-states.js";
import { DriverId } from "../../domain/value-objects/driver-id.js";
import { Location } from "../../domain/value-objects/location.js";
import { LocationUpdate } from "../../domain/value-objects/location-update.js";

/**
 * Named Bogotá coordinate constants for realistic geospatial testing
 */
export const BOGOTA_CENTER_LAT = 4.6097;
export const BOGOTA_CENTER_LNG = -74.0817;
export const BOGOTA_NORTH_LAT = 4.6517;
export const BOGOTA_NORTH_LNG = -74.063;

/**
 * Build DriverId with default value
 */
export const buildDriverId = (value = "test-driver-1"): DriverId => {
  const result = DriverId.create(value);
  if (result.isErr()) {
    throw new Error(`Test DriverId creation failed: ${result.error.message}`);
  }
  return result.value;
};

/**
 * Build Location with defaults (Bogotá center)
 */
export const buildLocation = (overrides?: {
  latitude?: number;
  longitude?: number;
}): Location => {
  const result = Location.create(
    overrides?.latitude ?? BOGOTA_CENTER_LAT,
    overrides?.longitude ?? BOGOTA_CENTER_LNG
  );
  if (result.isErr()) {
    throw new Error(`Test Location creation failed: ${result.error.message}`);
  }
  return result.value;
};

/**
 * Build LocationUpdate with defaults
 */
export const buildLocationUpdate = (overrides?: {
  location?: Location;
  accuracyMeters?: number;
  bearingDegrees?: number;
  speedMetersPerSecond?: number;
  recordedAt?: Date;
}): LocationUpdate => {
  const location = overrides?.location ?? buildLocation();
  const result = LocationUpdate.create({
    location,
    accuracyMeters: overrides?.accuracyMeters ?? 10.5,
    bearingDegrees: overrides?.bearingDegrees ?? 180,
    speedMetersPerSecond: overrides?.speedMetersPerSecond ?? 5.2,
    recordedAt: overrides?.recordedAt ?? new Date("2026-02-13T14:00:00.000Z"),
  });
  if (result.isErr()) {
    throw new Error(
      `Test LocationUpdate creation failed: ${result.error.message}`
    );
  }
  return result.value;
};

/**
 * Build RegisterDriverRequest for JSON:API tests
 */
export const buildRegisterDriverRequest = (overrides?: {
  driverId?: string;
}) => {
  return {
    data: {
      type: "drivers" as const,
      attributes: {
        driverId: overrides?.driverId ?? "test-driver-1",
      },
    },
  };
};

/**
 * Build UpdateAvailabilityRequest for JSON:API tests
 */
export const buildUpdateAvailabilityRequest = (overrides?: {
  state?: DriverState;
}) => {
  return {
    data: {
      type: "driver-availability-updates" as const,
      attributes: {
        state: overrides?.state ?? DRIVER_STATES.AVAILABLE,
      },
    },
  };
};

/**
 * Build UpdateLocationRequest for JSON:API tests
 */
export const buildUpdateLocationRequest = (overrides?: {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  bearing?: number;
  speed?: number;
  recordedAt?: string;
}) => {
  return {
    data: {
      type: "driver-location-updates" as const,
      attributes: {
        latitude: overrides?.latitude ?? BOGOTA_CENTER_LAT,
        longitude: overrides?.longitude ?? BOGOTA_CENTER_LNG,
        accuracy: overrides?.accuracy ?? 10.5,
        bearing: overrides?.bearing ?? 180,
        speed: overrides?.speed ?? 5.2,
        recordedAt: overrides?.recordedAt ?? "2026-02-13T14:00:00.000Z",
      },
    },
  };
};
