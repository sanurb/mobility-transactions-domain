import { Result } from "../../core/result.js";
import { ValidationError } from "../../errors/error-types.js";

/**
 * Allowed characters for idempotency keys (payments-grade).
 * Alphanumeric + safe delimiters: hyphen, underscore, colon
 */
const IDEMPOTENCY_KEY_CHARSET = /^[a-zA-Z0-9\-_:]+$/;

/**
 * Maximum length for idempotency keys.
 * Stripe uses 255, we use 256 for consistency with ID limits.
 */
const MAX_IDEMPOTENCY_KEY_LENGTH = 256;

/**
 * IdempotencyKey provides payments-grade canonicalization for retry safety.
 *
 * Canonicalization rules:
 * - trim whitespace
 * - lowercase
 *
 * Invariants:
 * - non-empty after trim
 * - max length 256
 * - charset: alphanumeric + hyphen/underscore/colon only
 *
 * Why: Idempotency keys must be deterministic across retry attempts.
 * Canonicalization prevents "KEY" vs "key" mismatches.
 */
export class IdempotencyKey {
  readonly #value: string;

  private constructor(canonical: string) {
    this.#value = canonical;
  }

  /**
   * Create IdempotencyKey with canonicalization and validation.
   */
  static create(raw: string): Result<IdempotencyKey, ValidationError> {
    const trimmed = raw.trim();
    const canonical = trimmed.toLowerCase();

    if (canonical.length === 0) {
      return Result.err(new ValidationError("IdempotencyKey cannot be empty"));
    }

    if (canonical.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      return Result.err(
        new ValidationError(
          `IdempotencyKey cannot exceed ${MAX_IDEMPOTENCY_KEY_LENGTH} characters`
        )
      );
    }

    if (!IDEMPOTENCY_KEY_CHARSET.test(canonical)) {
      return Result.err(
        new ValidationError(
          "IdempotencyKey must contain only alphanumeric characters, hyphens, underscores, or colons"
        )
      );
    }

    return Result.ok(new IdempotencyKey(canonical));
  }

  /**
   * Unsafe constructor for trusted/validated sources (persistence layer, adapters).
   * MUST only be used when data is already validated (e.g., from database or validated HTTP boundary).
   */
  static unsafe(value: string): IdempotencyKey {
    return new IdempotencyKey(value);
  }

  get value(): string {
    return this.#value;
  }

  equals(other: IdempotencyKey): boolean {
    return this.#value === other.#value;
  }
}
