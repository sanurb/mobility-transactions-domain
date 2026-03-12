/**
 * Ride Lifecycle Integration Tests
 *
 * Validates ride lifecycle through the JSON:API HTTP stack:
 * HTTP -> JSON:API validation -> auth middleware -> use cases -> repository -> PostgreSQL
 *
 * Routes under test (JSON:API at /api/rides):
 * - POST /api/rides              (create ride)
 * - POST /api/rides/:id/transitions (transition ride state)
 * - GET  /api/rides/:id          (get ride)
 * - GET  /api/rides              (list rides)
 *
 * Tests run against real PostgreSQL via Testcontainers for maximum confidence.
 */

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
import { RIDE_STATES } from "./domain/ride-states.js";

const JSONAPI = "application/vnd.api+json";

/**
 * Build JSON:API ride creation body
 */
const buildCreateRideBody = (params: {
  riderId: string;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
}) => ({
  data: {
    type: "rides" as const,
    attributes: {
      riderId: params.riderId,
      pickup: params.pickup,
      dropoff: params.dropoff,
    },
  },
});

/**
 * Build JSON:API ride transition body
 */
const buildTransitionBody = (
  toState: string,
  reason?: string,
  driverId?: string
) => ({
  data: {
    type: "ride-transitions" as const,
    attributes: {
      toState,
      ...(reason ? { reason } : {}),
      ...(driverId ? { driverId } : {}),
    },
  },
});

/**
 * Create a ride via JSON:API and return the ride data
 */
const createRide = async (
  token: string,
  riderId: string,
  pickup = { lat: 4.711, lng: -74.0721 },
  dropoff = { lat: 4.8, lng: -74.2 }
) => {
  const response = await injectRequest({
    method: "POST",
    url: "/api/rides",
    payload: buildCreateRideBody({ riderId, pickup, dropoff }),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": JSONAPI,
    },
    auth: false,
  });
  return { response, body: JSON.parse(response.body) };
};

/**
 * Transition a ride and return the response
 */
const transitionRide = async (
  token: string,
  rideId: string,
  toState: string,
  reason?: string,
  driverId?: string
) => {
  const response = await injectRequest({
    method: "POST",
    url: `/api/rides/${rideId}/transitions`,
    payload: buildTransitionBody(toState, reason, driverId),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": JSONAPI,
    },
    auth: false,
  });
  return { response, body: JSON.parse(response.body) };
};

describe("Ride Lifecycle Integration Tests", () => {
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
  // POST /api/rides - Create Ride
  // ============================================================================

  describe("POST /api/rides - Create Ride", () => {
    it("should create a ride in CREATED state", async () => {
      const riderId = "rider-test-001";
      const token = await createCustomTestToken({
        sub: riderId,
        tenantId: "test-tenant",
        riderId,
        scopes: [AUTH_SCOPES.RIDE_CREATE, AUTH_SCOPES.RIDE_READ],
      });

      const { response, body } = await createRide(
        token,
        riderId,
        { lat: 37.7749, lng: -122.4194 },
        { lat: 37.8049, lng: -122.4094 }
      );

      expect(response.statusCode).toBe(201);
      expect(body.data.id).toBeDefined();
      expect(body.data.attributes.state).toBe(RIDE_STATES.CREATED);
      expect(body.data.attributes.riderId).toBe(riderId);
    });

    it("should reject unauthenticated request with 401", async () => {
      const response = await injectRequest({
        method: "POST",
        url: "/api/rides",
        payload: buildCreateRideBody({
          riderId: "rider-001",
          pickup: { lat: 37.7749, lng: -122.4194 },
          dropoff: { lat: 37.8049, lng: -122.4094 },
        }),
        headers: { "content-type": JSONAPI },
        auth: false,
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject request without ride:create scope with 403", async () => {
      const token = await createCustomTestToken({
        sub: "test-user-no-scopes",
        tenantId: "test-tenant",
        riderId: "rider-002",
        scopes: [],
      });

      const response = await injectRequest({
        method: "POST",
        url: "/api/rides",
        payload: buildCreateRideBody({
          riderId: "rider-002",
          pickup: { lat: 37.7749, lng: -122.4194 },
          dropoff: { lat: 37.8049, lng: -122.4094 },
        }),
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": JSONAPI,
        },
        auth: false,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  // ============================================================================
  // POST /api/rides/:id/transitions - State Transitions
  // ============================================================================

  describe("POST /api/rides/:id/transitions - State Transitions", () => {
    it("should transition through full happy path", async () => {
      const riderId = "rider-happy-path";
      const riderToken = await createCustomTestToken({
        sub: riderId,
        tenantId: "test-tenant",
        riderId,
        scopes: [AUTH_SCOPES.RIDE_CREATE, AUTH_SCOPES.RIDE_READ],
      });

      const driverToken = await createCustomTestToken({
        sub: "test-driver-001",
        tenantId: "test-tenant",
        driverId: "driver-001",
        scopes: [AUTH_SCOPES.RIDE_UPDATE, AUTH_SCOPES.RIDE_READ],
      });

      // Create ride
      const { body: createBody } = await createRide(riderToken, riderId);
      expect(createBody.data.attributes.state).toBe(RIDE_STATES.CREATED);
      const rideId = createBody.data.id;

      // CREATED -> DISPATCHING
      const { body: dispBody } = await transitionRide(
        driverToken,
        rideId,
        RIDE_STATES.DISPATCHING
      );
      expect(dispBody.data.attributes.state).toBe(RIDE_STATES.DISPATCHING);

      // DISPATCHING -> ASSIGNED (requires driverId)
      const { body: assignBody } = await transitionRide(
        driverToken,
        rideId,
        RIDE_STATES.ASSIGNED,
        undefined,
        "driver-001"
      );
      expect(assignBody.data.attributes.state).toBe(RIDE_STATES.ASSIGNED);

      // ASSIGNED -> STARTED
      const { body: startBody } = await transitionRide(
        driverToken,
        rideId,
        RIDE_STATES.STARTED
      );
      expect(startBody.data.attributes.state).toBe(RIDE_STATES.STARTED);

      // STARTED -> COMPLETED
      const { body: completeBody } = await transitionRide(
        driverToken,
        rideId,
        RIDE_STATES.COMPLETED
      );
      expect(completeBody.data.attributes.state).toBe(RIDE_STATES.COMPLETED);
    });

    it("should allow rider to cancel from CREATED", async () => {
      const riderId = "rider-cancel-created";
      const riderToken = await createCustomTestToken({
        sub: riderId,
        tenantId: "test-tenant",
        riderId,
        scopes: [
          AUTH_SCOPES.RIDE_CREATE,
          AUTH_SCOPES.RIDE_UPDATE,
          AUTH_SCOPES.RIDE_READ,
        ],
      });

      const { body: createBody } = await createRide(riderToken, riderId);
      const rideId = createBody.data.id;

      const { response } = await transitionRide(
        riderToken,
        rideId,
        RIDE_STATES.CANCELED,
        "Changed my mind"
      );
      expect(response.statusCode).toBe(200);
    });

    it("should reject illegal state transition CREATED->COMPLETED", async () => {
      const riderId = "rider-illegal-transition";
      const riderToken = await createCustomTestToken({
        sub: riderId,
        tenantId: "test-tenant",
        riderId,
        scopes: [AUTH_SCOPES.RIDE_CREATE, AUTH_SCOPES.RIDE_READ],
      });

      const driverToken = await createCustomTestToken({
        sub: "test-driver-001",
        tenantId: "test-tenant",
        driverId: "driver-001",
        scopes: [AUTH_SCOPES.RIDE_UPDATE, AUTH_SCOPES.RIDE_READ],
      });

      const { body: createBody } = await createRide(riderToken, riderId);
      const rideId = createBody.data.id;

      const { response } = await transitionRide(
        driverToken,
        rideId,
        RIDE_STATES.COMPLETED
      );
      expect(response.statusCode).toBe(409);
    });

    it("should reject modification of terminal state COMPLETED", async () => {
      const riderId = "rider-terminal-completed";
      const riderToken = await createCustomTestToken({
        sub: riderId,
        tenantId: "test-tenant",
        riderId,
        scopes: [AUTH_SCOPES.RIDE_CREATE, AUTH_SCOPES.RIDE_READ],
      });

      const driverToken = await createCustomTestToken({
        sub: "test-driver-001",
        tenantId: "test-tenant",
        driverId: "driver-001",
        scopes: [AUTH_SCOPES.RIDE_UPDATE, AUTH_SCOPES.RIDE_READ],
      });

      const { body: createBody } = await createRide(riderToken, riderId);
      const rideId = createBody.data.id;

      await transitionRide(driverToken, rideId, RIDE_STATES.DISPATCHING);
      await transitionRide(
        driverToken,
        rideId,
        RIDE_STATES.ASSIGNED,
        undefined,
        "driver-001"
      );
      await transitionRide(driverToken, rideId, RIDE_STATES.STARTED);
      await transitionRide(driverToken, rideId, RIDE_STATES.COMPLETED);

      const { response } = await transitionRide(
        driverToken,
        rideId,
        RIDE_STATES.FAILED
      );
      expect(response.statusCode).toBe(409);
    });

    it("should handle concurrent terminal transitions - exactly one wins", async () => {
      const riderId = "rider-concurrent";
      const riderToken = await createCustomTestToken({
        sub: riderId,
        tenantId: "test-tenant",
        riderId,
        scopes: [AUTH_SCOPES.RIDE_CREATE, AUTH_SCOPES.RIDE_READ],
      });

      const driverToken = await createCustomTestToken({
        sub: "test-driver-001",
        tenantId: "test-tenant",
        driverId: "driver-001",
        scopes: [AUTH_SCOPES.RIDE_UPDATE, AUTH_SCOPES.RIDE_READ],
      });

      const { body: createBody } = await createRide(riderToken, riderId);
      const rideId = createBody.data.id;

      await transitionRide(driverToken, rideId, RIDE_STATES.DISPATCHING);
      await transitionRide(
        driverToken,
        rideId,
        RIDE_STATES.ASSIGNED,
        undefined,
        "driver-001"
      );
      await transitionRide(driverToken, rideId, RIDE_STATES.STARTED);

      const app = await getTestServer();
      const payload = buildTransitionBody(RIDE_STATES.COMPLETED);
      const headers = {
        authorization: `Bearer ${driverToken}`,
        "content-type": JSONAPI,
      };

      const [response1, response2] = await Promise.all([
        app.inject({
          method: "POST",
          url: `/api/rides/${rideId}/transitions`,
          payload,
          headers,
        }),
        app.inject({
          method: "POST",
          url: `/api/rides/${rideId}/transitions`,
          payload,
          headers,
        }),
      ]);

      const statusCodes = [response1.statusCode, response2.statusCode].sort();
      expect(statusCodes).toEqual([200, 409]);
    });
  });

  // ============================================================================
  // GET /api/rides/:id - Query Ride
  // ============================================================================

  describe("GET /api/rides/:id - Query Ride", () => {
    it("should return ride with current state", async () => {
      const riderId = "rider-query";
      const token = await createCustomTestToken({
        sub: riderId,
        tenantId: "test-tenant",
        riderId,
        scopes: [AUTH_SCOPES.RIDE_CREATE, AUTH_SCOPES.RIDE_READ],
      });

      const { body: createBody } = await createRide(token, riderId);
      const rideId = createBody.data.id;

      const getResponse = await injectRequest({
        method: "GET",
        url: `/api/rides/${rideId}`,
        headers: { authorization: `Bearer ${token}` },
        auth: false,
      });

      expect(getResponse.statusCode).toBe(200);
      const body = JSON.parse(getResponse.body);
      expect(body.data.attributes.state).toBe(RIDE_STATES.CREATED);
      expect(body.data.attributes.riderId).toBe(riderId);
    });

    it("should return 404 for non-existent ride", async () => {
      const token = await createCustomTestToken({
        sub: "rider-404",
        tenantId: "test-tenant",
        riderId: "rider-404",
        scopes: [AUTH_SCOPES.RIDE_READ],
      });

      const getResponse = await injectRequest({
        method: "GET",
        url: "/api/rides/non-existent-id",
        headers: { authorization: `Bearer ${token}` },
        auth: false,
      });

      expect(getResponse.statusCode).toBe(404);
    });
  });

  // ============================================================================
  // GET /api/rides - List Rides
  // ============================================================================

  describe("GET /api/rides - List Rides", () => {
    it("should return paginated ride list", async () => {
      const riderId = "rider-list";
      const createToken = await createCustomTestToken({
        sub: riderId,
        tenantId: "test-tenant",
        riderId,
        scopes: [AUTH_SCOPES.RIDE_CREATE, AUTH_SCOPES.RIDE_READ],
      });

      // Admin token for listing (bypasses rider_id filter)
      const adminToken = await createCustomTestToken({
        sub: "admin-list",
        tenantId: "test-tenant",
        scopes: [AUTH_SCOPES.ADMIN_READ, AUTH_SCOPES.RIDE_READ],
      });

      // Create 3 rides
      await createRide(createToken, riderId);
      await createRide(createToken, riderId);
      await createRide(createToken, riderId);

      const listResponse = await injectRequest({
        method: "GET",
        url: "/api/rides?page[limit]=2&page[offset]=0",
        headers: { authorization: `Bearer ${adminToken}` },
        auth: false,
      });

      expect(listResponse.statusCode).toBe(200);
      const body = JSON.parse(listResponse.body);
      expect(body.data).toHaveLength(2);
      expect(body.meta.total).toBe(3);
    });

    it("should filter by state", async () => {
      const riderId = "rider-filter";
      const riderToken = await createCustomTestToken({
        sub: riderId,
        tenantId: "test-tenant",
        riderId,
        scopes: [AUTH_SCOPES.RIDE_CREATE, AUTH_SCOPES.RIDE_READ],
      });

      const driverToken = await createCustomTestToken({
        sub: "test-driver-001",
        tenantId: "test-tenant",
        driverId: "driver-001",
        scopes: [AUTH_SCOPES.RIDE_UPDATE, AUTH_SCOPES.RIDE_READ],
      });

      // Admin token for listing (bypasses rider_id filter)
      const adminToken = await createCustomTestToken({
        sub: "admin-filter",
        tenantId: "test-tenant",
        scopes: [AUTH_SCOPES.ADMIN_READ, AUTH_SCOPES.RIDE_READ],
      });

      // Create 2 rides, transition one to DISPATCHING
      await createRide(riderToken, riderId);
      const { body: ride2Body } = await createRide(riderToken, riderId);
      await transitionRide(
        driverToken,
        ride2Body.data.id,
        RIDE_STATES.DISPATCHING
      );

      const listResponse = await injectRequest({
        method: "GET",
        url: "/api/rides?filter[state]=CREATED",
        headers: { authorization: `Bearer ${adminToken}` },
        auth: false,
      });

      expect(listResponse.statusCode).toBe(200);
      const body = JSON.parse(listResponse.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].attributes.state).toBe(RIDE_STATES.CREATED);
    });
  });
});
