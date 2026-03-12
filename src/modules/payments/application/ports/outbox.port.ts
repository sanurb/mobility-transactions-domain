import type { PaymentsTx } from "./unit-of-work.port.js";

/**
 * Outbox Envelope
 *
 * Publish-ready envelope for integration events.
 * Domain events are internal facts; outbox is for external publishing.
 * Application boundary translates domain events to outbox envelopes.
 *
 * CRITICAL: This is NOT a raw domain event.
 * Outbox stores publish-ready envelopes with explicit metadata for:
 * - Reliable publish
 * - Replay capability
 * - Diagnostics at scale
 */
export interface OutboxEnvelope {
  /** Unique envelope identifier (UUID) */
  readonly id: string;
  /** Event name (e.g., 'PaymentIntentCreated', 'SettlementSucceeded') */
  readonly eventName: string;
  /** Schema version for event evolution */
  readonly schemaVersion: string;
  /** Aggregate type (e.g., 'PaymentIntent') */
  readonly aggregateType: string;
  /** Aggregate ID */
  readonly aggregateId: string;
  /** Correlation ID for tracing */
  readonly correlationId: string;
  /** Causation ID (event/command that caused this) */
  readonly causationId: string | null;
  /** When event occurred (ISO 8601) */
  readonly occurredAtUTC: string;
  /** Event payload (JSON-safe) */
  readonly payload: unknown;
}

/**
 * Outbox Record
 *
 * Outbox envelope with storage metadata.
 * Includes publish tracking fields for reliable delivery.
 */
export interface OutboxRecord extends OutboxEnvelope {
  /** When record was created in outbox */
  readonly createdAtUTC: string;
  /** When record was successfully published (null if unpublished) */
  readonly publishedAtUTC: string | null;
  /** Number of publish attempts */
  readonly publishAttempts: number;
  /** Last publish error (null if no errors) */
  readonly lastError: string | null;
}

/**
 * Outbox Port
 *
 * Port for storing and publishing integration events via transactional outbox pattern.
 * Ensures events are persisted atomically with aggregate changes.
 *
 * DESIGN PRINCIPLES:
 * - Outbox stores ENVELOPES (not raw domain events)
 * - Application boundary translates domain events → envelopes
 * - Payload serialization is standardized (JSON)
 * - All enqueue operations require explicit transaction passing
 * - No Result types here (infrastructure failures throw)
 */
export interface OutboxPort {
  /**
   * Enqueue outbox envelopes within a transaction.
   * MUST be called in same transaction as aggregate persistence.
   *
   * @param envelopes - Envelopes to enqueue
   * @param tx - Transaction to use
   * @throws InfrastructureError if enqueue fails
   */
  enqueue(envelopes: readonly OutboxEnvelope[], tx: PaymentsTx): Promise<void>;

  /**
   * Fetch unpublished outbox records for publishing.
   * Returns records in creation order (FIFO).
   *
   * @param limit - Maximum records to fetch
   * @returns Unpublished records
   * @throws InfrastructureError if fetch fails
   */
  fetchUnpublished(limit: number): Promise<readonly OutboxRecord[]>;

  /**
   * Mark outbox records as successfully published.
   *
   * @param ids - Outbox record IDs
   * @param publishedAtUTC - Publish timestamp (ISO 8601)
   * @throws InfrastructureError if update fails
   */
  markPublished(ids: readonly string[], publishedAtUTC: string): Promise<void>;

  /**
   * Mark outbox record as failed to publish.
   * Increments publish attempts and records error.
   *
   * @param id - Outbox record ID
   * @param error - Error message
   * @param failedAtUTC - Failure timestamp (ISO 8601)
   * @throws InfrastructureError if update fails
   */
  markFailed(id: string, error: string, failedAtUTC: string): Promise<void>;
}
