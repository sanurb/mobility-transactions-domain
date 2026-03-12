/**
 * Location Rules - Pure Domain Logic
 *
 * Defines rules for location freshness and quality.
 * All functions are pure - no hidden coupling to system time.
 */

import type { DriverId } from "./value-objects/driver-id.js";
import type { LocationUpdate } from "./value-objects/location-update.js";

/**
 * Location freshness threshold in milliseconds
 * Updates older than this are considered stale
 */
export const LOCATION_FRESHNESS_THRESHOLD_MS = 30_000 as const;

/**
 * Maximum location accuracy in meters (re-export from LocationUpdate for convenience)
 */
export const MAX_LOCATION_ACCURACY_METERS = 100 as const;

/**
 * Maximum speed in meters per second (re-export from LocationUpdate for convenience)
 */
export const MAX_SPEED_MPS = 80 as const;

/**
 * Check if a location is fresh (not stale)
 *
 * @param params.recordedAt - When the location was recorded
 * @param params.now - Current time for comparison
 * @returns true if location is fresh, false if stale or in future
 */
export const isLocationFresh = (params: {
  recordedAt: Date;
  now: Date;
}): boolean => {
  const { recordedAt, now } = params;

  const ageMs = now.getTime() - recordedAt.getTime();

  // Future timestamps are NOT fresh (explicit negative space)
  if (ageMs < 0) {
    return false;
  }

  // Boundary rule: age <= threshold is fresh
  return ageMs <= LOCATION_FRESHNESS_THRESHOLD_MS;
};

/**
 * Filter location updates to only include fresh ones
 *
 * @param params.updates - Array of driver location updates
 * @param params.now - Current time for freshness check
 * @returns Array of fresh location updates only
 */
export const filterFreshLocationUpdates = (params: {
  updates: ReadonlyArray<{ driverId: DriverId; update: LocationUpdate }>;
  now: Date;
}): ReadonlyArray<{ driverId: DriverId; update: LocationUpdate }> => {
  const { updates, now } = params;

  return updates.filter((item) =>
    isLocationFresh({
      recordedAt: item.update.recordedAt,
      now,
    })
  );
};
