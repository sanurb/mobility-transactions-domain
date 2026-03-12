import { describe, expect, test } from "vitest";
import {
  filterAllowlisted,
  formatViolations,
  scanDomainPatternsAcrossContexts,
  scanRecordOutsideAggregates,
} from "./helpers.js";

describe("Architecture: Domain Purity", () => {
  describe("P1: Domain MUST NOT access system clock directly", () => {
    test("When scanning domain files, then no new Date()/Date.now()/performance.now() calls exist", () => {
      const clockPatterns = [
        /\bnew\s+Date\s*\(\s*\)/,
        /\bDate\.now\s*\(/,
        /\bperformance\.now\s*\(/,
      ];
      const violations = scanDomainPatternsAcrossContexts(
        clockPatterns,
        "P1-clock-access"
      );

      const newViolations = filterAllowlisted(violations);

      expect(
        newViolations,
        formatViolations("P1: Domain clock access", newViolations)
      ).toEqual([]);
    });
  });

  describe("P2: Domain MUST NOT access randomness directly", () => {
    test("When scanning domain files, then no Math.random()/crypto.randomUUID() calls exist", () => {
      const randomPatterns = [
        /\bMath\.random\s*\(/,
        /\bcrypto\.randomUUID\s*\(/,
        /\brandomUUID\s*\(/,
      ];
      const violations = scanDomainPatternsAcrossContexts(
        randomPatterns,
        "P2-random-access"
      );

      const newViolations = filterAllowlisted(violations);

      expect(
        newViolations,
        formatViolations("P2: Domain random access", newViolations)
      ).toEqual([]);
    });
  });

  describe("P3: Domain MUST NOT log", () => {
    test("When scanning domain files, then no console/consola/logger calls exist", () => {
      const loggingPatterns = [/\bconsole\./, /\bconsola\./, /\blogger\./];
      const violations = scanDomainPatternsAcrossContexts(
        loggingPatterns,
        "P3-logging"
      );

      const newViolations = filterAllowlisted(violations);

      expect(
        newViolations,
        formatViolations("P3: Domain logging", newViolations)
      ).toEqual([]);
    });
  });

  describe("P4: Domain events MUST NOT be recorded outside aggregates", () => {
    test("When scanning domain files, then this.record() only appears in AggregateRoot subclasses", () => {
      const violations = scanRecordOutsideAggregates();

      const newViolations = filterAllowlisted(violations);

      expect(
        newViolations,
        formatViolations("P4: Event recording", newViolations)
      ).toEqual([]);
    });
  });
});
