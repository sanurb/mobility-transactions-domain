/**
 * Rides domain exports
 *
 * Pure domain layer: aggregates, events, state machine rules
 */

// Domain Events
export type {
  RideCreatedEvent,
  RideCreatedPayload,
  RideDomainEvent,
  RideStateChangedEvent,
  RideStateChangedPayload,
} from "./events.js";
export {
  createRideCreatedEvent,
  createRideStateChangedEvent,
} from "./events.js";
export type {
  CreateRideProps,
  ReconstitutedRideProps,
  TransitionParams,
} from "./ride.aggregate.js";
// Aggregate Root
export { Ride } from "./ride.aggregate.js";
export type { RideState } from "./ride-states.js";
// State Machine
export {
  addSecondsToIsoUtc,
  canTransition,
  EXPIRATION_POLICIES,
  expirationPolicySeconds,
  getValidNextStates,
  isAfter,
  isTerminalState,
  RIDE_STATES,
  RIDE_TRANSITIONS,
} from "./ride-states.js";
