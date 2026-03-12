import { describe, expect, it } from "vitest";
import { buildEnv } from "../test/data/build-env.js";
import { envSchema } from "./env.schema.js";

describe("envSchema", () => {
  describe("valid environment", () => {
    it("When all required fields are provided, then parsing succeeds", () => {
      const validEnv = buildEnv();

      const result = envSchema.safeParse(validEnv);

      expect(result.success).toBe(true);
    });

    it("When optional fields are omitted, then defaults are applied", () => {
      const minimalEnv = buildEnv();

      const result = envSchema.parse(minimalEnv);

      expect(result).toMatchObject({
        port: minimalEnv.port,
        appName: minimalEnv.appName,
        logLevel: "info",
        logPretty: false,
      });
    });
  });

  describe("missing required fields", () => {
    it("When databaseUrl is missing, then validation fails", () => {
      const envWithoutDb = { ...buildEnv(), databaseUrl: undefined };

      const result = envSchema.safeParse(envWithoutDb);

      expect(result.success).toBe(false);
    });

    it("When betterAuthSecret is missing, then validation fails", () => {
      const envWithoutSecret = { ...buildEnv(), betterAuthSecret: undefined };

      const result = envSchema.safeParse(envWithoutSecret);

      expect(result.success).toBe(false);
    });
  });

  describe("invalid port values", () => {
    it("When port is below minimum, then validation fails", () => {
      const invalidPort = buildEnv({ port: 0 });

      const result = envSchema.safeParse(invalidPort);

      expect(result.success).toBe(false);
    });

    it("When port is above maximum, then validation fails", () => {
      const invalidPort = buildEnv({ port: 65_536 });

      const result = envSchema.safeParse(invalidPort);

      expect(result.success).toBe(false);
    });
  });

  describe("invalid betterAuthSecret", () => {
    it("When secret is under 32 characters, then validation fails", () => {
      const shortSecret = buildEnv({ betterAuthSecret: "short" });

      const result = envSchema.safeParse(shortSecret);

      expect(result.success).toBe(false);
    });
  });
});
