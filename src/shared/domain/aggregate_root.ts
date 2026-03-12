import type { DomainEvent } from "../events/domain-event.js";

/**
 * Base class for aggregates that need to record domain events.
 *
 * Aggregates are consistency boundaries in DDD - they ensure invariants
 * and emit events that represent state changes.
 */
export abstract class AggregateRoot {
  private domainEvents: DomainEvent[] = [];

  /**
   * Optimistic locking version.
   * Incremented by repository on each persistence operation.
   */
  protected version = 0;

  /**
   * Abstract getter for aggregate identity.
   * Subclasses must provide the aggregate's unique identifier.
   */
  abstract get id(): string;

  /**
   * Record a domain event to be published after persistence.
   *
   * Events are NOT published immediately - they are collected and published
   * by the repository after successful persistence (transactional outbox pattern).
   */
  protected record(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  /**
   * Pull all recorded domain events and clear the internal collection.
   *
   * This is called by the repository after successful persistence to
   * retrieve events for publishing.
   */
  pullDomainEvents(): DomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }

  /**
   * Get the current version for optimistic locking.
   * Used by repositories to enforce concurrency control.
   */
  getVersion(): number {
    return this.version;
  }
}
