/**
 * Integration Events - Cross-Context Contracts
 *
 * These are versioned, stable event contracts published for external consumption.
 * They are NOT internal domain events - they're the external API of the payments context.
 *
 * DESIGN PRINCIPLES:
 * - Versioned and stable (schema changes require new version)
 * - JSON-safe payloads (no class instances)
 * - No tenantId (PRD: isolation via ownership/role/geo)
 * - IDs are strings at boundary (serialized from branded types)
 * - eventType is routing key; schemaVersion is explicit for evolution
 */

/**
 * Base envelope for all integration events.
 * Includes routing and tracing metadata.
 */
export interface IntegrationEventEnvelope<TType extends string, TPayload> {
  /** Unique event identifier (UUID) */
  readonly eventId: string;
  /** Event type routing key (e.g., 'payment.intent.created.v1') */
  readonly eventType: TType;
  /** Schema version for payload evolution */
  readonly schemaVersion: "v1";
  /** When event occurred (ISO 8601 UTC) */
  readonly occurredAtUTC: string;
  /** Correlation ID for distributed tracing */
  readonly correlationId: string;
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
// PaymentIntentCreated - v1
// ============================================================================

/**
 * Published when a payment intent is created for a completed ride.
 * Downstream consumers: billing, analytics, customer notifications.
 */
export interface PaymentIntentCreatedV1Payload {
  /** Payment intent identifier (string serialization) */
  readonly paymentIntentId: string;
  /** Ride identifier (string serialization) */
  readonly rideId: string;
  /** Rider identifier (string serialization) */
  readonly riderId: string;
  /** Payment amount in COP (integer) */
  readonly amountCOP: number;
  /** Currency code (always 'COP') */
  readonly currency: "COP";
  /** When intent was created (ISO 8601 UTC) */
  readonly createdAtUTC: string;
}

export type PaymentIntentCreatedV1 = IntegrationEventEnvelope<
  "payment.intent.created.v1",
  PaymentIntentCreatedV1Payload
>;

// ============================================================================
// PaymentSettlementCompleted - v1
// ============================================================================

/**
 * Published when a settlement attempt completes (success or failure).
 * Downstream consumers: ride state machine, billing, fraud detection.
 *
 * DESIGN NOTE: Combines success/failure into one event with outcome field.
 * Consumers filter by outcome field for specific handling.
 */
export interface PaymentSettlementCompletedV1Payload {
  /** Payment intent identifier (string serialization) */
  readonly paymentIntentId: string;
  /** Ride identifier (string serialization) */
  readonly rideId: string;
  /** Rider identifier (string serialization) */
  readonly riderId: string;
  /** Payment amount in COP (integer) */
  readonly amountCOP: number;
  /** Currency code (always 'COP') */
  readonly currency: "COP";
  /** Settlement outcome (SUCCEEDED | FAILED | DECLINED | UNKNOWN | PENDING) */
  readonly outcome: string;
  /** Reason code (null if SUCCEEDED, provider code otherwise) */
  readonly reasonCode: string | null;
  /** Provider reference for reconciliation (null if failed before provider call) */
  readonly providerRef: string | null;
  /** When settlement completed (ISO 8601 UTC) */
  readonly completedAtUTC: string;
}

export type PaymentSettlementCompletedV1 = IntegrationEventEnvelope<
  "payment.settlement.completed.v1",
  PaymentSettlementCompletedV1Payload
>;

// ============================================================================
// Union Type for All Integration Events
// ============================================================================

/**
 * Union of all versioned integration events.
 * Used for type-safe event handling and serialization.
 */
export type IntegrationEvent =
  | PaymentIntentCreatedV1
  | PaymentSettlementCompletedV1;
