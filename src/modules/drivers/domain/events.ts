/**
 * Driver Domain Events
 *
 * Past-tense events representing state changes within the Driver aggregate.
 * These are domain-level facts, not integration events.
 *
 * Following the pattern from Rides and Payments contexts:
 * - Use shared DomainEvent interface
 * - Factory functions with metadata support
 * - Empty tenantId per PRD (no global tenant semantics)
 * - Time passed as parameter (no new Date() in domain)
 */

import type { DomainEvent } from "../../../shared/events/domain-event.js";
import { createDomainEvent } from "../../../shared/events/domain-event.js";
import type { DriverState } from "./driver-states.js";

/**
 * Event payload for DriverAvailabilityChanged
 */
export interface DriverAvailabilityChangedPayload {
  readonly driverId: string;
  readonly previousState: DriverState;
  readonly newState: DriverState;
  readonly occurredAtUTC: string;
}

/**
 * Event payload for DriverLocationUpdated
 */
export interface DriverLocationUpdatedPayload {
  readonly driverId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
  readonly bearingDegrees: number;
  readonly speedMetersPerSecond: number;
  readonly recordedAt: string;
  readonly occurredAtUTC: string;
}

/**
 * Event payload for DriverDispatched
 */
export interface DriverDispatchedPayload {
  readonly driverId: string;
  readonly rideId: string;
  readonly distanceMeters: number;
  readonly dispatchedAtUTC: string;
}

/**
 * DriverAvailabilityChanged domain event
 */
export type DriverAvailabilityChangedEvent = DomainEvent<
  "DriverAvailabilityChanged",
  DriverAvailabilityChangedPayload
>;

/**
 * DriverLocationUpdated domain event
 */
export type DriverLocationUpdatedEvent = DomainEvent<
  "DriverLocationUpdated",
  DriverLocationUpdatedPayload
>;

/**
 * DriverDispatched domain event
 */
export type DriverDispatchedEvent = DomainEvent<
  "DriverDispatched",
  DriverDispatchedPayload
>;

/**
 * Union type of all driver domain events
 */
export type DriverDomainEvent =
  | DriverAvailabilityChangedEvent
  | DriverLocationUpdatedEvent
  | DriverDispatchedEvent;

/**
 * Factory: Create DriverAvailabilityChanged event
 */
export const createDriverAvailabilityChangedEvent = (params: {
  driverId: string;
  tenantId?: string;
  previousState: DriverState;
  newState: DriverState;
  occurredAtUTC: string;
  correlationId?: string;
  causationId?: string;
}): DriverAvailabilityChangedEvent => {
  return createDomainEvent({
    eventType: "DriverAvailabilityChanged",
    aggregateId: params.driverId,
    aggregateType: "Driver",
    payload: {
      driverId: params.driverId,
      previousState: params.previousState,
      newState: params.newState,
      occurredAtUTC: params.occurredAtUTC,
    },
    tenantId: params.tenantId,
    correlationId: params.correlationId,
    causationId: params.causationId,
    version: 1,
  });
};

/**
 * Factory: Create DriverLocationUpdated event
 */
export const createDriverLocationUpdatedEvent = (params: {
  driverId: string;
  tenantId?: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  bearingDegrees: number;
  speedMetersPerSecond: number;
  recordedAt: Date;
  occurredAtUTC: string;
  correlationId?: string;
  causationId?: string;
}): DriverLocationUpdatedEvent => {
  return createDomainEvent({
    eventType: "DriverLocationUpdated",
    aggregateId: params.driverId,
    aggregateType: "Driver",
    payload: {
      driverId: params.driverId,
      latitude: params.latitude,
      longitude: params.longitude,
      accuracyMeters: params.accuracyMeters,
      bearingDegrees: params.bearingDegrees,
      speedMetersPerSecond: params.speedMetersPerSecond,
      recordedAt: params.recordedAt.toISOString(),
      occurredAtUTC: params.occurredAtUTC,
    },
    tenantId: params.tenantId,
    correlationId: params.correlationId,
    causationId: params.causationId,
    version: 1,
  });
};

/**
 * Factory: Create DriverDispatched event
 */
export const createDriverDispatchedEvent = (params: {
  driverId: string;
  rideId: string;
  tenantId?: string;
  distanceMeters: number;
  dispatchedAtUTC: string;
  correlationId?: string;
  causationId?: string;
}): DriverDispatchedEvent => {
  return createDomainEvent({
    eventType: "DriverDispatched",
    aggregateId: params.driverId,
    aggregateType: "Driver",
    payload: {
      driverId: params.driverId,
      rideId: params.rideId,
      distanceMeters: params.distanceMeters,
      dispatchedAtUTC: params.dispatchedAtUTC,
    },
    tenantId: params.tenantId,
    correlationId: params.correlationId,
    causationId: params.causationId,
    version: 1,
  });
};
