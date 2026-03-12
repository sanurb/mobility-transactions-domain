/**
 * Driver & Dispatch Integration Tests
 *
 * Tests validate Phase 3 success criteria through full JSON:API HTTP stack:
 * HTTP -> JSON:API validation -> auth middleware -> service -> repository -> PostgreSQL
 *
 * Routes under test:
 * - POST   /api/drivers              (register driver)
 * - PATCH  /api/drivers/:id/availability (update availability)
 * - PATCH  /api/drivers/:id/location    (update location)
 * - GET    /api/drivers/:id          (get driver)
 * - POST   /api/dispatch/requests    (dispatch ride)
 *
 * Tests run against real PostgreSQL via Testcontainers.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AUTH_SCOPES } from "../../shared/infrastructure/auth/auth.types.js";
import {
  clearTokenCache,
  createCustomTestToken,
} from "../../test/helpers/test-auth.js";
import { cleanTestDatabase } from "../../test/helpers/test-db.js";
import {
  closeTestServer,
  getTestServer,
  injectRequest,
} from "../../test/helpers/test-server.js";
import { RIDE_STATES } from "../rides/domain/ride-states.js";
import { DRIVER_STATES } from "./domain/driver-states.js";

const JSONAPI = "application/vnd.api+json";

// Named coordinate constants (Bogota, Colombia)
const PICKUP_BOGOTA = { lat: 4.711, lng: -74.0721 };
const NEAR_DRIVER_1 = { lat: 4.712, lng: -74.073 }; // ~150m away
const NEAR_DRIVER_2 = { lat: 4.713, lng: -74.071 }; // ~250m away

// ============================================================================
// JSON:API Body Builders
// ============================================================================

const buildRegisterDriverBody = (driverId: string) => ({
  data: {
    type: "drivers" as const,
    attributes: { driverId },
  },
});

const buildAvailabilityBody = (state: string) => ({
  data: {
    type: "driver-availability-updates" as const,
    attributes: { state },
  },
});

const buildLocationBody = (params: {
  latitude: number;
  longitude: number;
  accuracy?: number;
  bearing?: number;
  speed?: number;
  recordedAt?: string;
}) => ({
  data: {
    type: "driver-location-updates" as const,
    attributes: {
      latitude: params.latitude,
      longitude: params.longitude,
      accuracy: params.accuracy ?? 10,
      bearing: params.bearing ?? 90,
      speed: params.speed ?? 5,
      recordedAt: params.recordedAt ?? new Date().toISOString(),
    },
  },
});

const buildCreateRideBody = (
  riderId: string,
  pickup = PICKUP_BOGOTA,
  dropoff = { lat: 4.8, lng: -74.2 }
) => ({
  data: {
    type: "rides" as const,
    attributes: {
      riderId,
      pickup,
      dropoff,
    },
  },
});

const buildTransitionBody = (toState: string) => ({
  data: {
    type: "ride-transitions" as const,
    attributes: { toState },
  },
});

const buildDispatchBody = (rideId: string, pickupLocation = PICKUP_BOGOTA) => ({
  data: {
    type: "dispatch-requests" as const,
    attributes: {
      rideId,
      pickupLocation: { lat: pickupLocation.lat, lng: pickupLocation.lng },
      searchRadiusMeters: 5000,
    },
  },
});

// ============================================================================
// Auth Helpers
// ============================================================================

const createDriverAuth = async (
  driverId: string,
  scopes: readonly string[] = [AUTH_SCOPES.DRIVER_WRITE]
) => {
  return createCustomTestToken({
    sub: driverId,
    tenantId: "test-tenant",
    driverId,
    scopes: scopes as any,
  });
};

const createDispatchAuth = async () => {
  return createCustomTestToken({
    sub: "dispatch-system",
    tenantId: "test-tenant",
    scopes: [AUTH_SCOPES.DISPATCH_EXECUTE] as any,
  });
};

const createRiderAuthForRide = async (riderId: string) => {
  return createCustomTestToken({
    sub: riderId,
    tenantId: "test-tenant",
    riderId,
    scopes: [
      AUTH_SCOPES.RIDE_CREATE,
      AUTH_SCOPES.RIDE_READ,
      AUTH_SCOPES.RIDE_UPDATE,
    ] as any,
  });
};

// ============================================================================
// Composed Helpers
// ============================================================================

/**
 * Register a driver and return its token
 */
const registerDriver = async (driverId: string, token: string) => {
  return injectRequest({
    method: "POST",
    url: "/api/drivers",
    payload: buildRegisterDriverBody(driverId),
    headers: { authorization: `Bearer ${token}`, "content-type": JSONAPI },
    auth: false,
  });
};

/**
 * Set driver availability
 */
const setAvailability = async (
  driverId: string,
  state: string,
  token: string
) => {
  return injectRequest({
    method: "PATCH",
    url: `/api/drivers/${driverId}/availability`,
    payload: buildAvailabilityBody(state),
    headers: { authorization: `Bearer ${token}`, "content-type": JSONAPI },
    auth: false,
  });
};

/**
 * Update driver location
 */
const updateLocation = async (
  driverId: string,
  params: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    recordedAt?: string;
  },
  token: string
) => {
  return injectRequest({
    method: "PATCH",
    url: `/api/drivers/${driverId}/location`,
    payload: buildLocationBody(params),
    headers: { authorization: `Bearer ${token}`, "content-type": JSONAPI },
    auth: false,
  });
};

/**
 * Create a ride in DISPATCHING state for dispatch tests
 */
const createDispatchingRide = async (
  riderToken: string,
  driverToken: string,
  riderId: string
) => {
  const createResp = await injectRequest({
    method: "POST",
    url: "/api/rides",
    payload: buildCreateRideBody(riderId),
    headers: { authorization: `Bearer ${riderToken}`, "content-type": JSONAPI },
    auth: false,
  });
  const rideId = JSON.parse(createResp.body).data.id;

  await injectRequest({
    method: "POST",
    url: `/api/rides/${rideId}/transitions`,
    payload: buildTransitionBody(RIDE_STATES.DISPATCHING),
    headers: {
      authorization: `Bearer ${driverToken}`,
      "content-type": JSONAPI,
    },
    auth: false,
  });

  return rideId;
};

// ============================================================================
// Test Suite
// ============================================================================

describe("Driver & Dispatch Integration Tests", () => {
  beforeAll(async () => {
    await getTestServer();
  });

  beforeEach(async () => {
    clearTokenCache();
    await cleanTestDatabase();
  });

  afterAll(async () => {
    await closeTestServer();
  });

  // ============================================================================
  // DRIVER STATE MACHINE
  // ============================================================================

  describe("Driver State Machine", () => {
    it("When registering a driver, then driver is created in OFFLINE state", async () => {
      const driverId = `driver-${randomUUID()}`;
      const token = await createDriverAuth(driverId);

      const response = await registerDriver(driverId, token);

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.attributes.state).toBe(DRIVER_STATES.OFFLINE);
      expect(body.data.id).toBe(driverId);
    });

    it("When updating availability OFFLINE->AVAILABLE, then state changes", async () => {
      const driverId = `driver-${randomUUID()}`;
      const token = await createDriverAuth(driverId);

      await registerDriver(driverId, token);
      const response = await setAvailability(driverId, "AVAILABLE", token);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.attributes.state).toBe(DRIVER_STATES.AVAILABLE);
    });

    it("When attempting invalid transition OFFLINE->BUSY, then returns 409", async () => {
      const driverId = `driver-${randomUUID()}`;
      const token = await createDriverAuth(driverId);

      await registerDriver(driverId, token);
      const response = await setAvailability(driverId, "BUSY", token);

      expect(response.statusCode).toBe(409);
    });

    it("When missing DRIVER_WRITE scope, then returns 403", async () => {
      const driverId = `driver-${randomUUID()}`;
      const token = await createDriverAuth(driverId, []);

      const response = await registerDriver(driverId, token);

      expect(response.statusCode).toBe(403);
    });
  });

  // ============================================================================
  // LOCATION UPDATES
  // ============================================================================

  describe("Location Updates", () => {
    it("When updating location with valid metadata, then location persisted", async () => {
      const driverId = `driver-${randomUUID()}`;
      const token = await createDriverAuth(driverId, [
        AUTH_SCOPES.DRIVER_WRITE,
        AUTH_SCOPES.DRIVER_READ,
      ]);

      await registerDriver(driverId, token);
      await setAvailability(driverId, "AVAILABLE", token);
      await updateLocation(
        driverId,
        {
          latitude: PICKUP_BOGOTA.lat,
          longitude: PICKUP_BOGOTA.lng,
          accuracy: 15,
        },
        token
      );

      const getResponse = await injectRequest({
        method: "GET",
        url: `/api/drivers/${driverId}`,
        headers: { authorization: `Bearer ${token}` },
        auth: false,
      });

      const body = JSON.parse(getResponse.body);
      expect(body.data.attributes.currentLocation.latitude).toBe(
        PICKUP_BOGOTA.lat
      );
      expect(body.data.attributes.currentLocation.longitude).toBe(
        PICKUP_BOGOTA.lng
      );
    });

    it("When updating location while OFFLINE, then returns error", async () => {
      const driverId = `driver-${randomUUID()}`;
      const token = await createDriverAuth(driverId);

      await registerDriver(driverId, token);
      const response = await updateLocation(
        driverId,
        { latitude: PICKUP_BOGOTA.lat, longitude: PICKUP_BOGOTA.lng },
        token
      );

      // Domain rejects location update for OFFLINE drivers
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  // ============================================================================
  // DISPATCH
  // ============================================================================

  describe("Dispatch", () => {
    it("When dispatching with eligible driver in radius, then returns 201", async () => {
      const riderId = `rider-${randomUUID()}`;
      const driverId = `driver-${randomUUID()}`;
      const riderToken = await createRiderAuthForRide(riderId);
      const driverToken = await createDriverAuth(driverId, [
        AUTH_SCOPES.DRIVER_WRITE,
        AUTH_SCOPES.RIDE_UPDATE,
      ]);
      const dispatchToken = await createDispatchAuth();

      const rideId = await createDispatchingRide(
        riderToken,
        driverToken,
        riderId
      );

      await registerDriver(driverId, driverToken);
      await setAvailability(driverId, "AVAILABLE", driverToken);
      await updateLocation(
        driverId,
        { latitude: NEAR_DRIVER_1.lat, longitude: NEAR_DRIVER_1.lng },
        driverToken
      );

      const dispatchResponse = await injectRequest({
        method: "POST",
        url: "/api/dispatch/requests",
        payload: buildDispatchBody(rideId),
        headers: {
          authorization: `Bearer ${dispatchToken}`,
          "content-type": JSONAPI,
          "idempotency-key": randomUUID(),
        },
        auth: false,
      });

      expect(dispatchResponse.statusCode).toBe(201);
      const body = JSON.parse(dispatchResponse.body);
      expect(body.data.attributes.driverId).toBe(driverId);
    });

    it("When dispatching with stale location driver only, then returns error", async () => {
      const riderId = `rider-${randomUUID()}`;
      const driverId = `driver-${randomUUID()}`;
      const riderToken = await createRiderAuthForRide(riderId);
      const driverToken = await createDriverAuth(driverId, [
        AUTH_SCOPES.DRIVER_WRITE,
        AUTH_SCOPES.RIDE_UPDATE,
      ]);
      const dispatchToken = await createDispatchAuth();

      const rideId = await createDispatchingRide(
        riderToken,
        driverToken,
        riderId
      );

      await registerDriver(driverId, driverToken);
      await setAvailability(driverId, "AVAILABLE", driverToken);

      const staleTime = new Date(Date.now() - 60_000).toISOString();
      await updateLocation(
        driverId,
        {
          latitude: NEAR_DRIVER_1.lat,
          longitude: NEAR_DRIVER_1.lng,
          recordedAt: staleTime,
        },
        driverToken
      );

      const dispatchResponse = await injectRequest({
        method: "POST",
        url: "/api/dispatch/requests",
        payload: buildDispatchBody(rideId),
        headers: {
          authorization: `Bearer ${dispatchToken}`,
          "content-type": JSONAPI,
          "idempotency-key": randomUUID(),
        },
        auth: false,
      });

      expect(dispatchResponse.statusCode).toBeGreaterThanOrEqual(400);
    });

    it("When two drivers at different distances, then nearest is selected", async () => {
      const riderId = `rider-${randomUUID()}`;
      const driver1Id = `driver-${randomUUID()}`;
      const driver2Id = `driver-${randomUUID()}`;
      const riderToken = await createRiderAuthForRide(riderId);
      const driver1Token = await createDriverAuth(driver1Id, [
        AUTH_SCOPES.DRIVER_WRITE,
        AUTH_SCOPES.RIDE_UPDATE,
      ]);
      const driver2Token = await createDriverAuth(driver2Id, [
        AUTH_SCOPES.DRIVER_WRITE,
        AUTH_SCOPES.RIDE_UPDATE,
      ]);
      const dispatchToken = await createDispatchAuth();

      const rideId = await createDispatchingRide(
        riderToken,
        driver1Token,
        riderId
      );

      // Register and position driver 1 (closer)
      await registerDriver(driver1Id, driver1Token);
      await setAvailability(driver1Id, "AVAILABLE", driver1Token);
      await updateLocation(
        driver1Id,
        { latitude: NEAR_DRIVER_1.lat, longitude: NEAR_DRIVER_1.lng },
        driver1Token
      );

      // Register and position driver 2 (farther)
      await registerDriver(driver2Id, driver2Token);
      await setAvailability(driver2Id, "AVAILABLE", driver2Token);
      await updateLocation(
        driver2Id,
        { latitude: NEAR_DRIVER_2.lat, longitude: NEAR_DRIVER_2.lng },
        driver2Token
      );

      const dispatchResponse = await injectRequest({
        method: "POST",
        url: "/api/dispatch/requests",
        payload: buildDispatchBody(rideId),
        headers: {
          authorization: `Bearer ${dispatchToken}`,
          "content-type": JSONAPI,
          "idempotency-key": randomUUID(),
        },
        auth: false,
      });

      const body = JSON.parse(dispatchResponse.body);
      expect(body.data.attributes.driverId).toBe(driver1Id);
    });

    it("When dispatch missing Idempotency-Key, then returns 400", async () => {
      const dispatchToken = await createDispatchAuth();

      const response = await injectRequest({
        method: "POST",
        url: "/api/dispatch/requests",
        payload: buildDispatchBody("some-ride"),
        headers: {
          authorization: `Bearer ${dispatchToken}`,
          "content-type": JSONAPI,
        },
        auth: false,
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
