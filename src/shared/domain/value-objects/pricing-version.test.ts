import { describe, expect, it } from "vitest";
import { PricingVersion } from "./pricing-version.js";
import { buildPricingVersion } from "./test/data/build-pricing-version.js";

describe("PricingVersion", () => {
  describe("create", () => {
    it("When valid version provided, then exposes major and minor", () => {
      const version = "v2.3.5";

      const result = PricingVersion.create(version);

      expect(result.unwrap().major).toBe(2);
      expect(result.unwrap().minor).toBe(3);
    });

    it("When valid version provided, then exposes patch", () => {
      const version = "v2.3.5";

      const result = PricingVersion.create(version);

      expect(result.unwrap().patch).toBe(5);
    });

    it("When invalid format provided, then rejects with validation error", () => {
      const invalidVersion = "1.0.0";

      const result = PricingVersion.create(invalidVersion);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toMatchObject({
          message: expect.stringContaining("vN.N.N"),
        });
      }
    });

    it("When format has text instead of numbers, then rejects with validation error", () => {
      const invalidVersion = "v1.x.0";

      const result = PricingVersion.create(invalidVersion);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toMatchObject({
          message: expect.stringContaining("vN.N.N"),
        });
      }
    });
  });

  describe("isNewerThan", () => {
    it("When major version is higher, then returns true", () => {
      const newer = buildPricingVersion({ value: "v2.0.0" });
      const older = buildPricingVersion({ value: "v1.9.9" });

      const result = newer.isNewerThan(older);

      expect(result).toBe(true);
    });

    it("When major same and minor higher, then returns true", () => {
      const newer = buildPricingVersion({ value: "v1.5.0" });
      const older = buildPricingVersion({ value: "v1.4.9" });

      const result = newer.isNewerThan(older);

      expect(result).toBe(true);
    });

    it("When major and minor same and patch higher, then returns true", () => {
      const newer = buildPricingVersion({ value: "v1.0.3" });
      const older = buildPricingVersion({ value: "v1.0.2" });

      const result = newer.isNewerThan(older);

      expect(result).toBe(true);
    });

    it("When version is older, then returns false", () => {
      const older = buildPricingVersion({ value: "v1.0.0" });
      const newer = buildPricingVersion({ value: "v2.0.0" });

      const result = older.isNewerThan(newer);

      expect(result).toBe(false);
    });

    it("When versions are equal, then returns false", () => {
      const version1 = buildPricingVersion({ value: "v1.2.3" });
      const version2 = buildPricingVersion({ value: "v1.2.3" });

      const result = version1.isNewerThan(version2);

      expect(result).toBe(false);
    });
  });

  describe("equals", () => {
    it("When version strings match, then returns true", () => {
      const version1 = buildPricingVersion({ value: "v1.0.0" });
      const version2 = buildPricingVersion({ value: "v1.0.0" });

      const result = version1.equals(version2);

      expect(result).toBe(true);
    });

    it("When version strings differ, then returns false", () => {
      const version1 = buildPricingVersion({ value: "v1.0.0" });
      const version2 = buildPricingVersion({ value: "v1.0.1" });

      const result = version1.equals(version2);

      expect(result).toBe(false);
    });
  });
});
