/**
 * Ride HTTP request factories
 *
 * Generate typed request payloads for rides API endpoints.
 * Returns JSON:API document structure for the new routes.
 * No assertions - tests own all expectations.
 */

/**
 * Build ride creation request in JSON:API format
 */
export const buildRideCreate = (
  overrides?: Partial<{
    riderId: string;
    originLat: number;
    originLng: number;
    destinationLat: number;
    destinationLng: number;
    marketId: string;
  }>
) => {
  const defaults = {
    riderId: "rider-001",
    originLat: 4.711,
    originLng: -74.0721,
    destinationLat: 4.8,
    destinationLng: -74.2,
  };

  const merged = {
    ...defaults,
    ...overrides,
  };

  return {
    data: {
      type: "rides" as const,
      attributes: {
        riderId: merged.riderId,
        pickup: {
          lat: merged.originLat,
          lng: merged.originLng,
        },
        dropoff: {
          lat: merged.destinationLat,
          lng: merged.destinationLng,
        },
        ...(merged.marketId ? { marketId: merged.marketId } : {}),
      },
    },
  };
};

/**
 * Build ride transition request in JSON:API format
 */
export const buildRideTransition = (
  overrides?: Partial<{
    toState: string;
    reason: string;
  }>
) => {
  const defaults = {
    toState: "DISPATCHING",
  };

  const merged = {
    ...defaults,
    ...overrides,
  };

  return {
    data: {
      type: "ride-transitions" as const,
      attributes: {
        toState: merged.toState,
        ...(merged.reason ? { reason: merged.reason } : {}),
      },
    },
  };
};
