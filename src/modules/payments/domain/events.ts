import type { DomainEvent } from "../../../shared/events/domain-event.js";
import { createDomainEvent } from "../../../shared/events/domain-event.js";
import type {
  PaymentIntentId,
  RideId,
  RiderId,
} from "../../../shared/types/ids/index.js";
import type { SettlementOutcome } from "./payment-types.js";

/**
 * Payment Domain Events - Internal Facts
 *
 * These events are recorded inside PaymentIntent aggregate mutations and represent
 * immutable past-tense facts about what happened in the payments domain.
 *
 * They are NOT integration events - they are internal domain signals for:
 * - Testing aggregate behavior
 * - In-process event handlers
 * - Future event sourcing (if needed)
 *
 * Integration events (for cross-context consumption) are mapped from these
 * domain events at the application layer.
 */

// ============================================================================
// PaymentIntentCreated
// ============================================================================

export interface PaymentIntentCreatedPayload {
  readonly paymentIntentId: PaymentIntentId;
  readonly rideId: RideId;
  readonly riderId: RiderId;
  readonly amountCOP: number;
  readonly currency: "COP";
  readonly createdAtUTC: string;
}

export type PaymentIntentCreatedEvent = DomainEvent<
  "PaymentIntentCreated",
  PaymentIntentCreatedPayload
>;

export const createPaymentIntentCreatedEvent = (
  aggregateId: PaymentIntentId,
  payload: PaymentIntentCreatedPayload,
  metadata?: { correlationId?: string; causationId?: string }
): PaymentIntentCreatedEvent => {
  return createDomainEvent({
    eventType: "PaymentIntentCreated",
    aggregateId,
    aggregateType: "PaymentIntent",
    payload,
    tenantId: "", // No tenantId per PRD
    correlationId: metadata?.correlationId,
    causationId: metadata?.causationId,
    version: 1,
  });
};

// ============================================================================
// SettlementAttempted
// ============================================================================

export interface SettlementAttemptedPayload {
  readonly paymentIntentId: PaymentIntentId;
  readonly attemptNumber: number;
  readonly idempotencyKey: string; // IdempotencyKey.value
  readonly outcome: SettlementOutcome;
  readonly initiatedAtUTC: string;
}

export type SettlementAttemptedEvent = DomainEvent<
  "SettlementAttempted",
  SettlementAttemptedPayload
>;

export const createSettlementAttemptedEvent = (
  aggregateId: PaymentIntentId,
  payload: SettlementAttemptedPayload,
  metadata?: { correlationId?: string; causationId?: string }
): SettlementAttemptedEvent => {
  return createDomainEvent({
    eventType: "SettlementAttempted",
    aggregateId,
    aggregateType: "PaymentIntent",
    payload,
    tenantId: "", // No tenantId per PRD
    correlationId: metadata?.correlationId,
    causationId: metadata?.causationId,
    version: 1,
  });
};

// ============================================================================
// SettlementSucceeded
// ============================================================================

export interface SettlementSucceededPayload {
  readonly paymentIntentId: PaymentIntentId;
  readonly rideId: RideId;
  readonly riderId: RiderId;
  readonly amountCOP: number;
  readonly providerRef: string; // Provider evidence (opaque)
  readonly completedAtUTC: string;
}

export type SettlementSucceededEvent = DomainEvent<
  "SettlementSucceeded",
  SettlementSucceededPayload
>;

export const createSettlementSucceededEvent = (
  aggregateId: PaymentIntentId,
  payload: SettlementSucceededPayload,
  metadata?: { correlationId?: string; causationId?: string }
): SettlementSucceededEvent => {
  return createDomainEvent({
    eventType: "SettlementSucceeded",
    aggregateId,
    aggregateType: "PaymentIntent",
    payload,
    tenantId: "", // No tenantId per PRD
    correlationId: metadata?.correlationId,
    causationId: metadata?.causationId,
    version: 1,
  });
};

// ============================================================================
// SettlementFailed
// ============================================================================

export interface SettlementFailedPayload {
  readonly paymentIntentId: PaymentIntentId;
  readonly rideId: RideId;
  readonly riderId: RiderId;
  readonly amountCOP: number;
  readonly attemptNumber: number;
  readonly outcome: SettlementOutcome;
  readonly reasonCode: string | null;
  readonly completedAtUTC: string;
}

export type SettlementFailedEvent = DomainEvent<
  "SettlementFailed",
  SettlementFailedPayload
>;

export const createSettlementFailedEvent = (
  aggregateId: PaymentIntentId,
  payload: SettlementFailedPayload,
  metadata?: { correlationId?: string; causationId?: string }
): SettlementFailedEvent => {
  return createDomainEvent({
    eventType: "SettlementFailed",
    aggregateId,
    aggregateType: "PaymentIntent",
    payload,
    tenantId: "", // No tenantId per PRD
    correlationId: metadata?.correlationId,
    causationId: metadata?.causationId,
    version: 1,
  });
};
