import consola from "consola";
import type { DomainEvent } from "../../../shared/events/domain-event.js";
import type { DomainEventType } from "./event-types.js";

/**
 * Event handler function signature
 */
export type EventHandler<E extends DomainEvent = DomainEvent> = (
  event: E
) => void | Promise<void>;

/**
 * Event bus interface - defines the contract for publishing and subscribing
 * Enables swapping implementations (in-process, Kafka, RabbitMQ, etc.)
 */
export interface IEventBus {
  /**
   * Publish an event to all subscribers
   * In-process: synchronous delivery
   * External: async delivery with at-least-once semantics
   */
  publish<E extends DomainEvent>(event: E): Promise<void>;

  /**
   * Subscribe to events of a specific type
   * Returns unsubscribe function
   */
  subscribe<E extends DomainEvent>(
    eventType: E["eventType"],
    handler: EventHandler<E>
  ): () => void;

  /**
   * Subscribe to all events (useful for logging, audit)
   * Returns unsubscribe function
   */
  subscribeAll(handler: EventHandler): () => void;

  /**
   * Clear all subscriptions (useful for testing)
   */
  clear(): void;
}

/**
 * In-process event bus implementation
 * Suitable for v1 - can be swapped to external broker later
 *
 * Characteristics:
 * - Synchronous delivery (handlers run in sequence)
 * - No persistence (events lost on restart)
 * - No retry logic (handlers must handle their own errors)
 * - Perfect for domain event propagation within a transaction
 */
export class InProcessEventBus implements IEventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private globalHandlers: Set<EventHandler> = new Set();

  async publish<E extends DomainEvent>(event: E): Promise<void> {
    consola.debug(`[EventBus] Publishing event: ${event.eventType}`, {
      eventId: event.eventId,
      aggregateId: event.aggregateId,
    });

    // Notify type-specific handlers
    const typeHandlers = this.handlers.get(event.eventType);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        try {
          await handler(event);
        } catch (error) {
          // Log but don't fail - handlers are responsible for their own error handling
          consola.error(
            `[EventBus] Handler error for ${event.eventType}:`,
            error
          );
        }
      }
    }

    // Notify global handlers
    for (const handler of this.globalHandlers) {
      try {
        await handler(event);
      } catch (error) {
        consola.error(
          `[EventBus] Global handler error for ${event.eventType}:`,
          error
        );
      }
    }
  }

  subscribe<E extends DomainEvent>(
    eventType: E["eventType"],
    handler: EventHandler<E>
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    const handlers = this.handlers.get(eventType);
    handlers?.add(handler as EventHandler);

    consola.debug(`[EventBus] Subscribed to: ${eventType}`);

    // Return unsubscribe function
    return () => {
      handlers?.delete(handler as EventHandler);
      consola.debug(`[EventBus] Unsubscribed from: ${eventType}`);
    };
  }

  subscribeAll(handler: EventHandler): () => void {
    this.globalHandlers.add(handler);

    consola.debug("[EventBus] Subscribed to all events");

    return () => {
      this.globalHandlers.delete(handler);
      consola.debug("[EventBus] Unsubscribed from all events");
    };
  }

  clear(): void {
    this.handlers.clear();
    this.globalHandlers.clear();
    consola.debug("[EventBus] Cleared all subscriptions");
  }

  /**
   * Get count of handlers for a specific event type (useful for testing)
   */
  getHandlerCount(eventType: DomainEventType): number {
    return this.handlers.get(eventType)?.size ?? 0;
  }

  /**
   * Get total subscription count (useful for testing)
   */
  getTotalHandlerCount(): number {
    let count = this.globalHandlers.size;
    for (const handlers of this.handlers.values()) {
      count += handlers.size;
    }
    return count;
  }
}

/**
 * Factory function to create event bus instance
 * Allows for future DI container integration
 */
export const createEventBus = (): IEventBus => {
  return new InProcessEventBus();
};

// Singleton instance for application-wide use
let eventBusInstance: IEventBus | null = null;

/**
 * Get the singleton event bus instance
 * Creates one if it doesn't exist
 */
export const getEventBus = (): IEventBus => {
  if (!eventBusInstance) {
    eventBusInstance = createEventBus();
  }
  return eventBusInstance;
};

/**
 * Reset the singleton instance (useful for testing)
 */
export const resetEventBus = (): void => {
  eventBusInstance?.clear();
  eventBusInstance = null;
};
