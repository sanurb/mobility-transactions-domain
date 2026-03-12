/**
 * Barrel export for all branded entity ID types.
 *
 * These types prevent cross-ID assignment at compile time and provide
 * a consistent validation API across all entity identifiers.
 */

// DriverId
export type { DriverId } from "./driver-id.js";
export { createDriverId, unsafeDriverId } from "./driver-id.js";
// FareId
export type { FareId } from "./fare-id.js";
export { createFareId, unsafeFareId } from "./fare-id.js";
// MarketId
export type { MarketId } from "./market-id.js";
export { createMarketId, unsafeMarketId } from "./market-id.js";
// PaymentIntentId
export type { PaymentIntentId } from "./payment-intent-id.js";
export {
  createPaymentIntentId,
  unsafePaymentIntentId,
} from "./payment-intent-id.js";
// RideId
export type { RideId } from "./ride-id.js";
export { createRideId, unsafeRideId } from "./ride-id.js";
// RiderId
export type { RiderId } from "./rider-id.js";
export { createRiderId, unsafeRiderId } from "./rider-id.js";
