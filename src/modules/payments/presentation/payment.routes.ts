/**
 * Payment Routes (Legacy - DEPRECATED)
 *
 * DEPRECATED: This file is retained for reference only.
 * The Payments HTTP surface has been migrated to JSON:API adapter.
 *
 * New location: ../adapters/inbound/payment.jsonapi-routes.ts
 *
 * This file no longer exports routes and will be removed in a future phase.
 * All consumers should use the JSON:API adapter directly.
 */

/**
 * Placeholder export to satisfy existing imports during migration.
 * This function is no longer called - the JSON:API adapter is used instead.
 * @deprecated Use createPaymentJsonApiRoutes from ../adapters/inbound
 */
export const createPaymentRoutes = () => {
  throw new Error(
    "createPaymentRoutes is deprecated. Use createPaymentJsonApiRoutes from ../adapters/inbound instead."
  );
};
