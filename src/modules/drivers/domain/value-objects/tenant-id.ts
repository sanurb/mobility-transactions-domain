/**
 * TenantId Value Object
 *
 * Wraps tenant identifier with validation.
 * No primitive obsession - tenant IDs are domain concepts.
 */

import { Result } from "../../../../shared/core/result.js";
import { ValidationError } from "../../../../shared/errors/error-types.js";

/**
 * Maximum length for tenant ID string
 */
export const TENANT_ID_MAX_LENGTH = 255;

/**
 * TenantId value object
 */
export class TenantId {
  private constructor(private readonly _value: string) {}

  /**
   * Create a TenantId with validation
   *
   * @param value - Tenant ID string
   * @returns Result with TenantId or ValidationError
   */
  static create(value: string): Result<TenantId, ValidationError> {
    // Validation: non-empty
    if (!value || value.trim().length === 0) {
      return Result.err(new ValidationError("Tenant ID cannot be empty"));
    }

    const trimmed = value.trim();

    // Validation: max length
    if (trimmed.length > TENANT_ID_MAX_LENGTH) {
      return Result.err(
        new ValidationError(
          `Tenant ID cannot exceed ${TENANT_ID_MAX_LENGTH} characters`
        )
      );
    }

    return Result.ok(new TenantId(trimmed));
  }

  /**
   * Get the tenant ID value
   */
  get value(): string {
    return this._value;
  }

  /**
   * Check equality with another TenantId
   */
  equals(other: TenantId): boolean {
    return this._value === other._value;
  }
}
