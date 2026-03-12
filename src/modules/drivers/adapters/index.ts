/**
 * Driver Adapters
 *
 * Re-exports all adapters (inbound and outbound) for driver module.
 */

export type { DriverRoutesDependencies } from "./inbound/index.js";
export { createDriverRoutes } from "./inbound/index.js";

// Outbound re-exports used by module init
export {
  createDriverRepository,
  createGeoSpatialIndex,
  createSystemClock,
  initDriverModels,
} from "./outbound/index.js";
