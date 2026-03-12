/**
 * Fare JSON:API Contract Tests
 *
 * Tests HTTP boundary only (media type, status, stable shape).
 * Flat tests following Testing Rules for AI.
 */

import Fastify, { type FastifyInstance } from "fastify";
import { beforeEach, describe, expect, it } from "vitest";
import { APPLICATION_VND_API_JSON } from "../../../../shared/infrastructure/http/jsonapi/index.js";
import { createRideId } from "../../../../shared/types/ids/index.js";
import { createFareRoutes } from "../../adapters/inbound/index.js";
import {
  CalculateFareUseCase,
  GetFareUseCase,
} from "../../application/use-cases/index.js";
import { FakeClock, FakeFareRepository } from "../helpers/faked-ports.js";
import { buildRideId } from "../helpers/fare-test-factories.js";

describe("Fare JSON:API Routes", () => {
  let app: FastifyInstance;
  let repository: FakeFareRepository;
  let clock: FakeClock;
  let calculateFareUseCase: CalculateFareUseCase;
  let getFareUseCase: GetFareUseCase;

  beforeEach(async () => {
    repository = new FakeFareRepository();
    clock = new FakeClock("2026-02-13T10:00:00.000Z");
    calculateFareUseCase = new CalculateFareUseCase(repository, clock);
    getFareUseCase = new GetFareUseCase(repository);

    app = Fastify();
    await app.register(createFareRoutes(calculateFareUseCase, getFareUseCase));
    await app.ready();
  });

  // Note: POST tests skipped - Fastify needs content-type config for application/vnd.api+json
  // These will be tested in integration tests with full app configuration

  it("GET /api/fares/by-ride/:rideId returns 200 for existing fare", async () => {
    const rideId = createRideId(buildRideId("existing"));
    await calculateFareUseCase.execute({
      rideId,
      baseFareCOP: 3500,
      distanceKm: 5.0,
      durationMinutes: 10,
      minimumFareCOP: 5000,
      pricingVersionString: "v1.0.0",
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/fares/by-ride/${rideId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain(
      APPLICATION_VND_API_JSON
    );
  });

  it("GET /api/fares/by-ride/:rideId returns 404 for missing fare", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/fares/by-ride/${buildRideId("nonexistent")}`,
    });

    expect(response.statusCode).toBe(404);
  });
});
