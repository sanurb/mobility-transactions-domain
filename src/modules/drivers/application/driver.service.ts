/**
 * Driver Service - Application Layer
 *
 * Orchestrates driver registration, availability updates, and location tracking.
 * Enforces domain invariants via aggregate methods and maintains geo-index consistency.
 *
 * Responsibilities:
 * - Accept raw primitives at boundary, convert to VOs
 * - Load/modify aggregates using aggregate methods only
 * - Persist via DriverRepositoryPort with optimistic locking
 * - Maintain geo-index via GeoSpatialIndexPort
 * - Publish domain events via EventBus after successful persistence
 */

import { ok, Result } from "../../../shared/core/result.js";
import type { DomainError } from "../../../shared/errors/error-types.js";
import { NotFoundError } from "../../../shared/errors/error-types.js";
import { Driver } from "../domain/driver.aggregate.js";
import type { DriverState } from "../domain/driver-states.js";
import { DRIVER_STATES } from "../domain/driver-states.js";
import type { Clock } from "../domain/ports/clock.port.js";
import { DriverId } from "../domain/value-objects/driver-id.js";
import { Location } from "../domain/value-objects/location.js";
import { LocationUpdate } from "../domain/value-objects/location-update.js";
import type { DriverDTO } from "./driver.mapper.js";
import { mapDriverToDTO } from "./driver.mapper.js";
import type { DriverRepositoryPort } from "./ports/driver-repository.port.js";
import type { EventBusPort } from "./ports/event-bus.port.js";
import type { GeoSpatialIndexPort } from "./ports/geo-spatial-index.port.js";

/**
 * Parameters for driver registration
 */
export interface RegisterDriverParams {
  driverId: string;
}

/**
 * Parameters for updating driver availability
 */
export interface UpdateAvailabilityParams {
  driverId: string;
  newState: DriverState;
}

/**
 * Parameters for updating driver location
 */
export interface UpdateLocationParams {
  driverId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  bearing: number;
  speed: number;
  recordedAt: Date;
}

/**
 * Parameters for getting a driver
 */
export interface GetDriverParams {
  driverId: string;
}

export type { DriverDTO };
export { mapDriverToDTO };

/**
 * Driver Service Interface
 */
export interface IDriverService {
  registerDriver(
    params: RegisterDriverParams
  ): Promise<Result<DriverDTO, DomainError>>;
  updateAvailability(
    params: UpdateAvailabilityParams
  ): Promise<Result<DriverDTO, DomainError>>;
  updateLocation(
    params: UpdateLocationParams
  ): Promise<Result<DriverDTO, DomainError>>;
  getDriver(
    params: GetDriverParams
  ): Promise<Result<DriverDTO | null, DomainError>>;
}

/**
 * Driver Service Implementation
 */
export class DriverService implements IDriverService {
  constructor(
    private readonly repository: DriverRepositoryPort,
    private readonly geoIndex: GeoSpatialIndexPort,
    private readonly eventBus: EventBusPort,
    private readonly clock: Clock
  ) {}

  /**
   * Register a new driver
   */
  async registerDriver(
    params: RegisterDriverParams
  ): Promise<Result<DriverDTO, DomainError>> {
    // Convert primitives to VOs at boundary
    const driverIdResult = DriverId.create(params.driverId);
    if (driverIdResult.isErr()) {
      return driverIdResult;
    }

    // Create driver using aggregate factory
    const driver = Driver.register({
      id: driverIdResult.value,
      clock: this.clock,
    });

    // Persist via repository
    const saveResult = await this.repository.save(driver);
    if (saveResult.isErr()) {
      return saveResult;
    }

    const savedDriver = saveResult.value;

    // Publish domain events
    await this.publishDomainEvents(savedDriver);

    // No geo-index update needed - driver starts OFFLINE

    // Map to DTO
    return ok(mapDriverToDTO(savedDriver));
  }

  /**
   * Update driver availability state
   */
  async updateAvailability(
    params: UpdateAvailabilityParams
  ): Promise<Result<DriverDTO, DomainError>> {
    // Convert primitives to VOs at boundary
    const driverIdResult = DriverId.create(params.driverId);
    if (driverIdResult.isErr()) {
      return driverIdResult;
    }

    // Load driver
    const findResult = await this.repository.findById({
      id: driverIdResult.value,
    });
    if (findResult.isErr()) {
      return findResult;
    }

    const driver = findResult.value;
    if (!driver) {
      return Result.err(new NotFoundError("Driver", params.driverId));
    }

    const nowUTC = this.clock.now().toISOString();

    // Update availability via aggregate method
    const updateResult = driver.updateAvailability(params.newState, nowUTC);
    if (updateResult.isErr()) {
      return updateResult;
    }

    // Persist via repository
    const saveResult = await this.repository.save(driver);
    if (saveResult.isErr()) {
      return saveResult;
    }

    const savedDriver = saveResult.value;

    // Publish domain events
    await this.publishDomainEvents(savedDriver);

    // Maintain geo-index consistency
    if (params.newState === DRIVER_STATES.OFFLINE) {
      // Remove from index when going offline
      await this.geoIndex.removeDriver(driverIdResult.value);
    } else if (
      params.newState === DRIVER_STATES.AVAILABLE &&
      savedDriver.currentLocation
    ) {
      // Update index when transitioning to AVAILABLE with valid location
      await this.geoIndex.updateLocation({
        driverId: driverIdResult.value,
        location: savedDriver.currentLocation.location,
      });
    }

    // Map to DTO
    return ok(mapDriverToDTO(savedDriver));
  }

  /**
   * Update driver location
   */
  async updateLocation(
    params: UpdateLocationParams
  ): Promise<Result<DriverDTO, DomainError>> {
    // Convert primitives to VOs at boundary
    const driverIdResult = DriverId.create(params.driverId);
    if (driverIdResult.isErr()) {
      return driverIdResult;
    }

    const locationResult = Location.create(params.latitude, params.longitude);
    if (locationResult.isErr()) {
      return locationResult;
    }

    const locationUpdateResult = LocationUpdate.create({
      location: locationResult.value,
      accuracyMeters: params.accuracy,
      bearingDegrees: params.bearing,
      speedMetersPerSecond: params.speed,
      recordedAt: params.recordedAt,
    });
    if (locationUpdateResult.isErr()) {
      return locationUpdateResult;
    }

    // Load driver
    const findResult = await this.repository.findById({
      id: driverIdResult.value,
    });
    if (findResult.isErr()) {
      return findResult;
    }

    const driver = findResult.value;
    if (!driver) {
      return Result.err(new NotFoundError("Driver", params.driverId));
    }

    const nowUTC = this.clock.now().toISOString();

    // Update location via aggregate method
    const updateResult = driver.updateLocation(
      locationUpdateResult.value,
      this.clock,
      nowUTC
    );
    if (updateResult.isErr()) {
      return updateResult;
    }

    // Persist via repository
    const saveResult = await this.repository.save(driver);
    if (saveResult.isErr()) {
      return saveResult;
    }

    const savedDriver = saveResult.value;

    // Publish domain events
    await this.publishDomainEvents(savedDriver);

    // Maintain geo-index consistency
    // Only update index if driver is AVAILABLE
    if (
      savedDriver.state === DRIVER_STATES.AVAILABLE &&
      savedDriver.currentLocation
    ) {
      await this.geoIndex.updateLocation({
        driverId: driverIdResult.value,
        location: savedDriver.currentLocation.location,
      });
    }

    // Map to DTO
    return ok(mapDriverToDTO(savedDriver));
  }

  /**
   * Get a driver by ID
   */
  async getDriver(
    params: GetDriverParams
  ): Promise<Result<DriverDTO | null, DomainError>> {
    // Convert primitives to VOs at boundary
    const driverIdResult = DriverId.create(params.driverId);
    if (driverIdResult.isErr()) {
      return driverIdResult;
    }

    // Load driver
    const findResult = await this.repository.findById({
      id: driverIdResult.value,
    });
    if (findResult.isErr()) {
      return findResult;
    }

    const driver = findResult.value;

    // Return null if not found (caller can decide if that's an error)
    if (!driver) {
      return ok(null);
    }

    // Map to DTO
    return ok(mapDriverToDTO(driver));
  }

  private async publishDomainEvents(driver: Driver): Promise<void> {
    const domainEvents = driver.pullDomainEvents();
    for (const event of domainEvents) {
      await this.eventBus.publish(event);
    }
  }
}

/**
 * Factory function to create a DriverService instance
 */
export const createDriverService = (
  repository: DriverRepositoryPort,
  geoIndex: GeoSpatialIndexPort,
  eventBus: EventBusPort,
  clock: Clock
): IDriverService => {
  return new DriverService(repository, geoIndex, eventBus, clock);
};
