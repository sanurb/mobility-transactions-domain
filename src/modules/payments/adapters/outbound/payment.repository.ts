import { IdempotencyKey } from "../../../../shared/domain/value-objects/idempotency-key.js";
import { MoneyCOP } from "../../../../shared/domain/value-objects/money-cop.js";
import { InfrastructureError } from "../../../../shared/errors/error-types.js";
import type {
  PaymentIntentId,
  RideId,
} from "../../../../shared/types/ids/index.js";
import {
  unsafePaymentIntentId,
  unsafeRideId,
  unsafeRiderId,
} from "../../../../shared/types/ids/index.js";
import type { PaymentRepositoryPort } from "../../application/ports/payment-repository.port.js";
import type {
  PaymentsTx,
  PaymentsTxContext,
} from "../../application/ports/unit-of-work.port.js";
import { PaymentIntent } from "../../domain/payment-intent.aggregate.js";
import type {
  FareBreakdownRef,
  SettlementOutcome,
} from "../../domain/payment-types.js";
import { SettlementAttempt } from "../../domain/settlement-attempt.entity.js";
import { PaymentIntentModel } from "../../infrastructure/payment-intent.model.js";
import { SettlementAttemptModel } from "../../infrastructure/settlement-attempt.model.js";

/**
 * Sequelize Payment Repository
 *
 * Implements PaymentRepositoryPort using Sequelize models.
 * Maps between domain PaymentIntent aggregate and persistence models.
 *
 * DESIGN:
 * - save() upserts intent + appends attempts (append-only)
 * - find*() reconstitutes via PaymentIntent.reconstitute()
 * - Uses unsafe ID constructors for rehydration (trusted DB data)
 * - Uses MoneyCOP.fromTrusted() for rehydration
 * - Uses IdempotencyKey.create() for validation (DB data must be valid)
 * - MUST NOT pull domain events (application owns orchestration)
 */
export class PaymentRepository implements PaymentRepositoryPort {
  readonly #txContext: PaymentsTxContext;

  constructor(txContext: PaymentsTxContext) {
    this.#txContext = txContext;
  }

  /**
   * Save payment intent aggregate with all settlement attempts.
   */
  async save(aggregate: PaymentIntent, tx: PaymentsTx): Promise<void> {
    try {
      const transaction = this.#txContext.resolveSequelizeTx(tx) as any;

      // Upsert payment intent
      await PaymentIntentModel.upsert(
        {
          id: aggregate.id,
          tenant_id: "", // No tenantId per PRD
          ride_id: aggregate.rideId,
          rider_id: aggregate.riderId,
          amount_cop: aggregate.amountCOP.amount,
          currency: aggregate.currency,
          fare_base: aggregate.fareBreakdown.baseFare,
          fare_distance_component: aggregate.fareBreakdown.distanceComponent,
          fare_time_component: aggregate.fareBreakdown.timeComponent,
          fare_minimum_applied: aggregate.fareBreakdown.minimumFareApplied,
          created_at_utc: new Date(aggregate.createdAtUTC),
        },
        { transaction }
      );

      // Persist settlement attempts (append-only)
      // Only persist attempts that don't exist yet (by payment_intent_id + attempt_number)
      for (const attempt of aggregate.attempts) {
        await SettlementAttemptModel.upsert(
          {
            id: `${aggregate.id}-attempt-${attempt.attemptNumber}`, // Deterministic ID
            payment_intent_id: aggregate.id,
            tenant_id: "", // No tenantId per PRD
            attempt_number: attempt.attemptNumber,
            idempotency_key: attempt.idempotencyKey.value,
            outcome: attempt.outcome,
            provider_ref: attempt.providerRef,
            reason_code: attempt.reasonCode,
            initiated_at_utc: new Date(attempt.initiatedAtUTC),
            completed_at_utc: attempt.completedAtUTC
              ? new Date(attempt.completedAtUTC)
              : null,
          },
          { transaction }
        );
      }
    } catch (error) {
      throw new InfrastructureError(
        `Failed to save payment intent: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Find payment intent by ID.
   * Reconstitutes full aggregate via PaymentIntent.reconstitute().
   */
  async findById(id: PaymentIntentId): Promise<PaymentIntent | null> {
    try {
      const intentModel = await PaymentIntentModel.findByPk(id);

      if (!intentModel) {
        return null;
      }

      return await this.#reconstitute(intentModel);
    } catch (error) {
      throw new InfrastructureError(
        `Failed to find payment intent by id: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Find payment intent by ride ID.
   * Each ride has exactly one payment intent.
   */
  async findByRideId(rideId: RideId): Promise<PaymentIntent | null> {
    try {
      const intentModel = await PaymentIntentModel.findOne({
        where: {
          ride_id: rideId,
        },
      });

      if (!intentModel) {
        return null;
      }

      return await this.#reconstitute(intentModel);
    } catch (error) {
      throw new InfrastructureError(
        `Failed to find payment intent by ride id: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Reconstitute PaymentIntent aggregate from persistence models.
   */
  async #reconstitute(intentModel: PaymentIntentModel): Promise<PaymentIntent> {
    // Load settlement attempts
    const attemptModels = await SettlementAttemptModel.findAll({
      where: {
        payment_intent_id: intentModel.id,
      },
      order: [["attempt_number", "ASC"]],
    });

    // Map attempts to domain entities
    const attempts = attemptModels.map((model) => {
      // Rehydrate idempotency key with validation
      const idempotencyKeyResult = IdempotencyKey.create(model.idempotency_key);

      if (idempotencyKeyResult.isErr()) {
        throw new InfrastructureError(
          `Corrupted idempotency key in settlement attempt ${model.id}: ${idempotencyKeyResult.error.message}`
        );
      }

      const attemptResult = SettlementAttempt.create({
        paymentIntentId: unsafePaymentIntentId(model.payment_intent_id),
        attemptNumber: model.attempt_number,
        idempotencyKey: idempotencyKeyResult.value,
        outcome: model.outcome as SettlementOutcome,
        providerRef: model.provider_ref,
        reasonCode: model.reason_code,
        initiatedAtUTC: model.initiated_at_utc.toISOString(),
        completedAtUTC: model.completed_at_utc
          ? model.completed_at_utc.toISOString()
          : null,
      });

      if (attemptResult.isErr()) {
        throw new InfrastructureError(
          `Corrupted settlement attempt ${model.id}: ${attemptResult.error.message}`
        );
      }

      return attemptResult.value;
    });

    // Map fare breakdown
    const fareBreakdown: FareBreakdownRef = {
      baseFare: intentModel.fare_base,
      distanceComponent: intentModel.fare_distance_component,
      timeComponent: intentModel.fare_time_component,
      minimumFareApplied: intentModel.fare_minimum_applied,
    };

    // Reconstitute aggregate
    return PaymentIntent.reconstitute({
      id: unsafePaymentIntentId(intentModel.id),
      rideId: unsafeRideId(intentModel.ride_id),
      riderId: unsafeRiderId(intentModel.rider_id),
      amountCOP: MoneyCOP.fromTrusted(intentModel.amount_cop),
      fareBreakdown,
      createdAtUTC: intentModel.created_at_utc.toISOString(),
      version: 0, // Version tracking not implemented yet
      attempts,
    });
  }
}
