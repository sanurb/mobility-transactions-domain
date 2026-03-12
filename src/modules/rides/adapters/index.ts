/**
 * Barrel export for Rides adapters
 */

// Inbound (HTTP)
export * from "./inbound/index.js";

// Outbound (persistence)
export { RideRepositoryImpl } from "./outbound/ride.repository.js";
