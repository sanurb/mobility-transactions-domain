import { Result } from "../../core/result.js";
import { ValidationError } from "../../errors/error-types.js";
import type { Location } from "./location.js";

export class Distance {
  private constructor(private readonly _meters: number) {}

  static fromMeters(meters: number): Result<Distance, ValidationError> {
    if (meters < 0) {
      return Result.err(new ValidationError("Distance cannot be negative"));
    }
    if (!Number.isFinite(meters)) {
      return Result.err(
        new ValidationError("Distance must be a finite number")
      );
    }
    return Result.ok(new Distance(meters));
  }

  static haversine(from: Location, to: Location): Distance {
    const R = 6_371_000;
    const lat1 = (from.latitude * Math.PI) / 180;
    const lat2 = (to.latitude * Math.PI) / 180;
    const deltaLat = ((to.latitude - from.latitude) * Math.PI) / 180;
    const deltaLon = ((to.longitude - from.longitude) * Math.PI) / 180;
    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) *
        Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return new Distance(R * c);
  }

  get meters(): number {
    return this._meters;
  }
  get kilometers(): number {
    return this._meters / 1000;
  }

  equals(other: Distance): boolean {
    return this._meters === other._meters;
  }
}
