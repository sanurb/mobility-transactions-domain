/**
 * Payment Presentation Layer (Legacy - DEPRECATED)
 *
 * DEPRECATED: The Payments HTTP surface has been migrated to JSON:API adapter.
 * This module is retained for backward compatibility only.
 *
 * New location: ../adapters/inbound/
 *
 * @deprecated Use ../adapters/inbound instead
 */

export { createPaymentRoutes } from "./payment.routes.js";
export * from "./payment.schemas.js";
