import { describe, expect, test } from "vitest";
import {
  buildDriverId,
  buildLocation,
  buildLocationUpdate,
} from "../tests/helpers/driver-test-factories.js";
import {
  filterFreshLocationUpdates,
  isLocationFresh,
  LOCATION_FRESHNESS_THRESHOLD_MS,
  MAX_LOCATION_ACCURACY_METERS,
  MAX_SPEED_MPS,
} from "./location-rules.js";
import { LocationUpdate } from "./value-objects/location-update.js";

describe("Location Rules", () => {
  describe("Constants", () => {
    test("When reading LOCATION_FRESHNESS_THRESHOLD_MS, then it is exactly 30 seconds", () => {
      expect(LOCATION_FRESHNESS_THRESHOLD_MS).toBe(30_000);
    });

    test("When reading MAX_LOCATION_ACCURACY_METERS, then it is exactly 100", () => {
      expect(MAX_LOCATION_ACCURACY_METERS).toBe(100);
    });

    test("When reading MAX_SPEED_MPS, then it is exactly 80", () => {
      expect(MAX_SPEED_MPS).toBe(80);
    });
  });

  describe("isLocationFresh", () => {
    test("When location was recorded 29 seconds ago, then it is fresh", () => {
      const now = new Date("2024-01-01T12:00:30.000Z");
      const recordedAt = new Date("2024-01-01T12:00:01.000Z");
      expect(isLocationFresh({ recordedAt, now })).toBe(true);
    });

    test("When location was recorded exactly 30 seconds ago, then it is fresh (boundary)", () => {
      const now = new Date("2024-01-01T12:00:30.000Z");
      const recordedAt = new Date("2024-01-01T12:00:00.000Z");
      expect(isLocationFresh({ recordedAt, now })).toBe(true);
    });

    test("When location was recorded 31 seconds ago, then it is stale", () => {
      const now = new Date("2024-01-01T12:00:31.000Z");
      const recordedAt = new Date("2024-01-01T12:00:00.000Z");
      expect(isLocationFresh({ recordedAt, now })).toBe(false);
    });

    test("When location was recorded in the future, then it is not fresh", () => {
      const now = new Date("2024-01-01T12:00:00.000Z");
      const recordedAt = new Date("2024-01-01T12:00:05.000Z");
      expect(isLocationFresh({ recordedAt, now })).toBe(false);
    });

    test("When location was recorded at the exact same time, then it is fresh", () => {
      const now = new Date("2024-01-01T12:00:00.000Z");
      const recordedAt = new Date("2024-01-01T12:00:00.000Z");
      expect(isLocationFresh({ recordedAt, now })).toBe(true);
    });
  });

  describe("LocationUpdate invariants", () => {
    test("When accuracy is 0 meters, then LocationUpdate.create rejects it", () => {
      const location = buildLocation();
      const updateResult = LocationUpdate.create({
        location,
        accuracyMeters: 0,
        bearingDegrees: 90,
        speedMetersPerSecond: 10,
        recordedAt: new Date(),
      });
      expect(updateResult.isErr()).toBe(true);
    });

    test("When accuracy is negative, then LocationUpdate.create rejects it", () => {
      const location = buildLocation();
      const updateResult = LocationUpdate.create({
        location,
        accuracyMeters: -1,
        bearingDegrees: 90,
        speedMetersPerSecond: 10,
        recordedAt: new Date(),
      });
      expect(updateResult.isErr()).toBe(true);
    });

    test("When accuracy exceeds MAX_LOCATION_ACCURACY_METERS, then LocationUpdate.create rejects it", () => {
      const location = buildLocation();
      const updateResult = LocationUpdate.create({
        location,
        accuracyMeters: 101,
        bearingDegrees: 90,
        speedMetersPerSecond: 10,
        recordedAt: new Date(),
      });
      expect(updateResult.isErr()).toBe(true);
    });

    test("When speed is negative, then LocationUpdate.create rejects it", () => {
      const location = buildLocation();
      const updateResult = LocationUpdate.create({
        location,
        accuracyMeters: 10,
        bearingDegrees: 90,
        speedMetersPerSecond: -1,
        recordedAt: new Date(),
      });
      expect(updateResult.isErr()).toBe(true);
    });

    test("When speed exceeds MAX_SPEED_MPS, then LocationUpdate.create rejects it", () => {
      const location = buildLocation();
      const updateResult = LocationUpdate.create({
        location,
        accuracyMeters: 10,
        bearingDegrees: 90,
        speedMetersPerSecond: 81,
        recordedAt: new Date(),
      });
      expect(updateResult.isErr()).toBe(true);
    });

    test("When bearing is below 0, then LocationUpdate.create rejects it", () => {
      const location = buildLocation();
      const updateResult = LocationUpdate.create({
        location,
        accuracyMeters: 10,
        bearingDegrees: -1,
        speedMetersPerSecond: 10,
        recordedAt: new Date(),
      });
      expect(updateResult.isErr()).toBe(true);
    });

    test("When bearing is above 360, then LocationUpdate.create rejects it", () => {
      const location = buildLocation();
      const updateResult = LocationUpdate.create({
        location,
        accuracyMeters: 10,
        bearingDegrees: 361,
        speedMetersPerSecond: 10,
        recordedAt: new Date(),
      });
      expect(updateResult.isErr()).toBe(true);
    });

    test("When bearing is at boundaries 0 and 360, then LocationUpdate.create accepts both", () => {
      const update0 = buildLocationUpdate({ bearingDegrees: 0 });
      const update360 = buildLocationUpdate({ bearingDegrees: 360 });

      expect(update0).toBeDefined();
      expect(update360).toBeDefined();
    });
  });

  describe("filterFreshLocationUpdates", () => {
    test("When all updates are fresh, then it keeps all of them", () => {
      const now = new Date("2024-01-01T12:00:30.000Z");
      const driverId1 = buildDriverId("driver-1");
      const driverId2 = buildDriverId("driver-2");

      const update1 = buildLocationUpdate({
        recordedAt: new Date("2024-01-01T12:00:15.000Z"),
      });
      const update2 = buildLocationUpdate({
        recordedAt: new Date("2024-01-01T12:00:25.000Z"),
      });

      const updates = [
        { driverId: driverId1, update: update1 },
        { driverId: driverId2, update: update2 },
      ];

      const filtered = filterFreshLocationUpdates({ updates, now });
      expect(filtered).toHaveLength(2);
    });

    test("When all updates are stale, then it filters out all of them", () => {
      const now = new Date("2024-01-01T12:00:30.000Z");
      const driverId1 = buildDriverId("driver-1");
      const driverId2 = buildDriverId("driver-2");

      const update1 = buildLocationUpdate({
        recordedAt: new Date("2024-01-01T11:59:55.000Z"),
      });
      const update2 = buildLocationUpdate({
        recordedAt: new Date("2024-01-01T11:59:50.000Z"),
      });

      const updates = [
        { driverId: driverId1, update: update1 },
        { driverId: driverId2, update: update2 },
      ];

      const filtered = filterFreshLocationUpdates({ updates, now });
      expect(filtered).toHaveLength(0);
    });

    test("When updates are mixed fresh and stale, then it keeps only fresh ones", () => {
      const now = new Date("2024-01-01T12:00:30.000Z");
      const driverId1 = buildDriverId("driver-1");
      const driverId2 = buildDriverId("driver-2");
      const driverId3 = buildDriverId("driver-3");

      const freshUpdate = buildLocationUpdate({
        recordedAt: new Date("2024-01-01T12:00:15.000Z"),
      });
      const staleUpdate = buildLocationUpdate({
        recordedAt: new Date("2024-01-01T11:59:55.000Z"),
      });
      const boundaryUpdate = buildLocationUpdate({
        recordedAt: new Date("2024-01-01T12:00:00.000Z"),
      });

      const updates = [
        { driverId: driverId1, update: freshUpdate },
        { driverId: driverId2, update: staleUpdate },
        { driverId: driverId3, update: boundaryUpdate },
      ];

      const filtered = filterFreshLocationUpdates({ updates, now });
      expect(filtered).toHaveLength(2);
      expect(filtered).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ driverId: driverId1 }),
          expect.objectContaining({ driverId: driverId3 }),
        ])
      );
    });

    test("When input array is empty, then it returns empty array", () => {
      const now = new Date("2024-01-01T12:00:30.000Z");
      const filtered = filterFreshLocationUpdates({ updates: [], now });
      expect(filtered).toHaveLength(0);
    });
  });
});
