/**
 * Ride Domain Events
 *
 * Past-tense events representing state changes within the Ride aggregate.
 * These are domain-level facts, not integration events.
 *
 * Following the pattern from Payments context (07-08):
 * - Use shared DomainEvent interface
 * - Factory functions with metadata support
 * - Empty tenantId per PRD (no global tenant semantics)
 */

import type { DomainEvent } from "../../../shared/events/domain-event.js";
import { createDomainEvent } from "../../../shared/events/domain-event.js";
import type {
  DriverId,
  MarketId,
  RideId,
  RiderId,
} from "../../../shared/types/ids/index.js";
import type { ChangedByRole } from "./ride-states.js";

/**
 * Event payload for RideCreated
 */
export interface RideCreatedPayload {
  readonly rideId: RideId;
  readonly riderId: RiderId;
  readonly pickup: {
    readonly lat: number;
    readonly lng: number;
  };
  readonly dropoff: {
    readonly lat: number;
    readonly lng: number;
  };
  readonly requestedAtUTC: string;
  readonly marketId?: MarketId;
}

/**
 * Event payload for RideStateChanged
 */
export interface RideStateChangedPayload {
  readonly rideId: RideId;
  readonly previousState: string;
  readonly newState: string;
  readonly changedBy: string;
  readonly changedByRole: ChangedByRole;
  readonly reason?: string;
  readonly driverId?: DriverId;
}

/**
 * RideCreated domain event
 */
export type RideCreatedEvent = DomainEvent<"RideCreated", RideCreatedPayload>;

/**
 * RideStateChanged domain event
 */
export type RideStateChangedEvent = DomainEvent<
  "RideStateChanged",
  RideStateChangedPayload
>;

/**
 * Union type of all ride domain events
 */
export type RideDomainEvent = RideCreatedEvent | RideStateChangedEvent;

/**
 * Factory: Create RideCreated event
 */
export const createRideCreatedEvent = (
  aggregateId: RideId,
  payload: RideCreatedPayload,
  metadata?: { correlationId?: string; causationId?: string }
): RideCreatedEvent => {
  return createDomainEvent({
    eventType: "RideCreated",
    aggregateId,
    aggregateType: "Ride",
    payload,
    tenantId: "", // No tenantId per PRD
    correlationId: metadata?.correlationId,
    causationId: metadata?.causationId,
    version: 1,
  });
};

/**
 * Factory: Create RideStateChanged event
 */
export const createRideStateChangedEvent = (
  aggregateId: RideId,
  payload: RideStateChangedPayload,
  metadata?: { correlationId?: string; causationId?: string }
): RideStateChangedEvent => {
  return createDomainEvent({
    eventType: "RideStateChanged",
    aggregateId,
    aggregateType: "Ride",
    payload,
    tenantId: "", // No tenantId per PRD
    correlationId: metadata?.correlationId,
    causationId: metadata?.causationId,
    version: 1,
  });
};
