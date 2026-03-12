/**
 * Payment Event Mapper - Domain Events to Integration Events
 *
 * Pure mapping layer that translates internal domain events into
 * external integration event contracts.
 *
 * DESIGN PRINCIPLES:
 * - Pure function (no I/O, no side effects)
 * - Maps only publishable events (filters internal-only events)
 * - Preserves event metadata (correlationId, causationId, occurredAt)
 * - Serializes branded IDs to strings at boundary
 * - Reuses domain event ID for integration event ID (stable, deterministic)
 *
 * INTERNAL-ONLY EVENTS (not mapped):
 * - SettlementAttempted (internal audit, not externally meaningful)
 */

import type { DomainEvent } from "../../../../shared/events/domain-event.js";
import type {
  PaymentIntentCreatedEvent,
  SettlementFailedEvent,
  SettlementSucceededEvent,
} from "../../domain/events.js";
import type {
  IntegrationEvent,
  PaymentIntentCreatedV1,
  PaymentSettlementCompletedV1,
} from "./integration-events.js";

/**
 * Map payment domain events to integration events.
 *
 * Filters and transforms:
 * - PaymentIntentCreated -> payment.intent.created.v1
 * - SettlementSucceeded -> payment.settlement.completed.v1 (outcome=SUCCEEDED)
 * - SettlementFailed -> payment.settlement.completed.v1 (outcome=FAILED|DECLINED|etc)
 * - SettlementAttempted -> FILTERED (internal-only, not published)
 *
 * @param domainEvents - Domain events recorded by aggregate
 * @returns Integration events ready for outbox enqueue
 */
export const mapPaymentDomainEventsToIntegrationEvents = (
  domainEvents: readonly DomainEvent[]
): readonly IntegrationEvent[] => {
  const integrationEvents: IntegrationEvent[] = [];

  for (const event of domainEvents) {
    // Map PaymentIntentCreated
    if (event.eventType === "PaymentIntentCreated") {
      const paymentEvent = event as PaymentIntentCreatedEvent;
      const integrationEvent: PaymentIntentCreatedV1 = {
        eventId: event.eventId, // Reuse domain event ID for stability
        eventType: "payment.intent.created.v1",
        schemaVersion: "v1",
        occurredAtUTC: event.occurredAt,
        correlationId: event.correlationId ?? event.eventId,
        causationId: event.causationId ?? null,
        aggregateType: "PaymentIntent",
        aggregateId: String(paymentEvent.payload.paymentIntentId),
        payload: {
          paymentIntentId: String(paymentEvent.payload.paymentIntentId),
          rideId: String(paymentEvent.payload.rideId),
          riderId: String(paymentEvent.payload.riderId),
          amountCOP: paymentEvent.payload.amountCOP,
          currency: "COP",
          createdAtUTC: paymentEvent.payload.createdAtUTC,
        },
      };
      integrationEvents.push(integrationEvent);
    }

    // Map SettlementSucceeded
    if (event.eventType === "SettlementSucceeded") {
      const settlementEvent = event as SettlementSucceededEvent;
      const integrationEvent: PaymentSettlementCompletedV1 = {
        eventId: event.eventId, // Reuse domain event ID for stability
        eventType: "payment.settlement.completed.v1",
        schemaVersion: "v1",
        occurredAtUTC: event.occurredAt,
        correlationId: event.correlationId ?? event.eventId,
        causationId: event.causationId ?? null,
        aggregateType: "PaymentIntent",
        aggregateId: String(settlementEvent.payload.paymentIntentId),
        payload: {
          paymentIntentId: String(settlementEvent.payload.paymentIntentId),
          rideId: String(settlementEvent.payload.rideId),
          riderId: String(settlementEvent.payload.riderId),
          amountCOP: settlementEvent.payload.amountCOP,
          currency: "COP",
          outcome: "SUCCEEDED",
          reasonCode: null,
          providerRef: settlementEvent.payload.providerRef,
          completedAtUTC: settlementEvent.payload.completedAtUTC,
        },
      };
      integrationEvents.push(integrationEvent);
    }

    // Map SettlementFailed
    if (event.eventType === "SettlementFailed") {
      const settlementEvent = event as SettlementFailedEvent;
      const integrationEvent: PaymentSettlementCompletedV1 = {
        eventId: event.eventId, // Reuse domain event ID for stability
        eventType: "payment.settlement.completed.v1",
        schemaVersion: "v1",
        occurredAtUTC: event.occurredAt,
        correlationId: event.correlationId ?? event.eventId,
        causationId: event.causationId ?? null,
        aggregateType: "PaymentIntent",
        aggregateId: String(settlementEvent.payload.paymentIntentId),
        payload: {
          paymentIntentId: String(settlementEvent.payload.paymentIntentId),
          rideId: String(settlementEvent.payload.rideId),
          riderId: String(settlementEvent.payload.riderId),
          amountCOP: settlementEvent.payload.amountCOP,
          currency: "COP",
          outcome: settlementEvent.payload.outcome,
          reasonCode: settlementEvent.payload.reasonCode,
          providerRef: null, // Failed attempts may not have providerRef
          completedAtUTC: settlementEvent.payload.completedAtUTC,
        },
      };
      integrationEvents.push(integrationEvent);
    }

    // SettlementAttempted is internal-only - NOT mapped
    // (filters automatically by not handling it)
  }

  return integrationEvents;
};
