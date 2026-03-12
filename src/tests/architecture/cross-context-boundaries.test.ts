import { describe, expect, test } from "vitest";
import {
  filterAllowlisted,
  formatViolations,
  scanCrossContextInternalImports,
  scanSharedContextDependencies,
} from "./helpers.js";

describe("Architecture: Cross-Context Boundaries", () => {
  describe("C1: No cross-context internal imports", () => {
    test("When scanning context files, then no imports from other context internals exist", () => {
      const violations = scanCrossContextInternalImports();

      const newViolations = filterAllowlisted(violations);

      expect(
        newViolations,
        formatViolations("C1: Cross-context internal imports", newViolations)
      ).toEqual([]);
    });
  });

  describe("C2: shared MUST NOT depend on contexts", () => {
    test("When scanning shared files, then no imports from any context exist", () => {
      const violations = scanSharedContextDependencies();

      const newViolations = filterAllowlisted(violations);

      expect(
        newViolations,
        formatViolations("C2: Shared context dependencies", newViolations)
      ).toEqual([]);
    });
  });
});
