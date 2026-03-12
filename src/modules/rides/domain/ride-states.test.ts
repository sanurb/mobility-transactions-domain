import { describe, expect, it } from "vitest";
import {
  canTransition,
  EXPIRATION_POLICIES,
  getValidNextStates,
  isTerminalState,
  RIDE_STATES,
  RIDE_TRANSITIONS,
} from "./ride-states.js";

describe("Ride State Machine", () => {
  describe("RIDE_STATES", () => {
    it("When listing all states, then exactly 8 states are defined", () => {
      expect(Object.values(RIDE_STATES)).toEqual([
        "CREATED",
        "DISPATCHING",
        "ASSIGNED",
        "STARTED",
        "COMPLETED",
        "CANCELED",
        "EXPIRED",
        "FAILED",
      ]);
    });
  });

  describe("canTransition", () => {
    describe("happy path: CREATED -> DISPATCHING -> ASSIGNED -> STARTED -> COMPLETED", () => {
      it("When CREATED -> DISPATCHING, then transition is allowed", () => {
        expect(canTransition("CREATED", "DISPATCHING")).toBe(true);
      });

      it("When DISPATCHING -> ASSIGNED, then transition is allowed", () => {
        expect(canTransition("DISPATCHING", "ASSIGNED")).toBe(true);
      });

      it("When ASSIGNED -> STARTED, then transition is allowed", () => {
        expect(canTransition("ASSIGNED", "STARTED")).toBe(true);
      });

      it("When STARTED -> COMPLETED, then transition is allowed", () => {
        expect(canTransition("STARTED", "COMPLETED")).toBe(true);
      });
    });

    describe("cancel transitions", () => {
      it("When CREATED -> CANCELED, then transition is allowed", () => {
        expect(canTransition("CREATED", "CANCELED")).toBe(true);
      });

      it("When DISPATCHING -> CANCELED, then transition is allowed", () => {
        expect(canTransition("DISPATCHING", "CANCELED")).toBe(true);
      });

      it("When ASSIGNED -> CANCELED, then transition is allowed", () => {
        expect(canTransition("ASSIGNED", "CANCELED")).toBe(true);
      });

      it("When STARTED -> CANCELED, then transition is rejected", () => {
        expect(canTransition("STARTED", "CANCELED")).toBe(false);
      });

      it("When COMPLETED -> CANCELED, then transition is rejected", () => {
        expect(canTransition("COMPLETED", "CANCELED")).toBe(false);
      });

      it("When CANCELED -> CANCELED, then transition is rejected", () => {
        expect(canTransition("CANCELED", "CANCELED")).toBe(false);
      });

      it("When EXPIRED -> CANCELED, then transition is rejected", () => {
        expect(canTransition("EXPIRED", "CANCELED")).toBe(false);
      });

      it("When FAILED -> CANCELED, then transition is rejected", () => {
        expect(canTransition("FAILED", "CANCELED")).toBe(false);
      });
    });

    describe("expire transitions", () => {
      it("When CREATED -> EXPIRED, then transition is allowed", () => {
        expect(canTransition("CREATED", "EXPIRED")).toBe(true);
      });

      it("When DISPATCHING -> EXPIRED, then transition is allowed", () => {
        expect(canTransition("DISPATCHING", "EXPIRED")).toBe(true);
      });

      it("When ASSIGNED -> EXPIRED, then transition is allowed", () => {
        expect(canTransition("ASSIGNED", "EXPIRED")).toBe(true);
      });

      it("When STARTED -> EXPIRED, then transition is rejected", () => {
        expect(canTransition("STARTED", "EXPIRED")).toBe(false);
      });

      it("When COMPLETED -> EXPIRED, then transition is rejected", () => {
        expect(canTransition("COMPLETED", "EXPIRED")).toBe(false);
      });

      it("When CANCELED -> EXPIRED, then transition is rejected", () => {
        expect(canTransition("CANCELED", "EXPIRED")).toBe(false);
      });

      it("When EXPIRED -> EXPIRED, then transition is rejected", () => {
        expect(canTransition("EXPIRED", "EXPIRED")).toBe(false);
      });

      it("When FAILED -> EXPIRED, then transition is rejected", () => {
        expect(canTransition("FAILED", "EXPIRED")).toBe(false);
      });
    });

    describe("fail transitions", () => {
      it("When CREATED -> FAILED, then transition is allowed", () => {
        expect(canTransition("CREATED", "FAILED")).toBe(true);
      });

      it("When DISPATCHING -> FAILED, then transition is allowed", () => {
        expect(canTransition("DISPATCHING", "FAILED")).toBe(true);
      });

      it("When ASSIGNED -> FAILED, then transition is allowed", () => {
        expect(canTransition("ASSIGNED", "FAILED")).toBe(true);
      });

      it("When STARTED -> FAILED, then transition is allowed", () => {
        expect(canTransition("STARTED", "FAILED")).toBe(true);
      });

      it("When COMPLETED -> FAILED, then transition is rejected", () => {
        expect(canTransition("COMPLETED", "FAILED")).toBe(false);
      });

      it("When CANCELED -> FAILED, then transition is rejected", () => {
        expect(canTransition("CANCELED", "FAILED")).toBe(false);
      });

      it("When EXPIRED -> FAILED, then transition is rejected", () => {
        expect(canTransition("EXPIRED", "FAILED")).toBe(false);
      });

      it("When FAILED -> FAILED, then transition is rejected", () => {
        expect(canTransition("FAILED", "FAILED")).toBe(false);
      });
    });

    describe("terminal state immutability", () => {
      it("When transitioning from COMPLETED, then all transitions are rejected", () => {
        expect(getValidNextStates("COMPLETED")).toEqual([]);
      });

      it("When transitioning from CANCELED, then all transitions are rejected", () => {
        expect(getValidNextStates("CANCELED")).toEqual([]);
      });

      it("When transitioning from EXPIRED, then all transitions are rejected", () => {
        expect(getValidNextStates("EXPIRED")).toEqual([]);
      });

      it("When transitioning from FAILED, then all transitions are rejected", () => {
        expect(getValidNextStates("FAILED")).toEqual([]);
      });
    });

    describe("backward transitions", () => {
      it("When DISPATCHING -> CREATED, then transition is rejected", () => {
        expect(canTransition("DISPATCHING", "CREATED")).toBe(false);
      });

      it("When ASSIGNED -> DISPATCHING, then transition is rejected", () => {
        expect(canTransition("ASSIGNED", "DISPATCHING")).toBe(false);
      });

      it("When ASSIGNED -> CREATED, then transition is rejected", () => {
        expect(canTransition("ASSIGNED", "CREATED")).toBe(false);
      });

      it("When STARTED -> ASSIGNED, then transition is rejected", () => {
        expect(canTransition("STARTED", "ASSIGNED")).toBe(false);
      });

      it("When STARTED -> DISPATCHING, then transition is rejected", () => {
        expect(canTransition("STARTED", "DISPATCHING")).toBe(false);
      });

      it("When STARTED -> CREATED, then transition is rejected", () => {
        expect(canTransition("STARTED", "CREATED")).toBe(false);
      });
    });

    describe("self-transitions", () => {
      it("When CREATED -> CREATED, then transition is rejected", () => {
        expect(canTransition("CREATED", "CREATED")).toBe(false);
      });

      it("When DISPATCHING -> DISPATCHING, then transition is rejected", () => {
        expect(canTransition("DISPATCHING", "DISPATCHING")).toBe(false);
      });

      it("When ASSIGNED -> ASSIGNED, then transition is rejected", () => {
        expect(canTransition("ASSIGNED", "ASSIGNED")).toBe(false);
      });

      it("When STARTED -> STARTED, then transition is rejected", () => {
        expect(canTransition("STARTED", "STARTED")).toBe(false);
      });
    });
  });

  describe("isTerminalState", () => {
    it("When checking COMPLETED, then it is terminal", () => {
      expect(isTerminalState("COMPLETED")).toBe(true);
    });

    it("When checking CANCELED, then it is terminal", () => {
      expect(isTerminalState("CANCELED")).toBe(true);
    });

    it("When checking EXPIRED, then it is terminal", () => {
      expect(isTerminalState("EXPIRED")).toBe(true);
    });

    it("When checking FAILED, then it is terminal", () => {
      expect(isTerminalState("FAILED")).toBe(true);
    });

    it("When checking CREATED, then it is not terminal", () => {
      expect(isTerminalState("CREATED")).toBe(false);
    });

    it("When checking DISPATCHING, then it is not terminal", () => {
      expect(isTerminalState("DISPATCHING")).toBe(false);
    });

    it("When checking ASSIGNED, then it is not terminal", () => {
      expect(isTerminalState("ASSIGNED")).toBe(false);
    });

    it("When checking STARTED, then it is not terminal", () => {
      expect(isTerminalState("STARTED")).toBe(false);
    });
  });

  describe("getValidNextStates", () => {
    it("When getting next states for CREATED, then 4 transitions are available", () => {
      expect(getValidNextStates("CREATED")).toEqual(
        expect.arrayContaining(["DISPATCHING", "CANCELED", "EXPIRED", "FAILED"])
      );
    });

    it("When getting next states for DISPATCHING, then 4 transitions are available", () => {
      expect(getValidNextStates("DISPATCHING")).toEqual(
        expect.arrayContaining(["ASSIGNED", "CANCELED", "EXPIRED", "FAILED"])
      );
    });

    it("When getting next states for ASSIGNED, then 4 transitions are available", () => {
      expect(getValidNextStates("ASSIGNED")).toEqual(
        expect.arrayContaining(["STARTED", "CANCELED", "EXPIRED", "FAILED"])
      );
    });

    it("When getting next states for STARTED, then 2 transitions are available", () => {
      expect(getValidNextStates("STARTED")).toEqual(
        expect.arrayContaining(["COMPLETED", "FAILED"])
      );
    });
  });

  describe("EXPIRATION_POLICIES", () => {
    it("When checking DISPATCHING policy, then it is 120 seconds", () => {
      expect(EXPIRATION_POLICIES.DISPATCHING).toBe(120);
    });

    it("When checking ASSIGNED policy, then it is 300 seconds", () => {
      expect(EXPIRATION_POLICIES.ASSIGNED).toBe(300);
    });

    it("When listing policies, then only DISPATCHING and ASSIGNED exist", () => {
      expect(Object.keys(EXPIRATION_POLICIES)).toEqual(
        expect.arrayContaining(["DISPATCHING", "ASSIGNED"])
      );
    });
  });

  describe("RIDE_TRANSITIONS structure", () => {
    it("When listing transitions, then all 8 states have entries", () => {
      expect(Object.keys(RIDE_TRANSITIONS)).toHaveLength(8);
    });

    it("When checking transition values, then all are arrays", () => {
      expect(
        Object.values(RIDE_TRANSITIONS).every((t) => Array.isArray(t))
      ).toBe(true);
    });
  });
});
