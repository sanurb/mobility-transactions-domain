import { describe, expect, test } from "vitest";
import {
  type DispatchCandidate,
  NearestFirstDispatchPolicy,
} from "./dispatch-policy.js";
import { Distance } from "./value-objects/distance.js";
import { DriverId } from "./value-objects/driver-id.js";

describe("NearestFirstDispatchPolicy", () => {
  const policy = new NearestFirstDispatchPolicy();

  describe("selectDriver", () => {
    test("When candidates array is empty, then returns NO_ELIGIBLE_DRIVERS error", () => {
      const result = policy.selectDriver([]);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toMatchObject({
          message: expect.stringContaining("NO_ELIGIBLE_DRIVERS"),
        });
      }
    });

    test("When a single candidate exists, then selects that candidate as winner", () => {
      const driverId = DriverId.create("driver-1").unwrap();
      const distance = Distance.fromMeters(500).unwrap();
      const candidates: DispatchCandidate[] = [{ driverId, distance }];

      const result = policy.selectDriver(candidates);

      expect(result.isOk()).toBe(true);
      const selection = result.unwrap();
      expect(selection.winner.driverId.value).toBe("driver-1");
      expect(selection.winner.distance.meters).toBe(500);
    });

    test("When a single candidate exists, then uses nearest-first criteria", () => {
      const driverId = DriverId.create("driver-1").unwrap();
      const distance = Distance.fromMeters(500).unwrap();
      const candidates: DispatchCandidate[] = [{ driverId, distance }];

      const result = policy.selectDriver(candidates);

      const selection = result.unwrap();
      expect(selection.selectionCriteria).toBe("nearest-first");
      expect(selection.candidates).toHaveLength(1);
    });

    test("When distances differ, then selects the nearest driver", () => {
      const driver1 = DriverId.create("driver-1").unwrap();
      const driver2 = DriverId.create("driver-2").unwrap();
      const driver3 = DriverId.create("driver-3").unwrap();

      const candidates: DispatchCandidate[] = [
        { driverId: driver1, distance: Distance.fromMeters(1000).unwrap() },
        { driverId: driver2, distance: Distance.fromMeters(500).unwrap() },
        { driverId: driver3, distance: Distance.fromMeters(750).unwrap() },
      ];

      const result = policy.selectDriver(candidates);

      expect(result.isOk()).toBe(true);
      const selection = result.unwrap();
      expect(selection.winner.driverId.value).toBe("driver-2");
      expect(selection.winner.distance.meters).toBe(500);
    });

    test("When distances are equal, then uses driverId as tie-breaker", () => {
      const driverAlpha = DriverId.create("driver-alpha").unwrap();
      const driverBeta = DriverId.create("driver-beta").unwrap();
      const driverGamma = DriverId.create("driver-gamma").unwrap();

      const candidates: DispatchCandidate[] = [
        { driverId: driverGamma, distance: Distance.fromMeters(500).unwrap() },
        { driverId: driverBeta, distance: Distance.fromMeters(500).unwrap() },
        { driverId: driverAlpha, distance: Distance.fromMeters(500).unwrap() },
      ];

      const result = policy.selectDriver(candidates);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap().winner.driverId.value).toBe("driver-alpha");
    });

    test("When multiple candidates exist, then preserves all candidates in selection for audit", () => {
      const driver1 = DriverId.create("driver-1").unwrap();
      const driver2 = DriverId.create("driver-2").unwrap();
      const driver3 = DriverId.create("driver-3").unwrap();

      const candidates: DispatchCandidate[] = [
        { driverId: driver1, distance: Distance.fromMeters(1000).unwrap() },
        { driverId: driver2, distance: Distance.fromMeters(500).unwrap() },
        { driverId: driver3, distance: Distance.fromMeters(750).unwrap() },
      ];

      const result = policy.selectDriver(candidates);

      expect(result.isOk()).toBe(true);
      const selection = result.unwrap();
      expect(selection.candidates).toHaveLength(3);
      expect(selection.candidates).toEqual(candidates);
    });

    test("When called twice with same inputs, then produces identical winner", () => {
      const driver1 = DriverId.create("driver-1").unwrap();
      const driver2 = DriverId.create("driver-2").unwrap();

      const candidates: DispatchCandidate[] = [
        { driverId: driver1, distance: Distance.fromMeters(600).unwrap() },
        { driverId: driver2, distance: Distance.fromMeters(600).unwrap() },
      ];

      const result1 = policy.selectDriver(candidates);
      const result2 = policy.selectDriver(candidates);

      expect(result1.unwrap().winner.driverId.value).toBe(
        result2.unwrap().winner.driverId.value
      );
    });
  });
});
