/**
 * Payment Repository
 *
 * Persistence operations for payment intents and settlement attempts.
 * Write-once pattern: no update or delete operations (immutable audit trail).
 * Enforces idempotency: returns ConflictError for duplicate operations.
 */

import type { Transaction } from "sequelize";
import { type Result, tryCatchAsync } from "../../../shared/core/result.js";
import {
  ConflictError,
  type DomainError,
  InfrastructureError,
} from "../../../shared/errors/error-types.js";
// Use model's sequelize instance for test compatibility (avoids singleton mismatch)
import type { SettlementOutcome } from "../domain/payment-types.js";
import { PaymentIntentModel } from "./payment-intent.model.js";
import { SettlementAttemptModel } from "./settlement-attempt.model.js";

/**
 * Payment Intent DTO (domain/infrastructure boundary)
 */
export interface PaymentIntentDTO {
  id: string;
  tenantId: string;
  rideId: string;
  riderId: string;
  amountCOP: number;
  currency: string;
  fareBreakdown: {
    baseFare: number;
    distanceComponent: number;
    timeComponent: number;
    minimumFareApplied: boolean;
  };
  createdAtUTC: string;
  createdAt: Date;
}

/**
 * Settlement Attempt DTO (domain/infrastructure boundary)
 */
export interface SettlementAttemptDTO {
  id: string;
  paymentIntentId: string;
  tenantId: string;
  attemptNumber: number;
  idempotencyKey: string;
  outcome: SettlementOutcome;
  providerRef: string | null;
  reasonCode: string | null;
  initiatedAtUTC: string;
  completedAtUTC: string | null;
}

/**
 * Parameters for creating a payment intent
 */
export interface CreatePaymentIntentParams {
  tenantId: string;
  rideId: string;
  riderId: string;
  amountCOP: number;
  fareBreakdown: {
    baseFare: number;
    distanceComponent: number;
    timeComponent: number;
    minimumFareApplied: boolean;
  };
  createdAtUTC: Date;
}

/**
 * Parameters for creating a settlement attempt
 */
export interface CreateSettlementAttemptParams {
  paymentIntentId: string;
  tenantId: string;
  attemptNumber: number;
  idempotencyKey: string;
  outcome: SettlementOutcome;
  providerRef?: string | null;
  reasonCode?: string | null;
  initiatedAtUTC: Date;
  completedAtUTC?: Date | null;
}

/**
 * Map PaymentIntent model to DTO
 */
const mapIntentToDTO = (model: PaymentIntentModel): PaymentIntentDTO => ({
  id: model.id,
  tenantId: model.tenant_id,
  rideId: model.ride_id,
  riderId: model.rider_id,
  amountCOP: model.amount_cop,
  currency: model.currency,
  fareBreakdown: {
    baseFare: model.fare_base,
    distanceComponent: model.fare_distance_component,
    timeComponent: model.fare_time_component,
    minimumFareApplied: model.fare_minimum_applied,
  },
  createdAtUTC: model.created_at_utc.toISOString(),
  createdAt: model.created_at,
});

/**
 * Map SettlementAttempt model to DTO
 */
const mapAttemptToDTO = (
  model: SettlementAttemptModel
): SettlementAttemptDTO => ({
  id: model.id,
  paymentIntentId: model.payment_intent_id,
  tenantId: model.tenant_id,
  attemptNumber: model.attempt_number,
  idempotencyKey: model.idempotency_key,
  outcome: model.outcome as SettlementOutcome,
  providerRef: model.provider_ref,
  reasonCode: model.reason_code,
  initiatedAtUTC: model.initiated_at_utc.toISOString(),
  completedAtUTC: model.completed_at_utc?.toISOString() ?? null,
});

/**
 * Payment Repository Interface
 */
export interface IPaymentRepository {
  createPaymentIntent(
    params: CreatePaymentIntentParams
  ): Promise<Result<PaymentIntentDTO, DomainError>>;

  findPaymentIntentByRideId(
    rideId: string,
    tenantId: string
  ): Promise<Result<PaymentIntentDTO | null, DomainError>>;

  createSettlementAttempt(
    params: CreateSettlementAttemptParams
  ): Promise<Result<SettlementAttemptDTO, DomainError>>;

  findSettlementAttemptsByIntentId(
    paymentIntentId: string,
    tenantId: string
  ): Promise<Result<readonly SettlementAttemptDTO[], DomainError>>;

  findSettlementAttemptByIdempotencyKey(
    idempotencyKey: string,
    tenantId: string
  ): Promise<Result<SettlementAttemptDTO | null, DomainError>>;
}

/**
 * Payment Repository Implementation
 */
export class PaymentRepository implements IPaymentRepository {
  /**
   * Create a new payment intent
   *
   * Returns ConflictError if payment intent already exists for this ride (idempotency check).
   */
  async createPaymentIntent(
    params: CreatePaymentIntentParams
  ): Promise<Result<PaymentIntentDTO, DomainError>> {
    return tryCatchAsync(
      async () => {
        const modelSequelize = PaymentIntentModel.sequelize!;
        return modelSequelize.transaction(async (transaction: Transaction) => {
          const intent = await PaymentIntentModel.create(
            {
              tenant_id: params.tenantId,
              ride_id: params.rideId,
              rider_id: params.riderId,
              amount_cop: params.amountCOP,
              currency: "COP",
              fare_base: params.fareBreakdown.baseFare,
              fare_distance_component: params.fareBreakdown.distanceComponent,
              fare_time_component: params.fareBreakdown.timeComponent,
              fare_minimum_applied: params.fareBreakdown.minimumFareApplied,
              created_at_utc: params.createdAtUTC,
            },
            { transaction }
          );

          return mapIntentToDTO(intent);
        });
      },
      (error) => {
        const errorMessage = String(error);
        if (
          errorMessage.includes("unique constraint") ||
          errorMessage.includes("UNIQUE constraint") ||
          errorMessage.includes("duplicate key")
        ) {
          return new ConflictError("Payment intent already exists for ride", {
            currentState: "CREATED",
            attemptedAction: "create payment intent",
          });
        }

        return new InfrastructureError("Failed to create payment intent", {
          service: "database",
          cause: error,
          retryable: true,
        });
      }
    );
  }

  /**
   * Find payment intent by ride ID with tenant isolation
   *
   * Returns null if not found (not an error condition).
   */
  async findPaymentIntentByRideId(
    rideId: string,
    tenantId: string
  ): Promise<Result<PaymentIntentDTO | null, DomainError>> {
    return tryCatchAsync(
      async () => {
        const intent = await PaymentIntentModel.findOne({
          where: {
            ride_id: rideId,
            tenant_id: tenantId,
          },
        });

        if (!intent) {
          return null;
        }

        return mapIntentToDTO(intent);
      },
      (error) =>
        new InfrastructureError("Failed to find payment intent", {
          service: "database",
          cause: error,
          retryable: true,
        })
    );
  }

  /**
   * Create a new settlement attempt
   *
   * Returns ConflictError if attempt with this idempotency key already exists.
   */
  async createSettlementAttempt(
    params: CreateSettlementAttemptParams
  ): Promise<Result<SettlementAttemptDTO, DomainError>> {
    return tryCatchAsync(
      async () => {
        const modelSequelize = SettlementAttemptModel.sequelize!;
        return modelSequelize.transaction(async (transaction: Transaction) => {
          const attempt = await SettlementAttemptModel.create(
            {
              payment_intent_id: params.paymentIntentId,
              tenant_id: params.tenantId,
              attempt_number: params.attemptNumber,
              idempotency_key: params.idempotencyKey,
              outcome: params.outcome,
              provider_ref: params.providerRef ?? null,
              reason_code: params.reasonCode ?? null,
              initiated_at_utc: params.initiatedAtUTC,
              completed_at_utc: params.completedAtUTC ?? null,
            },
            { transaction }
          );

          return mapAttemptToDTO(attempt);
        });
      },
      (error) => {
        const errorMessage = String(error);
        if (
          errorMessage.includes("unique constraint") ||
          errorMessage.includes("UNIQUE constraint") ||
          errorMessage.includes("duplicate key")
        ) {
          return new ConflictError(
            "Settlement attempt with this idempotency key already exists",
            {
              attemptedAction: "create settlement attempt",
            }
          );
        }

        return new InfrastructureError("Failed to create settlement attempt", {
          service: "database",
          cause: error,
          retryable: true,
        });
      }
    );
  }

  /**
   * Find all settlement attempts for a payment intent with tenant isolation
   *
   * Returns empty array if no attempts found (not an error condition).
   * Results ordered by attempt_number ascending for chronological audit trail.
   */
  async findSettlementAttemptsByIntentId(
    paymentIntentId: string,
    tenantId: string
  ): Promise<Result<readonly SettlementAttemptDTO[], DomainError>> {
    return tryCatchAsync(
      async () => {
        const attempts = await SettlementAttemptModel.findAll({
          where: {
            payment_intent_id: paymentIntentId,
            tenant_id: tenantId,
          },
          order: [["attempt_number", "ASC"]],
        });

        return attempts.map(mapAttemptToDTO);
      },
      (error) =>
        new InfrastructureError("Failed to find settlement attempts", {
          service: "database",
          cause: error,
          retryable: true,
        })
    );
  }

  /**
   * Find settlement attempt by idempotency key with tenant isolation
   *
   * Returns null if not found (not an error condition).
   */
  async findSettlementAttemptByIdempotencyKey(
    idempotencyKey: string,
    tenantId: string
  ): Promise<Result<SettlementAttemptDTO | null, DomainError>> {
    return tryCatchAsync(
      async () => {
        const attempt = await SettlementAttemptModel.findOne({
          where: {
            idempotency_key: idempotencyKey,
            tenant_id: tenantId,
          },
        });

        if (!attempt) {
          return null;
        }

        return mapAttemptToDTO(attempt);
      },
      (error) =>
        new InfrastructureError("Failed to find settlement attempt", {
          service: "database",
          cause: error,
          retryable: true,
        })
    );
  }
}

/**
 * Create a payment repository instance
 */
export const createPaymentRepository = (): IPaymentRepository => {
  return new PaymentRepository();
};
