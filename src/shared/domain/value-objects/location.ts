import { Result } from "../../core/result.js";
import { ValidationError } from "../../errors/error-types.js";

export class Location {
  private constructor(
    private readonly _latitude: number,
    private readonly _longitude: number
  ) {}

  static create(
    latitude: number,
    longitude: number
  ): Result<Location, ValidationError> {
    if (!Number.isFinite(latitude)) {
      return Result.err(
        new ValidationError("Latitude must be a finite number")
      );
    }
    if (!Number.isFinite(longitude)) {
      return Result.err(
        new ValidationError("Longitude must be a finite number")
      );
    }
    if (latitude < -90 || latitude > 90) {
      return Result.err(
        new ValidationError("Latitude must be between -90 and 90 degrees")
      );
    }
    if (longitude < -180 || longitude > 180) {
      return Result.err(
        new ValidationError("Longitude must be between -180 and 180 degrees")
      );
    }
    return Result.ok(new Location(latitude, longitude));
  }

  get latitude(): number {
    return this._latitude;
  }
  get longitude(): number {
    return this._longitude;
  }

  equals(other: Location): boolean {
    return (
      this._latitude === other._latitude && this._longitude === other._longitude
    );
  }
}
