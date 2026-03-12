/**
 * Fare Calculation Integration Tests
 *
 * These tests validate Phase 4 success criteria through the full HTTP stack:
 * HTTP -> Zod validation -> auth middleware -> service -> repository -> PostgreSQL
 *
 * Tests run against real PostgreSQL via Testcontainers for maximum confidence.
 *
 * Note: Fare endpoints do not require ride existence in the database.
 * The rideId is used as a key for idempotency, not validated against a rides table.
 * FARE-05 (auto-calculation on ride completion) is tested separately once ride
 * JSON:API routes are fully wired.
 */

import { randomUUID } from "node:crypto";
import type { InjectOptions } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { buildFareCalculation } from "../../test/data/fare-http.factory.js";
import {
  createAuthHeader,
  type TestUserType,
} from "../../test/helpers/test-auth.js";
import { initTestDb } from "../../test/helpers/test-db.js";
import { FareCalculationModel } from "./infrastructure/fare-calculation.model.js";

/** Generate a unique ride ID for test isolation. */
const uniqueRideId = () => `ride-${randomUUID()}`;

describe("Fare Calculation Integration Tests", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  /** Inject an authenticated request. */
  const inject = async (
    method: string,
    url: string,
    payload?: unknown,
    auth: TestUserType | false = "driver"
  ) => {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (auth !== false) {
      headers.authorization = await createAuthHeader(auth);
    }
    return app.inject({
      method: method as InjectOptions["method"],
      url,
      payload: payload as InjectOptions["payload"],
      headers,
    });
  };

  beforeAll(async () => {
    // Build app first (registers models with app sequelize)
    app = await buildApp();
    await initTestDb();
    await app.ready();
  });

  beforeEach(async () => {
    // Only truncate fare_calculations table (not auth tables which would invalidate tokens)
    await FareCalculationModel.destroy({ where: {}, truncate: true });
  });

  afterAll(async () => {
    await app.close();
  });

  // ============================================================================
  // FARE-01: Fare input validation
  // ============================================================================

  describe("FARE-01: Fare input validation", () => {
    it("accepts valid fare inputs (baseFareCOP, distanceKm, durationMinutes)", async () => {
      const rideId = uniqueRideId();

      const response = await inject(
        "POST",
        "/api/v1/fares",
        buildFareCalculation({
          rideId,
          baseFareCOP: 3500,
          distanceKm: 5.2,
          durationMinutes: 12,
        })
      );

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.totalFareCOP).toBeDefined();
      expect(body.breakdown).toBeDefined();
      expect(body.pricingVersion).toBe("v1.0.0");
    });

    it("rejects negative baseFareCOP", async () => {
      const response = await inject(
        "POST",
        "/api/v1/fares",
        buildFareCalculation({ rideId: uniqueRideId(), baseFareCOP: -1 })
      );

      expect(response.statusCode).toBe(400);
    });

    it("rejects negative distanceKm", async () => {
      const response = await inject(
        "POST",
        "/api/v1/fares",
        buildFareCalculation({ rideId: uniqueRideId(), distanceKm: -1 })
      );

      expect(response.statusCode).toBe(400);
    });

    it("rejects missing required fields", async () => {
      const response = await inject("POST", "/api/v1/fares", {});

      expect(response.statusCode).toBe(400);
    });
  });

  // ============================================================================
  // FARE-02: Deterministic fare calculation
  // ============================================================================

  describe("FARE-02: Deterministic fare calculation", () => {
    it("calculates fare deterministically with Math.ceil rounding", async () => {
      const rideId = uniqueRideId();

      const response = await inject(
        "POST",
        "/api/v1/fares",
        buildFareCalculation({
          rideId,
          baseFareCOP: 3500,
          distanceKm: 3.333,
          durationMinutes: 7.5,
        })
      );

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      expect(body.breakdown.distanceComponent).toBe(4000);
      expect(body.breakdown.timeComponent).toBe(1500);
      expect(body.totalFareCOP).toBe(9000);
      expect(body.breakdown.minimumApplied).toBe(false);
    });
  });

  // ============================================================================
  // FARE-03: Minimum fare enforcement
  // ============================================================================

  describe("FARE-03: Minimum fare enforcement", () => {
    it("applies minimum fare when calculated total is below 5,000 COP", async () => {
      const rideId = uniqueRideId();

      const response = await inject(
        "POST",
        "/api/v1/fares",
        buildFareCalculation({
          rideId,
          baseFareCOP: 1000,
          distanceKm: 0.5,
          durationMinutes: 1,
        })
      );

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      expect(body.totalFareCOP).toBe(5000);
      expect(body.breakdown.minimumApplied).toBe(true);
    });

    it("does not apply minimum when total equals 5,000 COP", async () => {
      const rideId = uniqueRideId();

      const response = await inject(
        "POST",
        "/api/v1/fares",
        buildFareCalculation({
          rideId,
          baseFareCOP: 5000,
          distanceKm: 0,
          durationMinutes: 0,
        })
      );

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      expect(body.totalFareCOP).toBe(5000);
      expect(body.breakdown.minimumApplied).toBe(false);
    });
  });

  // ============================================================================
  // FARE-04: Fare breakdown
  // ============================================================================

  describe("FARE-04: Fare breakdown", () => {
    it("returns fare breakdown showing base, distance, time, and minimumApplied", async () => {
      const rideId = uniqueRideId();

      const response = await inject(
        "POST",
        "/api/v1/fares",
        buildFareCalculation({
          rideId,
          baseFareCOP: 3500,
          distanceKm: 5.2,
          durationMinutes: 12,
        })
      );

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      expect(body.breakdown.baseFare).toBe(3500);
      expect(body.breakdown.distanceComponent).toBe(Math.ceil(5.2 * 1200));
      expect(body.breakdown.timeComponent).toBe(Math.ceil(12 * 200));
      expect(body.breakdown.minimumApplied).toBe(false);

      const expectedTotal = 3500 + 6240 + 2400;
      expect(body.totalFareCOP).toBe(expectedTotal);
    });
  });

  // ============================================================================
  // FARE-06: Fare immutability
  // ============================================================================

  describe("FARE-06: Fare immutability", () => {
    it("returns existing fare on duplicate calculation (idempotent)", async () => {
      const rideId = uniqueRideId();

      const firstResponse = await inject(
        "POST",
        "/api/v1/fares",
        buildFareCalculation({ rideId })
      );
      expect(firstResponse.statusCode).toBe(201);
      const firstBody = JSON.parse(firstResponse.body);

      // Second calculation returns same fare (idempotent, not conflict)
      const secondResponse = await inject(
        "POST",
        "/api/v1/fares",
        buildFareCalculation({ rideId })
      );
      expect(secondResponse.statusCode).toBe(201);

      const secondBody = JSON.parse(secondResponse.body);
      expect(secondBody.id).toBe(firstBody.id);
      expect(secondBody.totalFareCOP).toBe(firstBody.totalFareCOP);
    });
  });

  // ============================================================================
  // FARE-07: Audit evidence
  // ============================================================================

  describe("FARE-07: Audit evidence", () => {
    it("stores complete audit evidence: inputs, timestamp, pricing version", async () => {
      const rideId = uniqueRideId();
      const inputs = {
        rideId,
        baseFareCOP: 3500,
        distanceKm: 5.2,
        durationMinutes: 12,
      };

      const calcResponse = await inject(
        "POST",
        "/api/v1/fares",
        buildFareCalculation(inputs)
      );
      expect(calcResponse.statusCode).toBe(201);

      // Retrieve fare to verify audit evidence
      const getResponse = await inject(
        "GET",
        `/api/v1/rides/${rideId}/fare`,
        undefined,
        "rider"
      );
      expect(getResponse.statusCode).toBe(200);

      const body = JSON.parse(getResponse.body);

      expect(body.id).toBeDefined();
      expect(body.totalFareCOP).toBe(12_140);
      expect(body.breakdown.baseFare).toBe(inputs.baseFareCOP);
      expect(body.pricingVersion).toBe("v1.0.0");
      expect(body.calculatedAt).toBeDefined();

      const calculatedAtDate = new Date(body.calculatedAt);
      expect(calculatedAtDate.getTime()).toBeGreaterThan(0);
      expect(body.calculatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  // ============================================================================
  // Additional tests
  // ============================================================================

  describe("Additional edge cases", () => {
    it("returns 404 for fare on ride without fare calculation", async () => {
      const fareResponse = await inject(
        "GET",
        `/api/v1/rides/${uniqueRideId()}/fare`,
        undefined,
        "rider"
      );

      expect(fareResponse.statusCode).toBe(404);
    });

    it("rejects unauthenticated requests", async () => {
      const response = await inject(
        "POST",
        "/api/v1/fares",
        buildFareCalculation(),
        false
      );

      expect(response.statusCode).toBe(401);
    });
  });
});
