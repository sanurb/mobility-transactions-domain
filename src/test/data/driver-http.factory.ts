/**
 * Driver HTTP request factories
 *
 * Generate typed request payloads for driver API endpoints.
 * No assertions - tests own all expectations.
 * Factories accept overrides and produce meaningful domain data.
 */

/**
 * Build driver registration request
 * Empty body - driverId comes from auth token
 */
export const buildDriver = (
  overrides?: Partial<{ driverId: string; tenantId: string }>
) => {
  return {};
};

/**
 * Build availability update request
 */
export const buildAvailabilityUpdate = (
  overrides?: Partial<{ state: "AVAILABLE" | "BUSY" | "OFFLINE" }>
) => {
  const defaults = {
    state: "AVAILABLE" as const,
  };

  return {
    ...defaults,
    ...overrides,
  };
};

/**
 * Build location update request
 *
 * Field names encode units to prevent confusion:
 * - accuracyMeters: GPS accuracy in meters
 * - bearingDegrees: Heading in degrees (0-360)
 * - speedMetersPerSecond: Speed in m/s
 * - recordedAtISO: ISO 8601 timestamp string
 */
export const buildLocationUpdate = (
  overrides?: Partial<{
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    bearingDegrees: number;
    speedMetersPerSecond: number;
    recordedAtISO: string;
  }>
) => {
  const defaults = {
    latitude: 4.711,
    longitude: -74.0721,
    accuracyMeters: 10,
    bearingDegrees: 90,
    speedMetersPerSecond: 5,
    recordedAtISO: new Date().toISOString(),
  };

  const merged = {
    ...defaults,
    ...overrides,
  };

  // Map to API schema field names
  return {
    latitude: merged.latitude,
    longitude: merged.longitude,
    accuracy: merged.accuracyMeters,
    bearing: merged.bearingDegrees,
    speed: merged.speedMetersPerSecond,
    recordedAt: merged.recordedAtISO,
  };
};
