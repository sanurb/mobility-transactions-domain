/**
 * Initiate Settlement Use Case
 *
 * Command use case: Initiates a settlement attempt for a payment intent.
 *
 * CRITICAL DESIGN:
 * - Two-phase execution: decide + provider call WITHOUT tx, then atomic write
 * - NEVER holds DB transaction open during remote provider I/O
 * - Idempotent by idempotencyKey (aggregate handles duplicate detection)
 * - Enforces all payment policies before calling provider
 * - Atomic: persist aggregate + enqueue outbox in SAME transaction
 */

import type { IdempotencyKey } from "../../../../shared/domain/value-objects/idempotency-key.js";
import {
  ConflictError,
  NotFoundError,
} from "../../../../shared/errors/error-types.js";
import type { RideId } from "../../../../shared/types/ids/index.js";
import {
  canAttemptSettlement,
  isRetryable,
} from "../../domain/payment-policy.js";
import type { SettlementOutcome } from "../../domain/payment-types.js";
import { mapPaymentDomainEventsToIntegrationEvents } from "../events/payment-event-mapper.js";
import type { ClockPort } from "../ports/clock.port.js";
import type { IdGeneratorPort } from "../ports/id-generator.port.js";
import type { OutboxPort } from "../ports/outbox.port.js";
import type { PaymentProviderPort } from "../ports/payment-provider.port.js";
import type { PaymentRepositoryPort } from "../ports/payment-repository.port.js";
import type { UnitOfWorkPort } from "../ports/unit-of-work.port.js";

/**
 * Input for initiating settlement
 */
export interface InitiateSettlementInput {
  /** Ride ID to settle payment for */
  readonly rideId: RideId;
  /** Idempotency key for this settlement attempt */
  readonly idempotencyKey: IdempotencyKey;
  /** Provider token reference (payment method token) */
  readonly providerTokenRef: string;
  /** Whether rider acknowledged a prior DECLINED outcome */
  readonly riderAcknowledgedDecline?: boolean;
  /** Correlation ID for distributed tracing */
  readonly correlationId: string;
  /** Causation ID (optional) */
  readonly causationId?: string;
}

/**
 * Output from initiating settlement
 */
export interface InitiateSettlementOutput {
  readonly paymentIntentId: string;
  readonly rideId: string;
  readonly outcome: SettlementOutcome;
  readonly attemptNumber: number;
  readonly retryable: boolean;
}

/**
 * Initiate Settlement Use Case
 */
export class InitiateSettlementUseCase {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly repo: PaymentRepositoryPort,
    private readonly provider: PaymentProviderPort,
    private readonly outbox: OutboxPort,
    private readonly clock: ClockPort,
    private readonly idGen: IdGeneratorPort
  ) {}

  /**
   * Execute: Initiate settlement attempt.
   *
   * Two-phase orchestration:
   * - Phase A: Load intent, check policy, call provider (NO DB tx)
   * - Phase B: Reload intent in tx, apply mutation, persist + enqueue outbox
   *
   * @param input - Settlement initiation parameters
   * @returns Output with settlement result
   * @throws NotFoundError if payment intent doesn't exist
   * @throws ConflictError if policy violation or concurrent conflict
   */
  async execute(
    input: InitiateSettlementInput
  ): Promise<InitiateSettlementOutput> {
    // ========================================================================
    // Phase A: Decide + Provider Call (NO DB TRANSACTION)
    // ========================================================================

    // Load intent without transaction
    const intent = await this.repo.findByRideId(input.rideId);
    if (!intent) {
      throw new NotFoundError("PaymentIntent", String(input.rideId));
    }

    // Check policy BEFORE calling provider
    const policyCheck = canAttemptSettlement({
      priorAttempts: intent.attempts,
      riderAcknowledgedDecline: input.riderAcknowledgedDecline,
    });

    // If policy violation and NOT due to duplicate idempotency key, throw
    if (policyCheck.isErr()) {
      // Check if it's idempotent replay (duplicate idempotency key)
      const existingAttempt = intent.attempts.find((a) =>
        a.idempotencyKey.equals(input.idempotencyKey)
      );
      if (existingAttempt) {
        // Idempotent replay - return existing attempt
        return {
          paymentIntentId: String(intent.id),
          rideId: String(intent.rideId),
          outcome: existingAttempt.outcome,
          attemptNumber: existingAttempt.attemptNumber,
          retryable: isRetryable(existingAttempt.outcome),
        };
      }
      // Not idempotent replay - it's a real policy violation
      throw new ConflictError(policyCheck.error.message);
    }

    // Record initiation timestamp BEFORE provider call
    const initiatedAtUTC = this.clock.nowUTC();

    // Call payment provider (NOT in a DB transaction)
    const chargeResult = await this.provider.charge({
      idempotencyKey: input.idempotencyKey.value,
      amountCOP: intent.amountCOP.amount,
      riderId: String(intent.riderId),
      tenantId: "", // No tenantId per PRD
      metadata: {
        rideId: String(input.rideId),
        paymentIntentId: String(intent.id),
      },
    });

    // Extract provider result
    const providerOutcome = chargeResult.isOk()
      ? chargeResult.value.outcome
      : "FAILED";
    const providerRef = chargeResult.isOk()
      ? chargeResult.value.providerRef
      : null;
    const reasonCode = chargeResult.isOk()
      ? chargeResult.value.reasonCode
      : "provider_error";
    const completedAtUTC = chargeResult.isOk()
      ? chargeResult.value.completedAtUTC
      : this.clock.nowUTC();

    // ========================================================================
    // Phase B: Atomic Write + Outbox (WITH DB TRANSACTION)
    // ========================================================================

    return this.uow.withTransaction(async (tx) => {
      // Reload intent INSIDE transaction to prevent lost update
      const freshIntent = await this.repo.findByRideId(input.rideId);
      if (!freshIntent) {
        throw new NotFoundError("PaymentIntent", String(input.rideId));
      }

      // Apply mutation with provider result
      const attemptResult = freshIntent.attemptSettlement({
        idempotencyKey: input.idempotencyKey,
        outcome: providerOutcome,
        providerRef,
        reasonCode,
        initiatedAtUTC,
        completedAtUTC,
        riderAcknowledgedDecline: input.riderAcknowledgedDecline,
      });

      if (attemptResult.isErr()) {
        // Concurrent attempt violated policy - conflict
        throw new ConflictError(attemptResult.error.message);
      }

      const attempt = attemptResult.value;

      // Persist aggregate
      await this.repo.save(freshIntent, tx);

      // Pull domain events from aggregate
      const domainEvents = freshIntent.pullDomainEvents();

      // Map to integration events
      const integrationEvents =
        mapPaymentDomainEventsToIntegrationEvents(domainEvents);

      // Enqueue to outbox atomically
      const envelopes = integrationEvents.map((event) => ({
        id: this.idGen.generate(),
        eventName: event.eventType,
        schemaVersion: event.schemaVersion,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        correlationId: event.correlationId,
        causationId: event.causationId,
        occurredAtUTC: event.occurredAtUTC,
        payload: event.payload,
      }));
      await this.outbox.enqueue(envelopes, tx);

      // Return output DTO
      return {
        paymentIntentId: String(freshIntent.id),
        rideId: String(freshIntent.rideId),
        outcome: attempt.outcome,
        attemptNumber: attempt.attemptNumber,
        retryable: isRetryable(attempt.outcome),
      };
    });
  }
}
