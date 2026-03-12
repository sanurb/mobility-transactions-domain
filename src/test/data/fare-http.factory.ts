/**
 * Fare HTTP request factories
 *
 * Generate typed request payloads for fares API endpoints.
 * No assertions - tests own all expectations.
 */

/**
 * Build fare calculation request
 */
export const buildFareCalculation = (
  overrides?: Partial<{
    rideId: string;
    baseFareCOP: number;
    distanceKm: number;
    durationMinutes: number;
  }>
) => {
  const defaults = {
    rideId: "ride-test-001",
    baseFareCOP: 3500,
    distanceKm: 5.2,
    durationMinutes: 12,
  };

  return {
    ...defaults,
    ...overrides,
  };
};
