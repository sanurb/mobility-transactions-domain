/**
 * Driver JSON:API Contract Tests
 *
 * Validates HTTP boundary: media types, status codes, response shape.
 * Does NOT assert internal DB state or business logic.
 * Follows Testing Rules for AI: flat bodies, AAA, ≤3 assertions.
 */

import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { IEventBus } from "../../../../shared/infrastructure/events/event-bus.js";
import { createDriverRoutes } from "../../adapters/inbound/driver.jsonapi-routes.js";
import { DriverService } from "../../application/driver.service.js";
import { DRIVER_STATES } from "../../domain/driver-states.js";
import {
  FakeClock,
  FakeDriverRepository,
  FakeGeoIndex,
} from "../helpers/faked-ports.js";

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

/**
 * Fake EventBus for contract tests
 */
class FakeEventBus implements IEventBus {
  async publish(): Promise<void> {
    // No-op for contract tests
  }
  subscribe(): () => void {
    return () => {
      // No-op unsubscribe for contract tests
    };
  }
  subscribeAll(): () => void {
    return () => {
      // No-op unsubscribe for contract tests
    };
  }
  clear(): void {
    // No-op for contract tests
  }
}

describe("POST /api/drivers", () => {
  let app: FastifyInstance;
  let repository: FakeDriverRepository;

  beforeEach(async () => {
    repository = new FakeDriverRepository();
    const geoIndex = new FakeGeoIndex();
    const eventBus = new FakeEventBus();
    const clock = new FakeClock();
    const driverService = new DriverService(
      repository,
      geoIndex,
      eventBus,
      clock
    );

    app = Fastify({ logger: false });
    addJsonApiParser(app);
    app.addHook("onRequest", async (request) => {
      (request as { user?: unknown }).user = {
        id: "test-user-1",
        role: "driver",
        driverId: "test-driver-1",
        scopes: ["driver:read", "driver:write"],
      };
    });
    await app.register(createDriverRoutes({ driverService }), {
      prefix: "/api/drivers",
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("should return 201 with application/vnd.api+json media type", async () => {
    const requestBody = {
      data: {
        type: "drivers",
        attributes: {
          driverId: "test-driver-1",
        },
      },
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/drivers",
      headers: {
        "content-type": APPLICATION_VND_API_JSON,
      },
      payload: requestBody,
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers["content-type"]).toContain(
      APPLICATION_VND_API_JSON
    );
  });

  it("should return stable JSON:API resource shape", async () => {
    const requestBody = {
      data: {
        type: "drivers",
        attributes: {
          driverId: "test-driver-2",
        },
      },
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/drivers",
      headers: {
        "content-type": APPLICATION_VND_API_JSON,
      },
      payload: requestBody,
    });
    const body = JSON.parse(response.body);

    expect(body.data.type).toBe("drivers");
    expect(body.data.id).toBe("test-driver-2");
    expect(body.data.attributes.state).toBe(DRIVER_STATES.OFFLINE);
  });

  it("should return 400 on invalid request body", async () => {
    const requestBody = {
      data: {
        type: "drivers",
        attributes: {
          driverId: "",
        },
      },
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/drivers",
      headers: {
        "content-type": APPLICATION_VND_API_JSON,
      },
      payload: requestBody,
    });

    expect(response.statusCode).toBe(400);
  });
});

describe("PATCH /api/drivers/:id/availability", () => {
  let app: FastifyInstance;
  let repository: FakeDriverRepository;

  beforeEach(async () => {
    repository = new FakeDriverRepository();
    const geoIndex = new FakeGeoIndex();
    const eventBus = new FakeEventBus();
    const clock = new FakeClock();
    const driverService = new DriverService(
      repository,
      geoIndex,
      eventBus,
      clock
    );

    app = Fastify({ logger: false });
    addJsonApiParser(app);
    app.addHook("onRequest", async (request) => {
      (request as { user?: unknown }).user = {
        id: "test-user-1",
        role: "driver",
        driverId: "test-driver-1",
        scopes: ["driver:read", "driver:write"],
      };
    });
    await app.register(createDriverRoutes({ driverService }), {
      prefix: "/api/drivers",
    });
    await app.ready();

    await driverService.registerDriver({ driverId: "test-driver-1" });
  });

  afterEach(async () => {
    await app.close();
  });

  it("should return 200 with application/vnd.api+json media type", async () => {
    const requestBody = {
      data: {
        type: "driver-availability-updates",
        attributes: {
          state: DRIVER_STATES.AVAILABLE,
        },
      },
    };

    const response = await app.inject({
      method: "PATCH",
      url: "/api/drivers/test-driver-1/availability",
      headers: {
        "content-type": APPLICATION_VND_API_JSON,
      },
      payload: requestBody,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain(
      APPLICATION_VND_API_JSON
    );
  });

  it("should return updated driver state", async () => {
    const requestBody = {
      data: {
        type: "driver-availability-updates",
        attributes: {
          state: DRIVER_STATES.AVAILABLE,
        },
      },
    };

    const response = await app.inject({
      method: "PATCH",
      url: "/api/drivers/test-driver-1/availability",
      headers: {
        "content-type": APPLICATION_VND_API_JSON,
      },
      payload: requestBody,
    });
    const body = JSON.parse(response.body);

    expect(body.data.attributes.state).toBe(DRIVER_STATES.AVAILABLE);
  });

  it("should return 404 when driver does not exist", async () => {
    const requestBody = {
      data: {
        type: "driver-availability-updates",
        attributes: {
          state: DRIVER_STATES.AVAILABLE,
        },
      },
    };

    const response = await app.inject({
      method: "PATCH",
      url: "/api/drivers/nonexistent-driver/availability",
      headers: {
        "content-type": APPLICATION_VND_API_JSON,
      },
      payload: requestBody,
    });

    expect(response.statusCode).toBe(404);
  });
});

describe("PATCH /api/drivers/:id/location", () => {
  let app: FastifyInstance;
  let repository: FakeDriverRepository;

  beforeEach(async () => {
    repository = new FakeDriverRepository();
    const geoIndex = new FakeGeoIndex();
    const eventBus = new FakeEventBus();
    const clock = new FakeClock();
    const driverService = new DriverService(
      repository,
      geoIndex,
      eventBus,
      clock
    );

    app = Fastify({ logger: false });
    addJsonApiParser(app);
    app.addHook("onRequest", async (request) => {
      (request as { user?: unknown }).user = {
        id: "test-user-1",
        role: "driver",
        driverId: "test-driver-1",
        scopes: ["driver:read", "driver:write"],
      };
    });
    await app.register(createDriverRoutes({ driverService }), {
      prefix: "/api/drivers",
    });
    await app.ready();

    await driverService.registerDriver({ driverId: "test-driver-1" });
    await driverService.updateAvailability({
      driverId: "test-driver-1",
      newState: DRIVER_STATES.AVAILABLE,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it("should return 200 with application/vnd.api+json media type", async () => {
    const requestBody = {
      data: {
        type: "driver-location-updates",
        attributes: {
          latitude: 4.6097,
          longitude: -74.0817,
          accuracy: 10.5,
          bearing: 180,
          speed: 5.2,
          recordedAt: "2026-02-13T14:00:00.000Z",
        },
      },
    };

    const response = await app.inject({
      method: "PATCH",
      url: "/api/drivers/test-driver-1/location",
      headers: {
        "content-type": APPLICATION_VND_API_JSON,
      },
      payload: requestBody,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain(
      APPLICATION_VND_API_JSON
    );
  });

  it("should return updated driver location", async () => {
    const requestBody = {
      data: {
        type: "driver-location-updates",
        attributes: {
          latitude: 4.6097,
          longitude: -74.0817,
          accuracy: 10.5,
          bearing: 180,
          speed: 5.2,
          recordedAt: "2026-02-13T14:00:00.000Z",
        },
      },
    };

    const response = await app.inject({
      method: "PATCH",
      url: "/api/drivers/test-driver-1/location",
      headers: {
        "content-type": APPLICATION_VND_API_JSON,
      },
      payload: requestBody,
    });
    const body = JSON.parse(response.body);

    expect(body.data.attributes.currentLocation.latitude).toBe(4.6097);
    expect(body.data.attributes.currentLocation.longitude).toBe(-74.0817);
  });

  it("should return 400 when location coordinates are invalid", async () => {
    const requestBody = {
      data: {
        type: "driver-location-updates",
        attributes: {
          latitude: 1000,
          longitude: -74.0817,
          accuracy: 10.5,
          bearing: 180,
          speed: 5.2,
          recordedAt: "2026-02-13T14:00:00.000Z",
        },
      },
    };

    const response = await app.inject({
      method: "PATCH",
      url: "/api/drivers/test-driver-1/location",
      headers: {
        "content-type": APPLICATION_VND_API_JSON,
      },
      payload: requestBody,
    });

    expect(response.statusCode).toBe(400);
  });
});

describe("GET /api/drivers/:id", () => {
  let app: FastifyInstance;
  let repository: FakeDriverRepository;

  beforeEach(async () => {
    repository = new FakeDriverRepository();
    const geoIndex = new FakeGeoIndex();
    const eventBus = new FakeEventBus();
    const clock = new FakeClock();
    const driverService = new DriverService(
      repository,
      geoIndex,
      eventBus,
      clock
    );

    app = Fastify({ logger: false });
    addJsonApiParser(app);
    app.addHook("onRequest", async (request) => {
      (request as { user?: unknown }).user = {
        id: "test-user-1",
        role: "driver",
        driverId: "test-driver-1",
        scopes: ["driver:read", "driver:write"],
      };
    });
    await app.register(createDriverRoutes({ driverService }), {
      prefix: "/api/drivers",
    });
    await app.ready();

    await driverService.registerDriver({ driverId: "test-driver-1" });
  });

  afterEach(async () => {
    await app.close();
  });

  it("should return 200 with application/vnd.api+json media type", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/drivers/test-driver-1",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain(
      APPLICATION_VND_API_JSON
    );
  });

  it("should return stable JSON:API resource shape", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/drivers/test-driver-1",
    });
    const body = JSON.parse(response.body);

    expect(body.data.type).toBe("drivers");
    expect(body.data.id).toBe("test-driver-1");
    expect(body.data.attributes.state).toBe(DRIVER_STATES.OFFLINE);
  });

  it("should return 404 when driver does not exist", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/drivers/nonexistent-driver",
    });

    expect(response.statusCode).toBe(404);
  });
});
