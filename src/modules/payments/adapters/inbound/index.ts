/**
 * Payments Inbound Adapter
 *
 * Exports JSON:API HTTP adapter for Payments bounded context.
 * This is the ONLY active Payments HTTP surface.
 */

export * from "../../../../shared/infrastructure/http/jsonapi/index.js";
export { createPaymentJsonApiRoutes } from "./payment.jsonapi-routes.js";
export * from "./payment.jsonapi-schemas.js";
