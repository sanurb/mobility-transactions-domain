/**
 * Driver Inbound Adapters (HTTP/API Layer)
 *
 * Re-exports JSON:API routes and schemas for external consumption.
 */

export type { DriverRoutesDependencies } from "./driver.jsonapi-routes.js";
export { createDriverRoutes } from "./driver.jsonapi-routes.js";
export {
  type DriverIdParam,
  DriverIdParamSchema,
  type RegisterDriverRequest,
  RegisterDriverSchema,
  type UpdateAvailabilityRequest,
  UpdateAvailabilitySchema,
  type UpdateLocationRequest,
  UpdateLocationSchema,
} from "./driver.jsonapi-schemas.js";
