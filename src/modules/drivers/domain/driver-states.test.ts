import { describe, expect, test } from "vitest";
import {
  canTransition,
  DRIVER_STATES,
  DRIVER_TRANSITIONS,
  type DriverState,
  isDriverAvailable,
} from "./driver-states.js";

describe("Driver State Machine", () => {
  describe("State constants", () => {
    test("When DRIVER_STATES is defined, then it contains exactly three states", () => {
      const states = Object.values(DRIVER_STATES);
      expect(states).toEqual(["AVAILABLE", "BUSY", "OFFLINE"]);
    });
  });

  describe("Transition table", () => {
    test("When OFFLINE is current state, then it can only transition to AVAILABLE", () => {
      const allowed = DRIVER_TRANSITIONS.OFFLINE;
      expect(allowed).toEqual([DRIVER_STATES.AVAILABLE]);
    });

    test("When AVAILABLE is current state, then it can transition to BUSY or OFFLINE", () => {
      const allowed = DRIVER_TRANSITIONS.AVAILABLE;
      expect(allowed).toContain(DRIVER_STATES.BUSY);
      expect(allowed).toContain(DRIVER_STATES.OFFLINE);
      expect(allowed).toEqual([DRIVER_STATES.BUSY, DRIVER_STATES.OFFLINE]);
    });

    test("When BUSY is current state, then it can transition to AVAILABLE or OFFLINE", () => {
      const allowed = DRIVER_TRANSITIONS.BUSY;
      expect(allowed).toContain(DRIVER_STATES.AVAILABLE);
      expect(allowed).toContain(DRIVER_STATES.OFFLINE);
      expect(allowed).toEqual([DRIVER_STATES.AVAILABLE, DRIVER_STATES.OFFLINE]);
    });
  });

  describe("canTransition - valid transitions", () => {
    const validTransitions: Array<[DriverState, DriverState]> = [
      ["OFFLINE", "AVAILABLE"],
      ["AVAILABLE", "BUSY"],
      ["AVAILABLE", "OFFLINE"],
      ["BUSY", "AVAILABLE"],
      ["BUSY", "OFFLINE"],
    ];

    test.each(
      validTransitions
    )("When transitioning %s -> %s, then it is allowed", (from, to) => {
      expect(canTransition(from, to)).toBe(true);
    });
  });

  describe("canTransition - invalid transitions", () => {
    const invalidTransitions: Array<[DriverState, DriverState]> = [
      ["OFFLINE", "BUSY"],
      ["OFFLINE", "OFFLINE"],
      ["AVAILABLE", "AVAILABLE"],
      ["BUSY", "BUSY"],
    ];

    test.each(
      invalidTransitions
    )("When transitioning %s -> %s, then it is rejected", (from, to) => {
      expect(canTransition(from, to)).toBe(false);
    });
  });

  describe("isDriverAvailable", () => {
    test("When driver state is AVAILABLE, then isDriverAvailable returns true", () => {
      expect(isDriverAvailable(DRIVER_STATES.AVAILABLE)).toBe(true);
    });

    test("When driver state is BUSY, then isDriverAvailable returns false", () => {
      expect(isDriverAvailable(DRIVER_STATES.BUSY)).toBe(false);
    });

    test("When driver state is OFFLINE, then isDriverAvailable returns false", () => {
      expect(isDriverAvailable(DRIVER_STATES.OFFLINE)).toBe(false);
    });
  });
});
