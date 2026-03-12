import type { DomainEvent } from "../../../../shared/events/domain-event.js";

/**
 * EventBusPort — application-layer abstraction for event publishing.
 * Drivers application layer publishes domain events after successful persistence.
 * The infrastructure IEventBus satisfies this interface structurally.
 */
export interface EventBusPort {
  publish<E extends DomainEvent>(event: E): Promise<void>;
}
