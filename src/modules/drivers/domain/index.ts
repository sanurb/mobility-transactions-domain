/**
 * Drivers Domain - Public API
 *
 * Exports only the stable domain surface.
 * Internal implementation details are not exported.
 */

// Dispatch Policy
export {
  type DispatchCandidate,
  type DispatchPolicy,
  type DispatchSelection,
  NearestFirstDispatchPolicy,
} from "./dispatch-policy.js";
// Aggregate Root
export { Driver, type DriverProps } from "./driver.aggregate.js";
// State Machine
export {
  canTransition,
  DRIVER_STATES,
  DRIVER_TRANSITIONS,
  type DriverState,
  isDriverAvailable,
} from "./driver-states.js";
// Events
export {
  createDriverAvailabilityChangedEvent,
  createDriverDispatchedEvent,
  createDriverLocationUpdatedEvent,
  type DriverAvailabilityChangedEvent,
  type DriverAvailabilityChangedPayload,
  type DriverDispatchedEvent,
  type DriverDispatchedPayload,
  type DriverDomainEvent,
  type DriverLocationUpdatedEvent,
  type DriverLocationUpdatedPayload,
} from "./events.js";
// Location Rules
export {
  filterFreshLocationUpdates,
  isLocationFresh,
  LOCATION_FRESHNESS_THRESHOLD_MS,
} from "./location-rules.js";

// Ports
export type {
  Clock,
  DriverRepositoryPort,
  EligibleDriver,
  GeoSpatialIndexPort,
} from "./ports/index.js";
// Value Objects
export {
  Distance,
  DRIVER_ID_MAX_LENGTH,
  DriverId,
  Location,
  LocationUpdate,
  MAX_LOCATION_ACCURACY_METERS,
  MAX_SPEED_MPS,
  TENANT_ID_MAX_LENGTH,
  TenantId,
} from "./value-objects/index.js";
