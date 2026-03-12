import { randomUUID } from "node:crypto";

/**
 * Base interface for all domain events
 * Designed for portability to external message brokers
 */
export interface DomainEvent<T extends string = string, P = unknown> {
  /** Unique event identifier (UUID v4) */
  readonly eventId: string;
  /** Event type discriminator (e.g., 'RIDE_CREATED', 'PAYMENT_SUCCEEDED') */
  readonly eventType: T;
  /** ISO 8601 timestamp when event occurred */
  readonly occurredAt: string;
  /** Aggregate/entity ID this event relates to */
  readonly aggregateId: string;
  /** Aggregate type (e.g., 'Ride', 'Payment') */
  readonly aggregateType: string;
  /** Event payload - typed per event */
  readonly payload: P;
  /** Correlation ID for tracing across services */
  readonly correlationId?: string;
  /** Causation ID - the event/command that caused this event */
  readonly causationId?: string;
  /** Tenant ID for multi-tenancy */
  readonly tenantId?: string;
  /** Version for schema evolution */
  readonly version: number;
}

/**
 * Options for creating a domain event
 */
export interface CreateDomainEventOptions<T extends string, P> {
  eventType: T;
  aggregateId: string;
  aggregateType: string;
  payload: P;
  tenantId?: string;
  correlationId?: string;
  causationId?: string;
  version?: number;
}

/**
 * Factory function to create domain events with consistent metadata
 */
export const createDomainEvent = <T extends string, P>(
  options: CreateDomainEventOptions<T, P>
): DomainEvent<T, P> => {
  return {
    eventId: randomUUID(),
    eventType: options.eventType,
    occurredAt: new Date().toISOString(),
    aggregateId: options.aggregateId,
    aggregateType: options.aggregateType,
    payload: options.payload,
    tenantId: options.tenantId,
    correlationId: options.correlationId,
    causationId: options.causationId,
    version: options.version ?? 1,
  };
};

/**
 * Type guard to check if an object is a valid domain event
 */
export const isDomainEvent = (obj: unknown): obj is DomainEvent => {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  const event = obj as Record<string, unknown>;
  return (
    typeof event.eventId === "string" &&
    typeof event.eventType === "string" &&
    typeof event.occurredAt === "string" &&
    typeof event.aggregateId === "string" &&
    typeof event.aggregateType === "string" &&
    typeof event.version === "number"
  );
};
