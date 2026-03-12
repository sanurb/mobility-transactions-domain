/**
 * Integration Events - Cross-Context Contracts
 *
 * These are versioned, stable event contracts published for external consumption.
 * They are NOT internal domain events - they're the external API of the dispatch context.
 *
 * DESIGN PRINCIPLES:
 * - Versioned and stable (schema changes require new version)
 * - JSON-safe payloads (no class instances)
 * - No tenantId (PRD: isolation via ownership/role/geo)
 * - IDs are strings at boundary (serialized from branded types)
 * - eventType is routing key; schemaVersion is explicit for evolution
 * - Minimal payloads (only what external consumers need)
 */

import type { DomainEvent } from "../../../../shared/events/domain-event.js";
import {
  DISPATCH_DOMAIN_EVENT_TYPES,
  type DispatchFailedPayload,
  type DispatchSucceededPayload,
} from "../../domain/events.js";

/**
 * Base envelope for all integration events.
 * Includes routing and tracing metadata.
 */
export interface IntegrationEventEnvelope<TType extends string, TPayload> {
  /** Unique event identifier (UUID) */
  readonly eventId: string;
  /** Event type routing key (e.g., 'dispatch.completed.v1') */
  readonly eventType: TType;
  /** Schema version for payload evolution */
  readonly schemaVersion: "v1";
  /** When event occurred (ISO 8601 UTC) */
  readonly occurredAtUTC: string;
  /** Correlation ID for distributed tracing */
  readonly correlationId: string | null;
  /** Causation ID - the event/command that caused this (if any) */
  readonly causationId: string | null;
  /** Aggregate type this event relates to */
  readonly aggregateType: string;
  /** Aggregate ID (serialized) */
  readonly aggregateId: string;
  /** Event payload - versioned and stable */
  readonly payload: TPayload;
}

// ============================================================================
// DispatchCompleted - v1
// ============================================================================

/**
 * Published when a dispatch successfully assigns a driver to a ride.
 * Downstream consumers: ride state machine, notifications, analytics.
 */
export interface DispatchCompletedV1Payload {
  /** Ride identifier */
  readonly rideId: string;
  /** Driver identifier */
  readonly driverId: string;
  /** When dispatch completed (ISO 8601 UTC) */
  readonly dispatchedAtUTC: string;
  /** Correlation ID for tracing (optional) */
  readonly correlationId?: string;
}

export type DispatchCompletedV1 = IntegrationEventEnvelope<
  "dispatch.completed.v1",
  DispatchCompletedV1Payload
>;

// ============================================================================
// DispatchFailed - v1
// ============================================================================

/**
 * Published when a dispatch fails to assign a driver to a ride.
 * Downstream consumers: ride state machine (to handle failure), monitoring, analytics.
 */
export interface DispatchFailedV1Payload {
  /** Ride identifier */
  readonly rideId: string;
  /** Failure outcome classification */
  readonly outcome: "NO_ELIGIBLE" | "CONFLICT" | "FAILED";
  /** Human-readable failure reason (optional) */
  readonly reason?: string;
  /** When dispatch failed (ISO 8601 UTC) */
  readonly failedAtUTC: string;
  /** Correlation ID for tracing (optional) */
  readonly correlationId?: string;
}

export type DispatchFailedV1 = IntegrationEventEnvelope<
  "dispatch.failed.v1",
  DispatchFailedV1Payload
>;

// ============================================================================
// Union Type for All Integration Events
// ============================================================================

/**
 * Union of all versioned integration events.
 * Used for type-safe event handling and serialization.
 */
export type IntegrationEvent = DispatchCompletedV1 | DispatchFailedV1;

// ============================================================================
// Mapper: Domain Events → Integration Events
// ============================================================================

/**
 * Map dispatch domain events to integration events.
 * Filters internal-only events (DISPATCH_INITIATED is not published externally).
 *
 * DESIGN NOTE: Returns array because one domain event might map to multiple
 * integration events in the future, or be filtered out entirely.
 */
export const mapDispatchDomainEvents = (
  domainEvents: ReadonlyArray<DomainEvent>
): IntegrationEvent[] => {
  const integrationEvents: IntegrationEvent[] = [];

  for (const domainEvent of domainEvents) {
    // Map DISPATCH_SUCCEEDED to dispatch.completed.v1
    if (
      domainEvent.eventType === DISPATCH_DOMAIN_EVENT_TYPES.DISPATCH_SUCCEEDED
    ) {
      const payload = domainEvent.payload as DispatchSucceededPayload;

      const integrationEvent: DispatchCompletedV1 = {
        eventId: domainEvent.eventId,
        eventType: "dispatch.completed.v1",
        schemaVersion: "v1",
        occurredAtUTC: domainEvent.occurredAt,
        correlationId: domainEvent.correlationId ?? null,
        causationId: domainEvent.causationId ?? null,
        aggregateType: domainEvent.aggregateType,
        aggregateId: domainEvent.aggregateId,
        payload: {
          rideId: payload.rideId,
          driverId: payload.driverId,
          dispatchedAtUTC: payload.dispatchedAt,
          correlationId: domainEvent.correlationId,
        },
      };

      integrationEvents.push(integrationEvent);
    }

    // Map DISPATCH_FAILED to dispatch.failed.v1
    if (domainEvent.eventType === DISPATCH_DOMAIN_EVENT_TYPES.DISPATCH_FAILED) {
      const payload = domainEvent.payload as DispatchFailedPayload;

      const integrationEvent: DispatchFailedV1 = {
        eventId: domainEvent.eventId,
        eventType: "dispatch.failed.v1",
        schemaVersion: "v1",
        occurredAtUTC: domainEvent.occurredAt,
        correlationId: domainEvent.correlationId ?? null,
        causationId: domainEvent.causationId ?? null,
        aggregateType: domainEvent.aggregateType,
        aggregateId: domainEvent.aggregateId,
        payload: {
          rideId: payload.rideId,
          outcome: payload.outcome,
          reason: payload.reason ?? undefined,
          failedAtUTC: payload.failedAt,
          correlationId: domainEvent.correlationId,
        },
      };

      integrationEvents.push(integrationEvent);
    }

    // DISPATCH_INITIATED is internal-only, not published
  }

  return integrationEvents;
};
