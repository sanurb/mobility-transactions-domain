import { beforeEach, describe, expect, it } from "vitest";
import type { DomainEvent } from "../../../../shared/events/domain-event.js";
import { DriverService } from "../../application/driver.service.js";
import type { EventBusPort } from "../../application/ports/event-bus.port.js";
import { DRIVER_STATES } from "../../domain/driver-states.js";
import { DriverId } from "../../domain/value-objects/driver-id.js";
import {
  FakeClock,
  FakeDriverRepository,
  FakeGeoIndex,
} from "../helpers/faked-ports.js";

class FakeEventBus implements EventBusPort {
  published: DomainEvent[] = [];

  async publish<E extends DomainEvent>(event: E): Promise<void> {
    this.published.push(event);
  }

  clear(): void {
    this.published = [];
  }
}

describe.sequential("DriverService application layer", () => {
  let repository: FakeDriverRepository;
  let geoIndex: FakeGeoIndex;
  let eventBus: FakeEventBus;
  let clock: FakeClock;
  let service: DriverService;

  beforeEach(() => {
    repository = new FakeDriverRepository();
    repository.clear();
    geoIndex = new FakeGeoIndex();
    geoIndex.clear();
    eventBus = new FakeEventBus();
    eventBus.clear();
    clock = new FakeClock();
    service = new DriverService(repository, geoIndex, eventBus, clock);
  });

  it("When registering a driver, then saves driver and publishes no events", async () => {
    const result = await service.registerDriver({ driverId: "test-driver-1" });

    expect(result.isOk()).toBe(true);
    expect(repository.getAll()).toHaveLength(1);
    expect(eventBus.published).toHaveLength(0);
  });

  it("When updating availability to AVAILABLE, then publishes availability changed event", async () => {
    await service.registerDriver({ driverId: "test-driver-1" });
    eventBus.clear();

    const result = await service.updateAvailability({
      driverId: "test-driver-1",
      newState: DRIVER_STATES.AVAILABLE,
    });

    result.unwrap();
    expect(eventBus.published).toHaveLength(1);
    expect(eventBus.published[0]?.eventType).toBe("DriverAvailabilityChanged");
  });

  it("When updating availability to OFFLINE, then removes driver from geo-index", async () => {
    await service.registerDriver({ driverId: "test-driver-1" });
    await service.updateAvailability({
      driverId: "test-driver-1",
      newState: DRIVER_STATES.AVAILABLE,
    });
    const driverId = DriverId.create("test-driver-1").unwrap();

    await service.updateAvailability({
      driverId: "test-driver-1",
      newState: DRIVER_STATES.OFFLINE,
    });

    expect(geoIndex.hasDriver(driverId)).toBe(false);
  });

  it("When updating location for AVAILABLE driver, then publishes location updated event", async () => {
    await service.registerDriver({ driverId: "test-driver-1" });
    await service.updateAvailability({
      driverId: "test-driver-1",
      newState: DRIVER_STATES.AVAILABLE,
    });
    eventBus.clear();

    const result = await service.updateLocation({
      driverId: "test-driver-1",
      latitude: 4.6097,
      longitude: -74.0817,
      accuracy: 10.5,
      bearing: 180,
      speed: 5.2,
      recordedAt: new Date("2026-02-13T14:00:00.000Z"),
    });

    result.unwrap();
    expect(eventBus.published).toHaveLength(1);
    expect(eventBus.published[0]?.eventType).toBe("DriverLocationUpdated");
  });

  it("When updating location for AVAILABLE driver, then updates geo-index", async () => {
    await service.registerDriver({ driverId: "test-driver-1" });
    await service.updateAvailability({
      driverId: "test-driver-1",
      newState: DRIVER_STATES.AVAILABLE,
    });
    const driverId = DriverId.create("test-driver-1").unwrap();

    await service.updateLocation({
      driverId: "test-driver-1",
      latitude: 4.6097,
      longitude: -74.0817,
      accuracy: 10.5,
      bearing: 180,
      speed: 5.2,
      recordedAt: new Date("2026-02-13T14:00:00.000Z"),
    });

    expect(geoIndex.hasDriver(driverId)).toBe(true);
  });

  it("When updating location with future timestamp, then returns validation error", async () => {
    await service.registerDriver({ driverId: "test-driver-2" });
    await service.updateAvailability({
      driverId: "test-driver-2",
      newState: DRIVER_STATES.AVAILABLE,
    });

    const result = await service.updateLocation({
      driverId: "test-driver-2",
      latitude: 4.6097,
      longitude: -74.0817,
      accuracy: 10.5,
      bearing: 180,
      speed: 5.2,
      recordedAt: new Date("2026-02-13T15:00:00.000Z"),
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toMatchObject({ _tag: "VALIDATION_ERROR" });
    }
  });

  it("When getting a nonexistent driver, then returns null", async () => {
    const result = await service.getDriver({ driverId: "nonexistent-driver" });

    expect(result.unwrap()).toBe(null);
  });

  it("When getting an existing driver, then returns driver DTO with correct state", async () => {
    await service.registerDriver({ driverId: "test-driver-1" });

    const result = await service.getDriver({ driverId: "test-driver-1" });

    const driver = result.unwrap();
    expect(driver?.id).toBe("test-driver-1");
    expect(driver?.state).toBe(DRIVER_STATES.OFFLINE);
  });
});
