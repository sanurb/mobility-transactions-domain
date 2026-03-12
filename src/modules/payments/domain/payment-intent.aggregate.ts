import { Result } from "../../../shared/core/result.js";
import { AggregateRoot } from "../../../shared/domain/aggregate_root.js";
import type { IdempotencyKey } from "../../../shared/domain/value-objects/idempotency-key.js";
import type { MoneyCOP } from "../../../shared/domain/value-objects/money-cop.js";
import { PolicyViolationError } from "../../../shared/errors/error-types.js";
import type {
  PaymentIntentId,
  RideId,
  RiderId,
} from "../../../shared/types/ids/index.js";
import {
  createPaymentIntentCreatedEvent,
  createSettlementAttemptedEvent,
  createSettlementFailedEvent,
  createSettlementSucceededEvent,
} from "./events.js";
import {
  canAttemptSettlement,
  derivePaymentStatus,
  getNextAttemptNumber,
  type PaymentStatus,
} from "./payment-policy.js";
import type { FareBreakdownRef, SettlementOutcome } from "./payment-types.js";
import { SETTLEMENT_OUTCOMES } from "./payment-types.js";
import { SettlementAttempt } from "./settlement-attempt.entity.js";

/**
 * PaymentIntent Aggregate Root
 *
 * Represents the intent to collect payment for a completed ride.
 * Owns all SettlementAttempts and enforces payment policy internally.
 *
 * Invariants enforced:
 * - No more than one SUCCEEDED settlement per ride (anti-duplication)
 * - Maximum 3 settlement attempts (attempt limit)
 * - DECLINED settlements require rider acknowledgment before retry
 * - All idempotency keys are unique within this intent
 *
 * Domain events recorded:
 * - PaymentIntentCreated (on creation)
 * - SettlementAttempted (on every settlement attempt)
 * - SettlementSucceeded (when outcome is SUCCEEDED)
 * - SettlementFailed (when outcome is FAILED/DECLINED/UNKNOWN)
 *
 * NO TENANTID - per PRD, isolation via ownership/role/geo.
 * NO I/O - pure domain aggregate.
 * NO CLOCK ACCESS - all timestamps supplied by caller.
 */
export class PaymentIntent extends AggregateRoot {
  readonly #id: PaymentIntentId;
  readonly #rideId: RideId;
  readonly #riderId: RiderId;
  readonly #amountCOP: MoneyCOP;
  readonly #currency = "COP";
  readonly #fareBreakdown: FareBreakdownRef;
  readonly #createdAtUTC: string;
  #attempts: SettlementAttempt[] = [];

  private constructor(props: {
    id: PaymentIntentId;
    rideId: RideId;
    riderId: RiderId;
    amountCOP: MoneyCOP;
    fareBreakdown: FareBreakdownRef;
    createdAtUTC: string;
    attempts?: SettlementAttempt[];
    version?: number;
  }) {
    super();
    this.#id = props.id;
    this.#rideId = props.rideId;
    this.#riderId = props.riderId;
    this.#amountCOP = props.amountCOP;
    this.#fareBreakdown = props.fareBreakdown;
    this.#createdAtUTC = props.createdAtUTC;
    this.#attempts = props.attempts ?? [];
    this.version = props.version ?? 0;
  }

  /**
   * Create a new PaymentIntent.
   * Records PaymentIntentCreated event.
   */
  static create(props: {
    id: PaymentIntentId;
    rideId: RideId;
    riderId: RiderId;
    amountCOP: MoneyCOP;
    fareBreakdown: FareBreakdownRef;
    createdAtUTC: string;
  }): PaymentIntent {
    const intent = new PaymentIntent(props);

    // Record domain event
    intent.record(
      createPaymentIntentCreatedEvent(props.id, {
        paymentIntentId: props.id,
        rideId: props.rideId,
        riderId: props.riderId,
        amountCOP: props.amountCOP.amount,
        currency: "COP",
        createdAtUTC: props.createdAtUTC,
      })
    );

    return intent;
  }

  /**
   * Reconstitute a PaymentIntent from persistence.
   * DOES NOT record events (rehydration only).
   */
  static reconstitute(props: {
    id: PaymentIntentId;
    rideId: RideId;
    riderId: RiderId;
    amountCOP: MoneyCOP;
    fareBreakdown: FareBreakdownRef;
    createdAtUTC: string;
    version: number;
    attempts: SettlementAttempt[];
  }): PaymentIntent {
    // Create mutable copy of attempts array for internal mutation
    // (getter provides immutable view for external access)
    return new PaymentIntent({
      ...props,
      attempts: [...props.attempts],
    });
  }

  /**
   * Attempt settlement with policy enforcement.
   *
   * Enforces all payment policies:
   * - Anti-duplication (no second SUCCEEDED)
   * - Attempt limit (max 3 attempts)
   * - DECLINED handling (rider acknowledgment required)
   * - Idempotency (duplicate idempotency keys handled)
   *
   * Records events:
   * - SettlementAttempted (always)
   * - SettlementSucceeded (if outcome SUCCEEDED)
   * - SettlementFailed (if outcome FAILED/DECLINED/UNKNOWN)
   *
   * @param params Settlement attempt parameters
   * @returns Result with created SettlementAttempt or PolicyViolationError
   */
  attemptSettlement(params: {
    idempotencyKey: IdempotencyKey;
    outcome: SettlementOutcome;
    providerRef: string | null;
    reasonCode: string | null;
    initiatedAtUTC: string;
    completedAtUTC: string | null;
    riderAcknowledgedDecline?: boolean;
  }): Result<SettlementAttempt, PolicyViolationError> {
    // Check for duplicate idempotency key (internal idempotency check)
    const existingAttempt = this.#attempts.find((a) =>
      a.idempotencyKey.equals(params.idempotencyKey)
    );
    if (existingAttempt) {
      // Idempotent replay - return existing attempt without mutation or events
      return Result.ok(existingAttempt);
    }

    // Check policy
    const policyCheck = canAttemptSettlement({
      priorAttempts: this.#attempts,
      riderAcknowledgedDecline: params.riderAcknowledgedDecline,
    });

    if (policyCheck.isErr()) {
      // Policy violation - no mutation, no events
      return Result.err(policyCheck.error);
    }

    // Compute next attempt number
    const attemptNumber = getNextAttemptNumber(this.#attempts);

    // Create settlement attempt entity
    const attemptResult = SettlementAttempt.create({
      paymentIntentId: this.#id,
      attemptNumber,
      idempotencyKey: params.idempotencyKey,
      outcome: params.outcome,
      providerRef: params.providerRef,
      reasonCode: params.reasonCode,
      initiatedAtUTC: params.initiatedAtUTC,
      completedAtUTC: params.completedAtUTC,
    });

    if (attemptResult.isErr()) {
      // Should not happen if called correctly, but handle gracefully
      return Result.err(
        new PolicyViolationError(
          "SETTLEMENT_ATTEMPT_INVALID",
          attemptResult.error.message
        )
      );
    }

    const attempt = attemptResult.value;

    // Mutate state: append attempt
    this.#attempts.push(attempt);

    // Record SettlementAttempted event (always)
    this.record(
      createSettlementAttemptedEvent(this.#id, {
        paymentIntentId: this.#id,
        attemptNumber,
        idempotencyKey: params.idempotencyKey.value,
        outcome: params.outcome,
        initiatedAtUTC: params.initiatedAtUTC,
      })
    );

    // Record outcome-specific event
    if (params.outcome === SETTLEMENT_OUTCOMES.SUCCEEDED) {
      this.record(
        createSettlementSucceededEvent(this.#id, {
          paymentIntentId: this.#id,
          rideId: this.#rideId,
          riderId: this.#riderId,
          amountCOP: this.#amountCOP.amount,
          providerRef: params.providerRef ?? "", // SUCCEEDED must have providerRef
          completedAtUTC: params.completedAtUTC ?? params.initiatedAtUTC,
        })
      );
    } else {
      // FAILED, DECLINED, UNKNOWN, or PENDING
      this.record(
        createSettlementFailedEvent(this.#id, {
          paymentIntentId: this.#id,
          rideId: this.#rideId,
          riderId: this.#riderId,
          amountCOP: this.#amountCOP.amount,
          attemptNumber,
          outcome: params.outcome,
          reasonCode: params.reasonCode,
          completedAtUTC: params.completedAtUTC ?? params.initiatedAtUTC,
        })
      );
    }

    return Result.ok(attempt);
  }

  /**
   * Aggregate identity (required by AggregateRoot).
   */
  get id(): PaymentIntentId {
    return this.#id;
  }

  get rideId(): RideId {
    return this.#rideId;
  }

  get riderId(): RiderId {
    return this.#riderId;
  }

  get amountCOP(): MoneyCOP {
    return this.#amountCOP;
  }

  get currency(): "COP" {
    return this.#currency;
  }

  get fareBreakdown(): FareBreakdownRef {
    return this.#fareBreakdown;
  }

  get createdAtUTC(): string {
    return this.#createdAtUTC;
  }

  /**
   * Immutable view of settlement attempts.
   */
  get attempts(): readonly SettlementAttempt[] {
    return Object.freeze([...this.#attempts]);
  }

  get attemptCount(): number {
    return this.#attempts.length;
  }

  /**
   * Payment status derived from settlement attempts.
   */
  get paymentStatus(): PaymentStatus {
    return derivePaymentStatus(this.#attempts);
  }
}
