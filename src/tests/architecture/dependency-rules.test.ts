import { describe, expect, test } from "vitest";
import {
  discoverContexts,
  filterAllowlisted,
  formatViolations,
  scanLayerAcrossContexts,
  scanSyncInTestFiles,
} from "./helpers.js";

describe("Architecture: Dependency Rules", () => {
  describe("R1: Domain MUST NOT import outward", () => {
    test("When scanning domain files, then no outward imports to adapters/infrastructure/presentation exist", () => {
      const forbidden = [
        "/adapters/",
        "/infrastructure/",
        "/presentation/",
        "sequelize",
        "fastify",
        "express",
        "@fastify/",
        "pino",
        "consola",
        "node:http",
        "node:https",
        "node:net",
        "node:dgram",
      ];
      const violations = scanLayerAcrossContexts(
        "domain",
        forbidden,
        "R1-domain-outward"
      );

      const newViolations = filterAllowlisted(violations);

      expect(
        newViolations,
        formatViolations("R1: Domain outward dependencies", newViolations)
      ).toEqual([]);
    });
  });

  describe("R2: Application MUST NOT import concrete adapters/infrastructure", () => {
    test("When scanning application files, then no imports from adapters/infrastructure/presentation exist", () => {
      const forbidden = ["/adapters/", "/infrastructure/", "/presentation/"];
      const violations = scanLayerAcrossContexts(
        "application",
        forbidden,
        "R2-app-concrete"
      );

      const newViolations = filterAllowlisted(violations);

      expect(
        newViolations,
        formatViolations("R2: Application concrete dependencies", newViolations)
      ).toEqual([]);
    });
  });

  describe("R3: Ports MUST be pure", () => {
    test("When scanning port files, then no imports from sequelize/fastify/adapters exist", () => {
      const forbidden = ["sequelize", "fastify", "express", "/adapters/"];
      const violations = scanLayerAcrossContexts(
        "application/ports",
        forbidden,
        "R3-ports-pure"
      );

      const newViolations = filterAllowlisted(violations);

      expect(
        newViolations,
        formatViolations("R3: Port purity", newViolations)
      ).toEqual([]);
    });
  });

  describe("R4: Integration tests MUST NOT use Model.sync()", () => {
    test("When scanning test files, then no sync() calls exist", () => {
      const violations = scanSyncInTestFiles();

      expect(
        violations,
        formatViolations(
          "R4: No .sync() in test files — use initTestDb() instead",
          violations
        )
      ).toEqual([]);
    });
  });

  describe("Context discovery", () => {
    test("When scanning src and src/modules, then discovers bounded contexts", () => {
      const discovered = discoverContexts();

      expect(discovered.length).toBeGreaterThan(0);
      expect(discovered).toContain("payments");
      expect(discovered).not.toContain("shared");
    });
  });
});
