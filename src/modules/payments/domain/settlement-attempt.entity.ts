import { Result } from "../../../shared/core/result.js";
import type { IdempotencyKey } from "../../../shared/domain/value-objects/idempotency-key.js";
import { ValidationError } from "../../../shared/errors/error-types.js";
import type { PaymentIntentId } from "../../../shared/types/ids/index.js";
import type { SettlementOutcome } from "./payment-types.js";

/**
 * SettlementAttempt is a child entity owned by PaymentIntent.
 *
 * It records the immutable evidence of a single settlement attempt:
 * - when it was initiated
 * - what outcome occurred
 * - what provider reference (if any) was returned
 * - what reason code explains the outcome
 *
 * SettlementAttempt is NOT an aggregate root:
 * - No domain events (only aggregate roots record events)
 * - No I/O access (pure domain entity)
 * - No independent lifecycle (always created via PaymentIntent)
 *
 * Invariants:
 * - attemptNumber >= 1 (attempts are 1-indexed)
 * - initiatedAtUTC is non-empty ISO string
 * - immutable after creation
 */
export class SettlementAttempt {
  readonly #paymentIntentId: PaymentIntentId;
  readonly #attemptNumber: number;
  readonly #idempotencyKey: IdempotencyKey;
  readonly #outcome: SettlementOutcome;
  readonly #providerRef: string | null;
  readonly #reasonCode: string | null;
  readonly #initiatedAtUTC: string;
  readonly #completedAtUTC: string | null;

  private constructor(props: {
    paymentIntentId: PaymentIntentId;
    attemptNumber: number;
    idempotencyKey: IdempotencyKey;
    outcome: SettlementOutcome;
    providerRef: string | null;
    reasonCode: string | null;
    initiatedAtUTC: string;
    completedAtUTC: string | null;
  }) {
    this.#paymentIntentId = props.paymentIntentId;
    this.#attemptNumber = props.attemptNumber;
    this.#idempotencyKey = props.idempotencyKey;
    this.#outcome = props.outcome;
    this.#providerRef = props.providerRef;
    this.#reasonCode = props.reasonCode;
    this.#initiatedAtUTC = props.initiatedAtUTC;
    this.#completedAtUTC = props.completedAtUTC;
  }

  /**
   * Create a new SettlementAttempt with validation.
   *
   * Validation rules:
   * - attemptNumber must be >= 1
   * - initiatedAtUTC must be non-empty
   */
  static create(props: {
    paymentIntentId: PaymentIntentId;
    attemptNumber: number;
    idempotencyKey: IdempotencyKey;
    outcome: SettlementOutcome;
    providerRef: string | null;
    reasonCode: string | null;
    initiatedAtUTC: string;
    completedAtUTC: string | null;
  }): Result<SettlementAttempt, ValidationError> {
    if (props.attemptNumber < 1) {
      return Result.err(
        new ValidationError("SettlementAttempt attemptNumber must be >= 1")
      );
    }

    if (props.initiatedAtUTC.trim().length === 0) {
      return Result.err(
        new ValidationError("SettlementAttempt initiatedAtUTC cannot be empty")
      );
    }

    return Result.ok(new SettlementAttempt(props));
  }

  get paymentIntentId(): PaymentIntentId {
    return this.#paymentIntentId;
  }

  get attemptNumber(): number {
    return this.#attemptNumber;
  }

  get idempotencyKey(): IdempotencyKey {
    return this.#idempotencyKey;
  }

  get outcome(): SettlementOutcome {
    return this.#outcome;
  }

  get providerRef(): string | null {
    return this.#providerRef;
  }

  get reasonCode(): string | null {
    return this.#reasonCode;
  }

  get initiatedAtUTC(): string {
    return this.#initiatedAtUTC;
  }

  get completedAtUTC(): string | null {
    return this.#completedAtUTC;
  }
}
