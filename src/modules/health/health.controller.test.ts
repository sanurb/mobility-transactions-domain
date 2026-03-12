import { afterAll, describe, expect, it } from "vitest";
import { closeTestServer, get } from "../../test/helpers/index.js";

describe("Health Controller", () => {
  afterAll(async () => {
    await closeTestServer();
  });

  describe("GET /api/v1/health", () => {
    it("should return 200 with health status", async () => {
      const response = await get("/api/v1/health", { auth: false });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.status).toBe("ok");
      expect(body.timestamp).toBeDefined();
      expect(body.version).toBe("1.0.0");
    });

    it("should include database health check", async () => {
      const response = await get("/api/v1/health", { auth: false });

      const body = JSON.parse(response.body);
      expect(body.checks).toBeDefined();
      expect(body.checks.database).toBeDefined();
      expect(body.checks.database.connected).toBe(true);
      expect(body.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("should be accessible without authentication", async () => {
      // Health endpoint should be public
      const response = await get("/api/v1/health", { auth: false });
      expect(response.statusCode).toBe(200);
    });
  });

  describe("GET /", () => {
    it("should return API info", async () => {
      const response = await get("/", { auth: false });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.name).toBe("Mobility Transactions API");
      expect(body.version).toBe("1.0.0");
      expect(body.docs).toBe("/docs");
    });
  });
});
