/**
 * LocationUpdate Value Object
 *
 * Wraps location with quality metadata.
 * Units are encoded in property names to avoid ambiguity.
 */

import { Result } from "../../../../shared/core/result.js";
import { ValidationError } from "../../../../shared/errors/error-types.js";
import type { Location } from "./location.js";

/**
 * Maximum location accuracy in meters (beyond this is too unreliable)
 */
export const MAX_LOCATION_ACCURACY_METERS = 100;

/**
 * Maximum speed in meters per second (prevents garbage data)
 */
export const MAX_SPEED_MPS = 80;

/**
 * Parameters for creating a LocationUpdate
 */
export interface LocationUpdateParams {
  location: Location;
  accuracyMeters: number;
  bearingDegrees: number;
  speedMetersPerSecond: number;
  recordedAt: Date;
}

/**
 * LocationUpdate value object
 */
export class LocationUpdate {
  private constructor(
    private readonly _location: Location,
    private readonly _accuracyMeters: number,
    private readonly _bearingDegrees: number,
    private readonly _speedMetersPerSecond: number,
    private readonly _recordedAt: Date
  ) {}

  /**
   * Create a LocationUpdate with validation
   *
   * @param params - Location update parameters
   * @returns Result with LocationUpdate or ValidationError
   */
  static create(
    params: LocationUpdateParams
  ): Result<LocationUpdate, ValidationError> {
    const {
      location,
      accuracyMeters,
      bearingDegrees,
      speedMetersPerSecond,
      recordedAt,
    } = params;

    // Validation: accuracyMeters must be positive and within bounds
    if (accuracyMeters <= 0) {
      return Result.err(
        new ValidationError("Accuracy must be greater than 0 meters")
      );
    }

    if (accuracyMeters > MAX_LOCATION_ACCURACY_METERS) {
      return Result.err(
        new ValidationError(
          `Accuracy cannot exceed ${MAX_LOCATION_ACCURACY_METERS} meters`
        )
      );
    }

    // Validation: bearingDegrees must be in [0, 360]
    if (bearingDegrees < 0 || bearingDegrees > 360) {
      return Result.err(
        new ValidationError("Bearing must be between 0 and 360 degrees")
      );
    }

    // Validation: speedMetersPerSecond must be non-negative and within bounds
    if (speedMetersPerSecond < 0) {
      return Result.err(new ValidationError("Speed cannot be negative"));
    }

    if (speedMetersPerSecond > MAX_SPEED_MPS) {
      return Result.err(
        new ValidationError(
          `Speed cannot exceed ${MAX_SPEED_MPS} meters per second`
        )
      );
    }

    // Validation: recordedAt must be a valid Date
    if (Number.isNaN(recordedAt.getTime())) {
      return Result.err(
        new ValidationError("Recorded at must be a valid date")
      );
    }

    return Result.ok(
      new LocationUpdate(
        location,
        accuracyMeters,
        bearingDegrees,
        speedMetersPerSecond,
        recordedAt
      )
    );
  }

  /**
   * Get the location
   */
  get location(): Location {
    return this._location;
  }

  /**
   * Get the accuracy in meters
   */
  get accuracyMeters(): number {
    return this._accuracyMeters;
  }

  /**
   * Get the bearing in degrees
   */
  get bearingDegrees(): number {
    return this._bearingDegrees;
  }

  /**
   * Get the speed in meters per second
   */
  get speedMetersPerSecond(): number {
    return this._speedMetersPerSecond;
  }

  /**
   * Get the recorded timestamp
   */
  get recordedAt(): Date {
    return this._recordedAt;
  }
}
