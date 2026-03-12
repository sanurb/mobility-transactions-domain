/**
 * DriverId Value Object
 *
 * Wraps driver identifier with validation.
 * No primitive obsession - driver IDs are domain concepts.
 */

import { Result } from "../../../../shared/core/result.js";
import { ValidationError } from "../../../../shared/errors/error-types.js";

/**
 * Maximum length for driver ID string
 */
export const DRIVER_ID_MAX_LENGTH = 255;

/**
 * DriverId value object
 */
export class DriverId {
  private constructor(private readonly _value: string) {}

  /**
   * Create a DriverId with validation
   *
   * @param value - Driver ID string
   * @returns Result with DriverId or ValidationError
   */
  static create(value: string): Result<DriverId, ValidationError> {
    // Validation: non-empty
    if (!value || value.trim().length === 0) {
      return Result.err(new ValidationError("Driver ID cannot be empty"));
    }

    const trimmed = value.trim();

    // Validation: max length
    if (trimmed.length > DRIVER_ID_MAX_LENGTH) {
      return Result.err(
        new ValidationError(
          `Driver ID cannot exceed ${DRIVER_ID_MAX_LENGTH} characters`
        )
      );
    }

    return Result.ok(new DriverId(trimmed));
  }

  /**
   * Get the driver ID value
   */
  get value(): string {
    return this._value;
  }

  /**
   * Check equality with another DriverId
   */
  equals(other: DriverId): boolean {
    return this._value === other._value;
  }
}
