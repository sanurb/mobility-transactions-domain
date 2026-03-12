import { describe, expect, it } from "vitest";
import { createDriverId } from "../../../../shared/types/ids/driver-id.js";
import { Ride } from "../../domain/ride.aggregate.js";
import { RIDE_STATES } from "../../domain/ride-states.js";
import {
  buildRideCreateRequest,
  buildRideSnapshot,
} from "../helpers/ride-test-factories.js";

describe("Ride.create", () => {
  it("When creating a ride with valid props, then state is CREATED", () => {
    const props = buildRideCreateRequest();

    const ride = Ride.create(props);

    expect(ride.state).toBe(RIDE_STATES.CREATED);
    expect(ride.id).toBe(props.id);
  });

  it("When creating a ride, then RideCreated event is recorded", () => {
    const props = buildRideCreateRequest();

    const ride = Ride.create(props);
    const events = ride.pullDomainEvents();

    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("RideCreated");
  });

  it("When creating a ride, then expiresAtUTC is null", () => {
    const props = buildRideCreateRequest();

    const ride = Ride.create(props);

    expect(ride.expiresAtUTC).toBeNull();
  });
});

describe("Ride.transition - CREATED to DISPATCHING", () => {
  it("When transitioning to DISPATCHING, then expiresAtUTC is set to +120s", () => {
    const ride = Ride.create(buildRideCreateRequest());
    ride.pullDomainEvents();
    const nowUTC = "2026-02-13T14:00:00.000Z";
    const expectedExpiry = "2026-02-13T14:02:00.000Z";

    const result = ride.transition({
      toState: RIDE_STATES.DISPATCHING,
      changedBy: "test-system",
      changedByRole: "system",
      nowUTC,
    });

    expect(result.isOk()).toBe(true);
    expect(ride.expiresAtUTC).toBe(expectedExpiry);
  });

  it("When transitioning to DISPATCHING, then RideStateChanged event is recorded", () => {
    const ride = Ride.create(buildRideCreateRequest());
    ride.pullDomainEvents();

    ride.transition({
      toState: RIDE_STATES.DISPATCHING,
      changedBy: "test-system",
      changedByRole: "system",
      nowUTC: "2026-02-13T14:00:00.000Z",
    });
    const events = ride.pullDomainEvents();

    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("RideStateChanged");
  });

  it("When transitioning to DISPATCHING, then version is incremented", () => {
    const ride = Ride.create(buildRideCreateRequest());
    const initialVersion = ride.getVersion();

    ride.transition({
      toState: RIDE_STATES.DISPATCHING,
      changedBy: "test-system",
      changedByRole: "system",
      nowUTC: "2026-02-13T14:00:00.000Z",
    });

    expect(ride.getVersion()).toBe(initialVersion + 1);
  });
});

describe("Ride.transition - DISPATCHING to ASSIGNED", () => {
  it("When transitioning to ASSIGNED with driverId, then driverId is set", () => {
    const ride = Ride.create(buildRideCreateRequest());
    ride.transition({
      toState: RIDE_STATES.DISPATCHING,
      changedBy: "test-system",
      changedByRole: "system",
      nowUTC: "2026-02-13T14:00:00.000Z",
    });
    const driverId = createDriverId("test-driver-1");
    ride.pullDomainEvents();

    const result = ride.transition({
      toState: RIDE_STATES.ASSIGNED,
      changedBy: "test-system",
      changedByRole: "system",
      driverId,
      nowUTC: "2026-02-13T14:01:00.000Z",
    });

    expect(result.isOk()).toBe(true);
    expect(ride.driverId).toBe(driverId);
  });

  it("When transitioning to ASSIGNED without driverId, then it fails", () => {
    const ride = Ride.create(buildRideCreateRequest());
    ride.transition({
      toState: RIDE_STATES.DISPATCHING,
      changedBy: "test-system",
      changedByRole: "system",
      nowUTC: "2026-02-13T14:00:00.000Z",
    });

    const result = ride.transition({
      toState: RIDE_STATES.ASSIGNED,
      changedBy: "test-system",
      changedByRole: "system",
      nowUTC: "2026-02-13T14:01:00.000Z",
    });

    expect(result.isErr()).toBe(true);
  });

  it("When transitioning to ASSIGNED, then expiresAtUTC is set to +300s", () => {
    const ride = Ride.create(buildRideCreateRequest());
    ride.transition({
      toState: RIDE_STATES.DISPATCHING,
      changedBy: "test-system",
      changedByRole: "system",
      nowUTC: "2026-02-13T14:00:00.000Z",
    });
    const nowUTC = "2026-02-13T14:01:00.000Z";
    const expectedExpiry = "2026-02-13T14:06:00.000Z";

    ride.transition({
      toState: RIDE_STATES.ASSIGNED,
      changedBy: "test-system",
      changedByRole: "system",
      driverId: createDriverId("test-driver-1"),
      nowUTC,
    });

    expect(ride.expiresAtUTC).toBe(expectedExpiry);
  });
});

describe("Ride.transition - STARTED to COMPLETED", () => {
  it("When transitioning to COMPLETED, then completedAtUTC is set", () => {
    const completionTime = "2026-02-13T14:30:00.000Z";
    const ride = Ride.reconstitute(
      buildRideSnapshot({
        state: RIDE_STATES.STARTED,
        driverId: createDriverId("test-driver-1"),
        startedAtUTC: "2026-02-13T14:10:00.000Z",
      })
    );

    ride.transition({
      toState: RIDE_STATES.COMPLETED,
      changedBy: "test-driver",
      changedByRole: "driver",
      nowUTC: completionTime,
    });

    expect(ride.completedAtUTC).toBe(completionTime);
  });

  it("When transitioning to COMPLETED, then expiresAtUTC is cleared", () => {
    const ride = Ride.reconstitute(
      buildRideSnapshot({
        state: RIDE_STATES.STARTED,
        driverId: createDriverId("test-driver-1"),
        startedAtUTC: "2026-02-13T14:10:00.000Z",
        expiresAtUTC: "2026-02-13T14:15:00.000Z",
      })
    );

    ride.transition({
      toState: RIDE_STATES.COMPLETED,
      changedBy: "test-driver",
      changedByRole: "driver",
      nowUTC: "2026-02-13T14:30:00.000Z",
    });

    expect(ride.expiresAtUTC).toBeNull();
  });
});

describe("Ride.transition - terminal immutability", () => {
  it("When transitioning from COMPLETED state, then it fails", () => {
    const ride = Ride.reconstitute(
      buildRideSnapshot({
        state: RIDE_STATES.COMPLETED,
        completedAtUTC: "2026-02-13T14:30:00.000Z",
      })
    );

    const result = ride.transition({
      toState: RIDE_STATES.CANCELED,
      changedBy: "test-system",
      changedByRole: "system",
      nowUTC: "2026-02-13T14:35:00.000Z",
    });

    expect(result.isErr()).toBe(true);
  });
});

describe("Ride.isExpiredAt", () => {
  it("When nowUTC is after expiresAtUTC, then ride is expired", () => {
    const expiresAtUTC = "2026-02-13T14:05:00.000Z";
    const ride = Ride.reconstitute(
      buildRideSnapshot({
        state: RIDE_STATES.DISPATCHING,
        expiresAtUTC,
      })
    );

    const isExpired = ride.isExpiredAt("2026-02-13T14:10:00.000Z");

    expect(isExpired).toBe(true);
  });

  it("When nowUTC is before expiresAtUTC, then ride is not expired", () => {
    const expiresAtUTC = "2026-02-13T14:05:00.000Z";
    const ride = Ride.reconstitute(
      buildRideSnapshot({
        state: RIDE_STATES.DISPATCHING,
        expiresAtUTC,
      })
    );

    const isExpired = ride.isExpiredAt("2026-02-13T14:00:00.000Z");

    expect(isExpired).toBe(false);
  });

  it("When expiresAtUTC is null, then ride is not expired", () => {
    const ride = Ride.reconstitute(
      buildRideSnapshot({
        state: RIDE_STATES.COMPLETED,
        expiresAtUTC: null,
      })
    );

    const isExpired = ride.isExpiredAt("2026-02-13T14:10:00.000Z");

    expect(isExpired).toBe(false);
  });
});
