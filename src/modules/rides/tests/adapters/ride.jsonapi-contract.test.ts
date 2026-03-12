/**
 * Ride JSON:API Contract Tests
 *
 * Validates HTTP boundary: media types, status codes, response shape.
 * Does NOT assert internal DB state or business logic.
 * Follows Testing Rules for AI: flat bodies, AAA, ≤3 assertions.
 */

import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRiderId } from "../../../../shared/types/ids/rider-id.js";
import { createRideRoutes } from "../../adapters/inbound/ride.jsonapi-routes.js";
import { CreateRideUseCase } from "../../application/use-cases/create-ride.js";
import { GetRideUseCase } from "../../application/use-cases/get-ride.js";
import { ListRidesUseCase } from "../../application/use-cases/list-rides.js";
import { TransitionRideUseCase } from "../../application/use-cases/transition-ride.js";
import { RIDE_STATES } from "../../domain/ride-states.js";
import { FakeClock, FakeRideRepository } from "../helpers/faked-ports.js";

const APPLICATION_VND_API_JSON = "application/vnd.api+json";

/**
 * Register application/vnd.api+json content-type parser so Fastify
 * accepts JSON:API requests (by default only application/json is parsed).
 */
const addJsonApiParser = (app: FastifyInstance): void => {
  app.addContentTypeParser(
    APPLICATION_VND_API_JSON,
    { parseAs: "string" },
    (_req, body, done) => {
      try {
        done(null, JSON.parse(body as string));
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );
};

describe("POST /api/rides", () => {
  let app: FastifyInstance;
  let repository: FakeRideRepository;
  let clock: FakeClock;

  beforeEach(async () => {
    repository = new FakeRideRepository();
    clock = new FakeClock("2026-02-13T14:00:00.000Z");

    const createRideUseCase = new CreateRideUseCase(repository, clock);
    const transitionRideUseCase = new TransitionRideUseCase(repository, clock);
    const getRideUseCase = new GetRideUseCase(repository);
    const listRidesUseCase = new ListRidesUseCase(repository);

    app = Fastify({ logger: false });
    addJsonApiParser(app);
    // Mock auth - add dummy user to all requests
    app.addHook("onRequest", async (request) => {
      (request as any).user = {
        id: "test-user-1",
        role: "rider",
        riderId: "test-rider-1",
        scopes: ["ride:create", "ride:read", "ride:update"],
      };
    });
    await app.register(
      createRideRoutes({
        createRideUseCase,
        transitionRideUseCase,
        getRideUseCase,
        listRidesUseCase,
      }),
      { prefix: "/api/rides" }
    );
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("should return 201 with application/vnd.api+json media type", async () => {
    // Arrange
    const requestBody = {
      data: {
        type: "rides",
        attributes: {
          riderId: createRiderId("test-rider-1"),
          pickup: { lat: 4.6097, lng: -74.0817 },
          dropoff: { lat: 4.6517, lng: -74.063 },
        },
      },
    };

    // Act
    const response = await app.inject({
      method: "POST",
      url: "/api/rides",
      headers: {
        "content-type": APPLICATION_VND_API_JSON,
      },
      payload: requestBody,
    });

    // Assert
    expect(response.statusCode).toBe(201);
    expect(response.headers["content-type"]).toContain(
      APPLICATION_VND_API_JSON
    );
  });

  it("should return stable JSON:API resource shape", async () => {
    // Arrange
    const requestBody = {
      data: {
        type: "rides",
        attributes: {
          riderId: createRiderId("test-rider-1"),
          pickup: { lat: 4.6097, lng: -74.0817 },
          dropoff: { lat: 4.6517, lng: -74.063 },
        },
      },
    };

    // Act
    const response = await app.inject({
      method: "POST",
      url: "/api/rides",
      headers: {
        "content-type": APPLICATION_VND_API_JSON,
      },
      payload: requestBody,
    });
    const body = JSON.parse(response.body);

    // Assert
    expect(body.data).toHaveProperty("type", "rides");
    expect(body.data).toHaveProperty("id");
    expect(body.data).toHaveProperty("attributes");
  });
});

describe("POST /api/rides/:id/transitions", () => {
  let app: FastifyInstance;
  let repository: FakeRideRepository;
  let clock: FakeClock;
  let rideId: string;

  beforeEach(async () => {
    repository = new FakeRideRepository();
    clock = new FakeClock("2026-02-13T14:00:00.000Z");

    const createRideUseCase = new CreateRideUseCase(repository, clock);
    const transitionRideUseCase = new TransitionRideUseCase(repository, clock);
    const getRideUseCase = new GetRideUseCase(repository);
    const listRidesUseCase = new ListRidesUseCase(repository);

    app = Fastify({ logger: false });
    addJsonApiParser(app);
    // Mock auth - add dummy user to all requests
    app.addHook("onRequest", async (request) => {
      (request as any).user = {
        id: "test-user-1",
        role: "rider",
        riderId: "test-rider-1",
        scopes: ["ride:create", "ride:read", "ride:update"],
      };
    });
    await app.register(
      createRideRoutes({
        createRideUseCase,
        transitionRideUseCase,
        getRideUseCase,
        listRidesUseCase,
      }),
      { prefix: "/api/rides" }
    );
    await app.ready();

    // Create a ride first
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/rides",
      headers: {
        "content-type": APPLICATION_VND_API_JSON,
      },
      payload: {
        data: {
          type: "rides",
          attributes: {
            riderId: createRiderId("test-rider-1"),
            pickup: { lat: 4.6097, lng: -74.0817 },
            dropoff: { lat: 4.6517, lng: -74.063 },
          },
        },
      },
    });
    const createBody = JSON.parse(createResponse.body);
    rideId = createBody.data.id;
  });

  afterEach(async () => {
    await app.close();
  });

  it("should return 200 with application/vnd.api+json media type", async () => {
    // Arrange
    const requestBody = {
      data: {
        type: "ride-transitions",
        attributes: {
          toState: RIDE_STATES.DISPATCHING,
        },
      },
    };

    // Act
    const response = await app.inject({
      method: "POST",
      url: `/api/rides/${rideId}/transitions`,
      headers: {
        "content-type": APPLICATION_VND_API_JSON,
      },
      payload: requestBody,
    });

    // Assert
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain(
      APPLICATION_VND_API_JSON
    );
  });
});

describe("GET /api/rides/:id", () => {
  let app: FastifyInstance;
  let repository: FakeRideRepository;
  let clock: FakeClock;
  let rideId: string;

  beforeEach(async () => {
    repository = new FakeRideRepository();
    clock = new FakeClock("2026-02-13T14:00:00.000Z");

    const createRideUseCase = new CreateRideUseCase(repository, clock);
    const transitionRideUseCase = new TransitionRideUseCase(repository, clock);
    const getRideUseCase = new GetRideUseCase(repository);
    const listRidesUseCase = new ListRidesUseCase(repository);

    app = Fastify({ logger: false });
    addJsonApiParser(app);
    // Mock auth - add dummy user to all requests
    app.addHook("onRequest", async (request) => {
      (request as any).user = {
        id: "test-user-1",
        role: "rider",
        riderId: "test-rider-1",
        scopes: ["ride:create", "ride:read", "ride:update"],
      };
    });
    await app.register(
      createRideRoutes({
        createRideUseCase,
        transitionRideUseCase,
        getRideUseCase,
        listRidesUseCase,
      }),
      { prefix: "/api/rides" }
    );
    await app.ready();

    // Create a ride first
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/rides",
      headers: {
        "content-type": APPLICATION_VND_API_JSON,
      },
      payload: {
        data: {
          type: "rides",
          attributes: {
            riderId: createRiderId("test-rider-1"),
            pickup: { lat: 4.6097, lng: -74.0817 },
            dropoff: { lat: 4.6517, lng: -74.063 },
          },
        },
      },
    });
    const createBody = JSON.parse(createResponse.body);
    rideId = createBody.data.id;
  });

  afterEach(async () => {
    await app.close();
  });

  it("should return 200 with application/vnd.api+json media type", async () => {
    // Act
    const response = await app.inject({
      method: "GET",
      url: `/api/rides/${rideId}`,
    });

    // Assert
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain(
      APPLICATION_VND_API_JSON
    );
  });
});

describe("GET /api/rides", () => {
  let app: FastifyInstance;
  let repository: FakeRideRepository;
  let clock: FakeClock;

  beforeEach(async () => {
    repository = new FakeRideRepository();
    clock = new FakeClock("2026-02-13T14:00:00.000Z");

    const createRideUseCase = new CreateRideUseCase(repository, clock);
    const transitionRideUseCase = new TransitionRideUseCase(repository, clock);
    const getRideUseCase = new GetRideUseCase(repository);
    const listRidesUseCase = new ListRidesUseCase(repository);

    app = Fastify({ logger: false });
    addJsonApiParser(app);
    // Mock auth - add dummy user to all requests
    app.addHook("onRequest", async (request) => {
      (request as any).user = {
        id: "test-user-1",
        role: "rider",
        riderId: "test-rider-1",
        scopes: ["ride:create", "ride:read", "ride:update"],
      };
    });
    await app.register(
      createRideRoutes({
        createRideUseCase,
        transitionRideUseCase,
        getRideUseCase,
        listRidesUseCase,
      }),
      { prefix: "/api/rides" }
    );
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("should return 200 with pagination links", async () => {
    // Act
    const response = await app.inject({
      method: "GET",
      url: "/api/rides",
    });
    const body = JSON.parse(response.body);

    // Assert
    expect(response.statusCode).toBe(200);
    expect(body).toHaveProperty("links");
    expect(body.links).toHaveProperty("self");
  });

  it("should return application/vnd.api+json media type", async () => {
    // Act
    const response = await app.inject({
      method: "GET",
      url: "/api/rides",
    });

    // Assert
    expect(response.headers["content-type"]).toContain(
      APPLICATION_VND_API_JSON
    );
  });
});
