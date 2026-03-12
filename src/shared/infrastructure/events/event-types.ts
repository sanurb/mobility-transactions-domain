import type { DomainEvent } from "../../../shared/events/domain-event.js";
import { createDomainEvent } from "../../../shared/events/domain-event.js";

/**
 * All domain event type discriminators
 * Add new event types here as system grows
 */
export const DOMAIN_EVENT_TYPES = {
  // Ride lifecycle events
  RIDE_CREATED: "RIDE_CREATED",
  RIDE_STATE_CHANGED: "RIDE_STATE_CHANGED",
  RIDE_COMPLETED: "RIDE_COMPLETED",
  RIDE_CANCELED: "RIDE_CANCELED",
  RIDE_EXPIRED: "RIDE_EXPIRED",

  // Payment events
  PAYMENT_INTENT_CREATED: "PAYMENT_INTENT_CREATED",
  SETTLEMENT_INITIATED: "SETTLEMENT_INITIATED",
  SETTLEMENT_COMPLETED: "SETTLEMENT_COMPLETED",

  // Driver events (for Phase 3)
  DRIVER_AVAILABILITY_CHANGED: "DRIVER_AVAILABILITY_CHANGED",
  DRIVER_LOCATION_UPDATED: "DRIVER_LOCATION_UPDATED",
  DRIVER_DISPATCHED: "DRIVER_DISPATCHED",

  // Fare events (for Phase 4)
  FARE_CALCULATED: "FARE_CALCULATED",
} as const;

export type DomainEventType =
  (typeof DOMAIN_EVENT_TYPES)[keyof typeof DOMAIN_EVENT_TYPES];

// ============================================
// Ride Events
// ============================================

export interface RideCreatedPayload {
  riderId: string;
  pickupLocation: { lat: number; lng: number };
  dropoffLocation: { lat: number; lng: number };
  requestedAt: string;
}

export type RideCreatedEvent = DomainEvent<
  typeof DOMAIN_EVENT_TYPES.RIDE_CREATED,
  RideCreatedPayload
>;

export const createRideCreatedEvent = (
  rideId: string,
  tenantId: string,
  payload: RideCreatedPayload,
  correlationId?: string
): RideCreatedEvent =>
  createDomainEvent({
    eventType: DOMAIN_EVENT_TYPES.RIDE_CREATED,
    aggregateId: rideId,
    aggregateType: "Ride",
    payload,
    tenantId,
    correlationId,
  });

export interface RideStateChangedPayload {
  previousState: string;
  newState: string;
  reason?: string;
  changedBy: string; // 'system' | 'rider' | 'driver'
}

export type RideStateChangedEvent = DomainEvent<
  typeof DOMAIN_EVENT_TYPES.RIDE_STATE_CHANGED,
  RideStateChangedPayload
>;

export const createRideStateChangedEvent = (
  rideId: string,
  tenantId: string,
  payload: RideStateChangedPayload,
  correlationId?: string
): RideStateChangedEvent =>
  createDomainEvent({
    eventType: DOMAIN_EVENT_TYPES.RIDE_STATE_CHANGED,
    aggregateId: rideId,
    aggregateType: "Ride",
    payload,
    tenantId,
    correlationId,
  });

// ============================================
// Payment Events
// ============================================

export interface PaymentIntentCreatedPayload {
  rideId: string;
  riderId: string;
  amountCOP: number;
  fareBreakdown: {
    baseFare: number;
    distanceComponent: number;
    timeComponent: number;
    minimumFareApplied: boolean;
  };
}

export type PaymentIntentCreatedEvent = DomainEvent<
  typeof DOMAIN_EVENT_TYPES.PAYMENT_INTENT_CREATED,
  PaymentIntentCreatedPayload
>;

export const createPaymentIntentCreatedEvent = (
  paymentIntentId: string,
  tenantId: string,
  payload: PaymentIntentCreatedPayload,
  correlationId?: string
): PaymentIntentCreatedEvent =>
  createDomainEvent({
    eventType: DOMAIN_EVENT_TYPES.PAYMENT_INTENT_CREATED,
    aggregateId: paymentIntentId,
    aggregateType: "PaymentIntent",
    payload,
    tenantId,
    correlationId,
  });

// ============================================
// Driver Events
// ============================================

export interface DriverAvailabilityChangedPayload {
  readonly driverId: string;
  readonly previousState: string;
  readonly newState: string;
  readonly timestamp: string;
}

export type DriverAvailabilityChangedEvent = DomainEvent<
  typeof DOMAIN_EVENT_TYPES.DRIVER_AVAILABILITY_CHANGED,
  DriverAvailabilityChangedPayload
>;

export const createDriverAvailabilityChangedEvent = (
  driverId: string,
  tenantId: string,
  payload: DriverAvailabilityChangedPayload,
  correlationId?: string
): DriverAvailabilityChangedEvent =>
  createDomainEvent({
    eventType: DOMAIN_EVENT_TYPES.DRIVER_AVAILABILITY_CHANGED,
    aggregateId: driverId,
    aggregateType: "Driver",
    payload,
    tenantId,
    correlationId,
  });

export interface DriverLocationUpdatedPayload {
  readonly driverId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
  readonly bearingDegrees: number;
  readonly speedMetersPerSecond: number;
  readonly recordedAt: string;
}

export type DriverLocationUpdatedEvent = DomainEvent<
  typeof DOMAIN_EVENT_TYPES.DRIVER_LOCATION_UPDATED,
  DriverLocationUpdatedPayload
>;

export const createDriverLocationUpdatedEvent = (
  driverId: string,
  tenantId: string,
  payload: DriverLocationUpdatedPayload,
  correlationId?: string
): DriverLocationUpdatedEvent =>
  createDomainEvent({
    eventType: DOMAIN_EVENT_TYPES.DRIVER_LOCATION_UPDATED,
    aggregateId: driverId,
    aggregateType: "Driver",
    payload,
    tenantId,
    correlationId,
  });

export interface DriverDispatchedPayload {
  readonly driverId: string;
  readonly rideId: string;
  readonly distanceMeters: number;
  readonly dispatchedAt: string;
}

export type DriverDispatchedEvent = DomainEvent<
  typeof DOMAIN_EVENT_TYPES.DRIVER_DISPATCHED,
  DriverDispatchedPayload
>;

export const createDriverDispatchedEvent = (
  driverId: string,
  tenantId: string,
  payload: DriverDispatchedPayload,
  correlationId?: string
): DriverDispatchedEvent =>
  createDomainEvent({
    eventType: DOMAIN_EVENT_TYPES.DRIVER_DISPATCHED,
    aggregateId: driverId,
    aggregateType: "Driver",
    payload,
    tenantId,
    correlationId,
  });

// ============================================
// Fare Events
// ============================================

export interface FareCalculatedPayload {
  readonly rideId: string;
  readonly totalFareCOP: number;
  readonly pricingVersion: string;
  readonly calculatedAt: string;
}

export type FareCalculatedEvent = DomainEvent<
  typeof DOMAIN_EVENT_TYPES.FARE_CALCULATED,
  FareCalculatedPayload
>;

export const createFareCalculatedEvent = (
  fareId: string,
  tenantId: string,
  payload: FareCalculatedPayload,
  correlationId?: string
): FareCalculatedEvent =>
  createDomainEvent({
    eventType: DOMAIN_EVENT_TYPES.FARE_CALCULATED,
    aggregateId: fareId,
    aggregateType: "FareCalculation",
    payload,
    tenantId,
    correlationId,
  });

// ============================================
// Union type for all events
// ============================================

export type AllDomainEvents =
  | RideCreatedEvent
  | RideStateChangedEvent
  | PaymentIntentCreatedEvent
  | DriverAvailabilityChangedEvent
  | DriverLocationUpdatedEvent
  | DriverDispatchedEvent
  | FareCalculatedEvent;
