import { describe, expect, it } from "vitest";
import { Driver } from "../../domain/driver.aggregate.js";
import { DRIVER_STATES } from "../../domain/driver-states.js";
import {
  buildDriverId,
  buildLocationUpdate,
} from "../helpers/driver-test-factories.js";
import { FakeClock } from "../helpers/faked-ports.js";

describe("Driver aggregate", () => {
  it("When updating availability with valid transition, then records DriverAvailabilityChanged event", () => {
    const clock = new FakeClock();
    const driverId = buildDriverId();
    const driver = Driver.register({ id: driverId, clock });
    const nowUTC = "2026-02-13T14:01:00.000Z";

    const result = driver.updateAvailability(DRIVER_STATES.AVAILABLE, nowUTC);
    const events = driver.pullDomainEvents();

    expect(result.isOk()).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("DriverAvailabilityChanged");
  });

  it("When updating availability with valid transition, then updates driver state", () => {
    const clock = new FakeClock();
    const driverId = buildDriverId();
    const driver = Driver.register({ id: driverId, clock });
    const nowUTC = "2026-02-13T14:01:00.000Z";

    driver.updateAvailability(DRIVER_STATES.AVAILABLE, nowUTC);

    expect(driver.state).toBe(DRIVER_STATES.AVAILABLE);
  });

  it("When updating availability with invalid transition, then rejects with CONFLICT", () => {
    const clock = new FakeClock();
    const driverId = buildDriverId();
    const driver = Driver.register({ id: driverId, clock });
    const nowUTC = "2026-02-13T14:01:00.000Z";

    const result = driver.updateAvailability(DRIVER_STATES.BUSY, nowUTC);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toMatchObject({ _tag: "CONFLICT" });
    }
  });

  it("When updating location with changed coordinates, then records DriverLocationUpdated event", () => {
    const clock = new FakeClock();
    const driverId = buildDriverId();
    const driver = Driver.register({ id: driverId, clock });
    driver.updateAvailability(
      DRIVER_STATES.AVAILABLE,
      "2026-02-13T14:00:00.000Z"
    );
    const locationUpdate = buildLocationUpdate();
    const nowUTC = "2026-02-13T14:01:00.000Z";
    driver.pullDomainEvents();

    const result = driver.updateLocation(locationUpdate, clock, nowUTC);
    const events = driver.pullDomainEvents();

    expect(result.isOk()).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("DriverLocationUpdated");
  });

  it("When updating location with unchanged coordinates, then does not record event", () => {
    const clock = new FakeClock();
    const driverId = buildDriverId();
    const driver = Driver.register({ id: driverId, clock });
    driver.updateAvailability(
      DRIVER_STATES.AVAILABLE,
      "2026-02-13T14:00:00.000Z"
    );
    const locationUpdate = buildLocationUpdate();
    driver.updateLocation(locationUpdate, clock, "2026-02-13T14:01:00.000Z");
    driver.pullDomainEvents();

    driver.updateLocation(locationUpdate, clock, "2026-02-13T14:02:00.000Z");
    const events = driver.pullDomainEvents();

    expect(events).toHaveLength(0);
  });

  it("When updating location while driver is OFFLINE, then rejects with VALIDATION_ERROR", () => {
    const clock = new FakeClock();
    const driverId = buildDriverId();
    const driver = Driver.register({ id: driverId, clock });
    const locationUpdate = buildLocationUpdate();
    const nowUTC = "2026-02-13T14:01:00.000Z";

    const result = driver.updateLocation(locationUpdate, clock, nowUTC);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toMatchObject({ _tag: "VALIDATION_ERROR" });
    }
  });

  it("When updating location with future timestamp, then rejects with VALIDATION_ERROR", () => {
    const clock = new FakeClock(new Date("2026-02-13T14:00:00.000Z"));
    const driverId = buildDriverId();
    const driver = Driver.register({ id: driverId, clock });
    driver.updateAvailability(
      DRIVER_STATES.AVAILABLE,
      "2026-02-13T14:00:00.000Z"
    );
    const futureUpdate = buildLocationUpdate({
      recordedAt: new Date("2026-02-13T15:00:00.000Z"),
    });
    const nowUTC = "2026-02-13T14:01:00.000Z";

    const result = driver.updateLocation(futureUpdate, clock, nowUTC);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toMatchObject({ _tag: "VALIDATION_ERROR" });
    }
  });

  it("When reserving for ride while available, then records DriverDispatched event", () => {
    const clock = new FakeClock();
    const driverId = buildDriverId();
    const driver = Driver.register({ id: driverId, clock });
    driver.updateAvailability(
      DRIVER_STATES.AVAILABLE,
      "2026-02-13T14:00:00.000Z"
    );
    driver.pullDomainEvents();

    const result = driver.reserveForRide({
      rideId: "test-ride-1",
      nowUTC: "2026-02-13T14:01:00.000Z",
    });
    const events = driver.pullDomainEvents();

    expect(result.isOk()).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("DriverDispatched");
  });

  it("When reserving for ride while available, then transitions driver to BUSY state", () => {
    const clock = new FakeClock();
    const driverId = buildDriverId();
    const driver = Driver.register({ id: driverId, clock });
    driver.updateAvailability(
      DRIVER_STATES.AVAILABLE,
      "2026-02-13T14:00:00.000Z"
    );

    driver.reserveForRide({
      rideId: "test-ride-1",
      nowUTC: "2026-02-13T14:01:00.000Z",
    });

    expect(driver.state).toBe(DRIVER_STATES.BUSY);
    expect(driver.currentRideId).toBe("test-ride-1");
  });

  it("When reserving for ride while not available, then rejects with CONFLICT", () => {
    const clock = new FakeClock();
    const driverId = buildDriverId();
    const driver = Driver.register({ id: driverId, clock });

    const result = driver.reserveForRide({
      rideId: "test-ride-1",
      nowUTC: "2026-02-13T14:01:00.000Z",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toMatchObject({ _tag: "CONFLICT" });
    }
  });

  it("When reserving for ride while already assigned, then rejects with CONFLICT", () => {
    const clock = new FakeClock();
    const driverId = buildDriverId();
    const driver = Driver.register({ id: driverId, clock });
    driver.updateAvailability(
      DRIVER_STATES.AVAILABLE,
      "2026-02-13T14:00:00.000Z"
    );
    driver.reserveForRide({
      rideId: "test-ride-1",
      nowUTC: "2026-02-13T14:01:00.000Z",
    });

    const result = driver.reserveForRide({
      rideId: "test-ride-2",
      nowUTC: "2026-02-13T14:02:00.000Z",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toMatchObject({ _tag: "CONFLICT" });
    }
  });

  it("When releasing from ride while busy, then transitions driver back to AVAILABLE", () => {
    const clock = new FakeClock();
    const driverId = buildDriverId();
    const driver = Driver.register({ id: driverId, clock });
    driver.updateAvailability(
      DRIVER_STATES.AVAILABLE,
      "2026-02-13T14:00:00.000Z"
    );
    driver.reserveForRide({
      rideId: "test-ride-1",
      nowUTC: "2026-02-13T14:01:00.000Z",
    });

    driver.releaseFromRide({ nowUTC: "2026-02-13T14:02:00.000Z" });

    expect(driver.state).toBe(DRIVER_STATES.AVAILABLE);
    expect(driver.currentRideId).toBe(null);
  });

  it("When releasing from ride while busy, then records DriverAvailabilityChanged event", () => {
    const clock = new FakeClock();
    const driverId = buildDriverId();
    const driver = Driver.register({ id: driverId, clock });
    driver.updateAvailability(
      DRIVER_STATES.AVAILABLE,
      "2026-02-13T14:00:00.000Z"
    );
    driver.reserveForRide({
      rideId: "test-ride-1",
      nowUTC: "2026-02-13T14:01:00.000Z",
    });
    driver.pullDomainEvents();

    driver.releaseFromRide({ nowUTC: "2026-02-13T14:02:00.000Z" });
    const events = driver.pullDomainEvents();

    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("DriverAvailabilityChanged");
  });

  it("When releasing from ride while not busy, then rejects with CONFLICT", () => {
    const clock = new FakeClock();
    const driverId = buildDriverId();
    const driver = Driver.register({ id: driverId, clock });

    const result = driver.releaseFromRide({
      nowUTC: "2026-02-13T14:01:00.000Z",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toMatchObject({ _tag: "CONFLICT" });
    }
  });
});
