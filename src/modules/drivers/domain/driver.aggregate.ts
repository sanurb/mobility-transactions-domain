/**
 * Driver Aggregate Root
 *
 * Enforces invariants for driver availability, location updates, and reservations.
 * Uses internal mutation with readonly getters for performance (high-frequency location updates).
 * Extends AggregateRoot for domain event recording.
 */

import { Result } from "../../../shared/core/result.js";
import { AggregateRoot } from "../../../shared/domain/aggregate_root.js";
import {
  ConflictError,
  ValidationError,
} from "../../../shared/errors/error-types.js";
import {
  canTransition,
  DRIVER_STATES,
  type DriverState,
} from "./driver-states.js";
import {
  createDriverAvailabilityChangedEvent,
  createDriverDispatchedEvent,
  createDriverLocationUpdatedEvent,
} from "./events.js";
import { isLocationFresh } from "./location-rules.js";
import type { Clock } from "./ports/clock.port.js";
import type { DriverId } from "./value-objects/driver-id.js";
import type { LocationUpdate } from "./value-objects/location-update.js";

/**
 * Driver aggregate properties (for persistence and reconstitution)
 */
export interface DriverProps {
  readonly id: DriverId;
  readonly state: DriverState;
  readonly currentLocation: LocationUpdate | null;
  readonly currentRideId: string | null;
  readonly registeredAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

/**
 * Driver aggregate root
 */
export class Driver extends AggregateRoot {
  private _id: DriverId;
  private _state: DriverState;
  private _currentLocation: LocationUpdate | null;
  private _currentRideId: string | null;
  private _registeredAt: Date;
  private _updatedAt: Date;

  private constructor(props: DriverProps) {
    super();
    this._id = props.id;
    this._state = props.state;
    this._currentLocation = props.currentLocation;
    this._currentRideId = props.currentRideId;
    this._registeredAt = props.registeredAt;
    this._updatedAt = props.updatedAt;
    this.version = props.version;
  }

  /**
   * Register a new driver
   *
   * @param params - Driver registration parameters
   * @returns New Driver aggregate
   */
  static register(params: { id: DriverId; clock: Clock }): Driver {
    const now = params.clock.now();

    return new Driver({
      id: params.id,
      state: DRIVER_STATES.OFFLINE, // Drivers start offline
      currentLocation: null,
      currentRideId: null,
      registeredAt: now,
      updatedAt: now,
      version: 0,
    });
  }

  /**
   * Reconstitute a driver from persistence
   *
   * @param props - Persisted driver properties
   * @returns Driver aggregate
   */
  static reconstitute(props: DriverProps): Driver {
    return new Driver(props);
  }

  /**
   * Update driver availability state
   *
   * @param newState - Target state
   * @param nowUTC - Current time as ISO string
   * @returns Result with void or ConflictError
   */
  updateAvailability(
    newState: DriverState,
    nowUTC: string
  ): Result<void, ConflictError> {
    // Validate state transition
    if (!canTransition(this._state, newState)) {
      return Result.err(
        new ConflictError(
          `Cannot transition from ${this._state} to ${newState}`,
          {
            currentState: this._state,
            attemptedAction: `transition to ${newState}`,
          }
        )
      );
    }

    const previousState = this._state;

    this._state = newState;
    this._updatedAt = new Date(nowUTC);
    this.version++;

    // Record domain event for semantic state change
    this.record(
      createDriverAvailabilityChangedEvent({
        driverId: this._id.value,
        previousState,
        newState,
        occurredAtUTC: nowUTC,
      })
    );

    return Result.ok(undefined);
  }

  /**
   * Update driver location
   *
   * @param update - Location update with metadata
   * @param clock - Clock for timestamp validation
   * @param nowUTC - Current time as ISO string
   * @returns Result with void or ValidationError
   */
  updateLocation(
    update: LocationUpdate,
    clock: Clock,
    nowUTC: string
  ): Result<void, ValidationError> {
    // Location updates not allowed when OFFLINE
    if (this._state === DRIVER_STATES.OFFLINE) {
      return Result.err(
        new ValidationError("Cannot update location while offline")
      );
    }

    // Validate location is not in the future
    const now = clock.now();
    if (update.recordedAt.getTime() > now.getTime()) {
      return Result.err(
        new ValidationError("Location timestamp cannot be in the future")
      );
    }

    // Only record event if location actually changed (avoid spam on no-op updates)
    const locationChanged =
      !this._currentLocation ||
      this._currentLocation.location.latitude !== update.location.latitude ||
      this._currentLocation.location.longitude !== update.location.longitude;

    this._currentLocation = update;
    this._updatedAt = new Date(nowUTC);
    this.version++;

    if (locationChanged) {
      this.record(
        createDriverLocationUpdatedEvent({
          driverId: this._id.value,
          latitude: update.location.latitude,
          longitude: update.location.longitude,
          accuracyMeters: update.accuracyMeters,
          bearingDegrees: update.bearingDegrees,
          speedMetersPerSecond: update.speedMetersPerSecond,
          recordedAt: update.recordedAt,
          occurredAtUTC: nowUTC,
        })
      );
    }

    return Result.ok(undefined);
  }

  /**
   * Reserve driver for a ride
   *
   * @param params - Reservation parameters
   * @returns Result with void or ConflictError
   */
  reserveForRide(params: {
    rideId: string;
    nowUTC: string;
    distanceMeters?: number;
  }): Result<void, ConflictError> {
    // Must be AVAILABLE to reserve
    if (this._state !== DRIVER_STATES.AVAILABLE) {
      return Result.err(
        new ConflictError("Driver must be AVAILABLE to accept a ride", {
          currentState: this._state,
          attemptedAction: "reserve for ride",
        })
      );
    }

    // Already reserved check
    if (this._currentRideId !== null) {
      return Result.err(
        new ConflictError("Driver is already assigned to a ride", {
          currentState: this._state,
          attemptedAction: "reserve for ride",
        })
      );
    }

    this._state = DRIVER_STATES.BUSY;
    this._currentRideId = params.rideId;
    this._updatedAt = new Date(params.nowUTC);
    this.version++;

    // Record dispatched event
    this.record(
      createDriverDispatchedEvent({
        driverId: this._id.value,
        rideId: params.rideId,
        distanceMeters: params.distanceMeters ?? 0,
        dispatchedAtUTC: params.nowUTC,
      })
    );

    return Result.ok(undefined);
  }

  /**
   * Release driver from a ride
   *
   * @param params - Release parameters
   * @returns Result with void or ConflictError
   */
  releaseFromRide(params: { nowUTC: string }): Result<void, ConflictError> {
    // Must be BUSY to release
    if (this._state !== DRIVER_STATES.BUSY) {
      return Result.err(
        new ConflictError("Driver must be BUSY to release from ride", {
          currentState: this._state,
          attemptedAction: "release from ride",
        })
      );
    }

    const previousState = this._state;

    this._state = DRIVER_STATES.AVAILABLE;
    this._currentRideId = null;
    this._updatedAt = new Date(params.nowUTC);
    this.version++;

    // Record availability change event
    this.record(
      createDriverAvailabilityChangedEvent({
        driverId: this._id.value,
        previousState,
        newState: DRIVER_STATES.AVAILABLE,
        occurredAtUTC: params.nowUTC,
      })
    );

    return Result.ok(undefined);
  }

  /**
   * Check if driver is eligible for dispatch
   *
   * @param now - Current time for freshness check
   * @returns true if eligible, false otherwise
   */
  isEligibleForDispatch(now: Date): boolean {
    // Must be AVAILABLE
    if (this._state !== DRIVER_STATES.AVAILABLE) {
      return false;
    }

    // Must have a current location
    if (this._currentLocation === null) {
      return false;
    }

    // Location must be fresh
    return isLocationFresh({
      recordedAt: this._currentLocation.recordedAt,
      now,
    });
  }

  // Readonly getters
  get id(): string {
    return this._id.value;
  }

  get driverId(): DriverId {
    return this._id;
  }

  get state(): DriverState {
    return this._state;
  }

  get currentLocation(): LocationUpdate | null {
    return this._currentLocation;
  }

  get currentRideId(): string | null {
    return this._currentRideId;
  }

  get registeredAt(): Date {
    return this._registeredAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Convert to plain object for persistence
   */
  toProps(): DriverProps {
    return {
      id: this._id,
      state: this._state,
      currentLocation: this._currentLocation,
      currentRideId: this._currentRideId,
      registeredAt: this._registeredAt,
      updatedAt: this._updatedAt,
      version: this.version,
    };
  }
}
