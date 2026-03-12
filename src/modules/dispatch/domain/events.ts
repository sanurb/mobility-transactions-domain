/**
 * Dispatch Domain Events
 *
 * Past-tense facts about dispatch operations within the dispatch bounded context.
 * These are internal domain events, NOT the external integration event contracts.
 *
 * DESIGN PRINCIPLES:
 * - Past tense (DispatchInitiated, not DispatchInitiate)
 * - Value objects only (no I/O, no side effects)
 * - String literal unions (no enums per project pattern)
 * - No TenantId (PRD: isolation via ownership/role/geo)
 */

import type { DomainEvent } from "../../../shared/events/domain-event.js";
import { createDomainEvent } from "../../../shared/events/domain-event.js";

/**
 * Dispatch domain event types
 */
export const DISPATCH_DOMAIN_EVENT_TYPES = {
  DISPATCH_INITIATED: "DISPATCH_INITIATED",
  DISPATCH_SUCCEEDED: "DISPATCH_SUCCEEDED",
  DISPATCH_FAILED: "DISPATCH_FAILED",
} as const;

export type DispatchDomainEventType =
  (typeof DISPATCH_DOMAIN_EVENT_TYPES)[keyof typeof DISPATCH_DOMAIN_EVENT_TYPES];

/**
 * Dispatch initiated event payload
 * Records the start of a dispatch attempt with search parameters
 */
export interface DispatchInitiatedPayload {
  readonly rideId: string;
  readonly searchRadiusMeters: number;
  readonly searchCenter: {
    readonly latitude: number;
    readonly longitude: number;
  };
  readonly initiatedAt: string;
}

/**
 * Dispatch succeeded event payload
 * Records successful driver assignment with evidence
 */
export interface DispatchSucceededPayload {
  readonly rideId: string;
  readonly driverId: string;
  readonly candidatesEvaluated: number;
  readonly selectionCriteria: string;
  readonly dispatchedAt: string;
}

/**
 * Dispatch failed event payload
 * Records dispatch failure with outcome classification
 */
export interface DispatchFailedPayload {
  readonly rideId: string;
  readonly outcome: "NO_ELIGIBLE" | "CONFLICT" | "FAILED";
  readonly failureCode: string;
  readonly reason: string | null;
  readonly candidatesEvaluated: number;
  readonly failedAt: string;
}

/**
 * Create a dispatch initiated event
 */
export const createDispatchInitiatedEvent = (params: {
  rideId: string;
  searchRadiusMeters: number;
  searchCenter: { latitude: number; longitude: number };
  initiatedAt: string;
  correlationId?: string;
}): DomainEvent<
  typeof DISPATCH_DOMAIN_EVENT_TYPES.DISPATCH_INITIATED,
  DispatchInitiatedPayload
> => {
  return createDomainEvent({
    eventType: DISPATCH_DOMAIN_EVENT_TYPES.DISPATCH_INITIATED,
    aggregateId: params.rideId,
    aggregateType: "Dispatch",
    correlationId: params.correlationId,
    payload: {
      rideId: params.rideId,
      searchRadiusMeters: params.searchRadiusMeters,
      searchCenter: params.searchCenter,
      initiatedAt: params.initiatedAt,
    },
  });
};

/**
 * Create a dispatch succeeded event
 */
export const createDispatchSucceededEvent = (params: {
  rideId: string;
  driverId: string;
  candidatesEvaluated: number;
  selectionCriteria: string;
  dispatchedAt: string;
  correlationId?: string;
}): DomainEvent<
  typeof DISPATCH_DOMAIN_EVENT_TYPES.DISPATCH_SUCCEEDED,
  DispatchSucceededPayload
> => {
  return createDomainEvent({
    eventType: DISPATCH_DOMAIN_EVENT_TYPES.DISPATCH_SUCCEEDED,
    aggregateId: params.rideId,
    aggregateType: "Dispatch",
    correlationId: params.correlationId,
    payload: {
      rideId: params.rideId,
      driverId: params.driverId,
      candidatesEvaluated: params.candidatesEvaluated,
      selectionCriteria: params.selectionCriteria,
      dispatchedAt: params.dispatchedAt,
    },
  });
};

/**
 * Create a dispatch failed event
 */
export const createDispatchFailedEvent = (params: {
  rideId: string;
  outcome: "NO_ELIGIBLE" | "CONFLICT" | "FAILED";
  failureCode: string;
  reason?: string;
  candidatesEvaluated: number;
  failedAt: string;
  correlationId?: string;
}): DomainEvent<
  typeof DISPATCH_DOMAIN_EVENT_TYPES.DISPATCH_FAILED,
  DispatchFailedPayload
> => {
  return createDomainEvent({
    eventType: DISPATCH_DOMAIN_EVENT_TYPES.DISPATCH_FAILED,
    aggregateId: params.rideId,
    aggregateType: "Dispatch",
    correlationId: params.correlationId,
    payload: {
      rideId: params.rideId,
      outcome: params.outcome,
      failureCode: params.failureCode,
      reason: params.reason ?? null,
      candidatesEvaluated: params.candidatesEvaluated,
      failedAt: params.failedAt,
    },
  });
};
