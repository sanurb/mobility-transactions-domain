/**
 * Dispatch HTTP request factories
 *
 * Generate typed request payloads for dispatch API endpoints.
 * No assertions - tests own all expectations.
 * searchRadiusMeters is explicit (no hidden defaults).
 */

/**
 * Build dispatch request
 */
export const buildDispatch = (
  overrides?: Partial<{
    rideId: string;
    pickupLat: number;
    pickupLng: number;
    searchRadiusMeters: number;
  }>
) => {
  const defaults = {
    rideId: "",
    pickupLat: 4.711,
    pickupLng: -74.0721,
    searchRadiusMeters: 5000,
  };

  const merged = {
    ...defaults,
    ...overrides,
  };

  return {
    rideId: merged.rideId,
    pickupLocation: {
      lat: merged.pickupLat,
      lng: merged.pickupLng,
    },
    searchRadiusMeters: merged.searchRadiusMeters,
  };
};
