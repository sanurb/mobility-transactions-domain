import type { DomainEvent } from "../../../../shared/events/domain-event.js";

/**
 * EventPublisherPort — application-layer abstraction for event publishing.
 * The infrastructure IEventBus satisfies this interface structurally.
 */
export interface EventPublisherPort {
  publish<E extends DomainEvent>(event: E): Promise<void>;
}
