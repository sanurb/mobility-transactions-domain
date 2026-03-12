/**
 * Faked ports for Driver application tests
 *
 * In-memory implementations for deterministic, fast testing.
 * Follows Testing Rules for AI: explicit, no hidden behavior.
 */

import { Result } from "../../../../shared/core/result.js";
import type { DomainError } from "../../../../shared/errors/error-types.js";
import type { Driver } from "../../domain/driver.aggregate.js";
import type { Clock } from "../../domain/ports/clock.port.js";
import type { DriverRepositoryPort } from "../../domain/ports/driver-repository.port.js";
import type { GeoSpatialIndexPort } from "../../domain/ports/geo-spatial-index.port.js";
import type { DriverId } from "../../domain/value-objects/driver-id.js";
import type { Location } from "../../domain/value-objects/location.js";

/**
 * Fake DriverRepository using Map
 */
export class FakeDriverRepository implements DriverRepositoryPort {
  private drivers = new Map<string, Driver>();

  async findById(params: {
    id: DriverId;
  }): Promise<Result<Driver | null, DomainError>> {
    const driver = this.drivers.get(params.id.value) ?? null;
    return Result.ok(driver);
  }

  async save(aggregate: Driver): Promise<Result<Driver, DomainError>> {
    this.drivers.set(aggregate.id, aggregate);
    return Result.ok(aggregate);
  }

  // Test helpers
  clear(): void {
    this.drivers.clear();
  }

  getAll(): Driver[] {
    return Array.from(this.drivers.values());
  }
}

/**
 * Fake GeoSpatialIndex using Map
 */
export class FakeGeoIndex implements GeoSpatialIndexPort {
  private locations = new Map<string, Location>();

  async updateLocation(params: {
    driverId: DriverId;
    location: Location;
  }): Promise<void> {
    this.locations.set(params.driverId.value, params.location);
  }

  async removeDriver(driverId: DriverId): Promise<void> {
    this.locations.delete(driverId.value);
  }

  async findNearby(): Promise<never[]> {
    return [];
  }

  // Test helpers
  clear(): void {
    this.locations.clear();
  }

  hasDriver(driverId: DriverId): boolean {
    return this.locations.has(driverId.value);
  }
}

/**
 * Fake Clock with fixed time
 */
export class FakeClock implements Clock {
  constructor(private fixedNow: Date = new Date("2026-02-13T14:00:00.000Z")) {}

  now(): Date {
    return this.fixedNow;
  }

  // Test helper
  setNow(date: Date): void {
    this.fixedNow = date;
  }
}
