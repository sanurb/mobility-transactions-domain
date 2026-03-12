/**
 * Dispatch Inbound Adapters
 *
 * HTTP adapters for dispatch operations (JSON:API)
 */

export { createDispatchJsonApiRoutes } from "./dispatch.jsonapi-routes.js";
export type {
  DispatchRequestAttributes,
  DispatchRequestDocument,
} from "./dispatch.jsonapi-schemas.js";
export {
  DispatchRequestDocumentSchema,
  DispatchRequestSchema,
  validateIdempotencyKeyHeader,
} from "./dispatch.jsonapi-schemas.js";
