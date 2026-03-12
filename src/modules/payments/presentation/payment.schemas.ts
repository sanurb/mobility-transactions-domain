/**
 * Payment API Schemas (Legacy)
 *
 * DEPRECATED: This file is retained for backward compatibility only.
 * All new code should import from ../adapters/inbound/payment.jsonapi-schemas.ts
 *
 * Re-exports schemas from the JSON:API adapter to maintain existing imports
 * while avoiding schema duplication. This file will be removed once all
 * consumers are updated to use the JSON:API schemas directly.
 */

// Re-export params schemas (these remain the same for path params)
export {
  type GetPaymentEvidenceParams,
  type GetPaymentStatusParams,
  type GetReceiptParams,
  getPaymentEvidenceParamsSchema,
  getPaymentStatusParamsSchema,
  getReceiptParamsSchema,
} from "../adapters/inbound/payment.jsonapi-schemas.js";

// Note: Request/response schemas from this file are no longer exported.
// The JSON:API adapter uses different schemas for requests (JSON:API envelopes)
// and responses (JSON:API resource documents).
// Existing code using these schemas should be updated to use the JSON:API adapter.
