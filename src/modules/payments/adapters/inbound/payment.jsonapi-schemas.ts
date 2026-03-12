/**
 * Payment JSON:API Schemas
 *
 * Zod validation schemas for JSON:API compliant payment endpoints.
 * Enforces strict JSON:API document structure with resource envelopes.
 *
 * SECURITY:
 * - No .default() values - require explicit client input
 * - No tenantId - PRD scope enforced via ownership/role/geo at boundary
 * - String length limits prevent DoS attacks
 * - Finite number constraints prevent NaN/Infinity attacks
 */

import { z } from "zod";

// ============================================
// JSON:API Base Schemas
// ============================================

/**
 * JSON:API resource object schema
 */
const jsonApiResourceSchema = z.object({
  type: z.string().min(1, "type is required").max(64),
  id: z.string().min(1, "id is required").max(128).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  relationships: z.record(z.string(), z.unknown()).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  links: z.record(z.string(), z.string()).optional(),
});

/**
 * JSON:API request envelope schema (single resource)
 */
const jsonApiRequestEnvelopeSchema = z.object({
  data: jsonApiResourceSchema,
});

// ============================================
// Request Schemas
// ============================================

/**
 * POST /api/payment-intents - Create payment intent
 */
export const createPaymentIntentRequestSchema =
  jsonApiRequestEnvelopeSchema.extend({
    data: z.object({
      type: z.literal("payment-intents"),
      attributes: z.object({
        rideId: z.string().min(1, "rideId is required").max(128),
        riderId: z.string().min(1, "riderId is required").max(128),
        amountCOP: z.number().int().positive().finite(),
        fareBreakdown: z.object({
          baseFare: z.number().int().nonnegative().finite(),
          distanceComponent: z.number().int().nonnegative().finite(),
          timeComponent: z.number().int().nonnegative().finite(),
          minimumFareApplied: z.boolean(),
        }),
        pricingVersion: z.string().min(1, "pricingVersion is required").max(32),
      }),
    }),
  });

export type CreatePaymentIntentRequest = z.infer<
  typeof createPaymentIntentRequestSchema
>;

/**
 * POST /api/settlement-actions - Initiate settlement
 */
export const initiateSettlementRequestSchema =
  jsonApiRequestEnvelopeSchema.extend({
    data: z.object({
      type: z.literal("settlement-actions"),
      attributes: z.object({
        rideId: z.string().min(1, "rideId is required").max(128),
        providerTokenRef: z
          .string()
          .min(1, "providerTokenRef is required")
          .max(256),
        idempotencyKey: z
          .string()
          .min(1, "idempotencyKey is required")
          .max(256),
        riderAcknowledgedDecline: z.boolean().optional(),
      }),
    }),
  });

export type InitiateSettlementRequest = z.infer<
  typeof initiateSettlementRequestSchema
>;

/**
 * GET /api/rides/:rideId/receipt - Get receipt params
 */
export const getReceiptParamsSchema = z.object({
  rideId: z.string().min(1, "rideId is required").max(128),
});

export type GetReceiptParams = z.infer<typeof getReceiptParamsSchema>;

/**
 * GET /api/rides/:rideId/payment-evidence - Get evidence params
 */
export const getPaymentEvidenceParamsSchema = z.object({
  rideId: z.string().min(1, "rideId is required").max(128),
});

export type GetPaymentEvidenceParams = z.infer<
  typeof getPaymentEvidenceParamsSchema
>;

/**
 * GET /api/rides/:rideId/payment-status - Get status params
 */
export const getPaymentStatusParamsSchema = z.object({
  rideId: z.string().min(1, "rideId is required").max(128),
});

export type GetPaymentStatusParams = z.infer<
  typeof getPaymentStatusParamsSchema
>;

// ============================================
// Response Schemas (for OpenAPI documentation)
// ============================================

/**
 * Payment intent resource response
 */
export const paymentIntentResourceSchema = z.object({
  type: z.literal("payment-intents"),
  id: z.string(),
  attributes: z.object({
    rideId: z.string(),
    riderId: z.string(),
    amountCOP: z.number(),
    currency: z.literal("COP"),
    createdAtUTC: z.string(),
    status: z.enum(["PAID", "UNPAID"]),
  }),
});

export type PaymentIntentResource = z.infer<typeof paymentIntentResourceSchema>;

/**
 * Settlement action resource response
 */
export const settlementActionResourceSchema = z.object({
  type: z.literal("settlement-actions"),
  id: z.string(),
  attributes: z.object({
    paymentIntentId: z.string(),
    rideId: z.string(),
    outcome: z.enum(["PENDING", "SUCCEEDED", "DECLINED", "FAILED", "UNKNOWN"]),
    attemptNumber: z.number(),
    reasonCode: z.string().nullable(),
    completedAtUTC: z.string().nullable(),
    isRetryable: z.boolean(),
  }),
});

export type SettlementActionResource = z.infer<
  typeof settlementActionResourceSchema
>;

/**
 * Payment receipt resource response
 */
export const paymentReceiptResourceSchema = z.object({
  type: z.literal("payment-receipts"),
  id: z.string(),
  attributes: z.object({
    rideId: z.string(),
    amountCOP: z.number(),
    currency: z.literal("COP"),
    fareBreakdown: z.object({
      baseFare: z.number(),
      distanceComponent: z.number(),
      timeComponent: z.number(),
      minimumFareApplied: z.boolean(),
    }),
    paymentStatus: z.enum(["PAID", "UNPAID"]),
    createdAt: z.string(),
  }),
});

export type PaymentReceiptResource = z.infer<
  typeof paymentReceiptResourceSchema
>;

/**
 * Payment evidence resource response (admin only)
 */
export const paymentEvidenceResourceSchema = z.object({
  type: z.literal("payment-evidence"),
  id: z.string(),
  attributes: z.object({
    paymentIntentId: z.string(),
    rideId: z.string(),
    riderId: z.string(),
    amountCOP: z.number(),
    paymentStatus: z.enum(["PAID", "UNPAID"]),
    attemptCount: z.number(),
    attempts: z.array(
      z.object({
        attemptNumber: z.number(),
        outcome: z.enum([
          "PENDING",
          "SUCCEEDED",
          "DECLINED",
          "FAILED",
          "UNKNOWN",
        ]),
        reasonCode: z.string().nullable(),
        initiatedAt: z.string(),
        completedAt: z.string().nullable(),
      })
    ),
    createdAt: z.string(),
  }),
});

export type PaymentEvidenceResource = z.infer<
  typeof paymentEvidenceResourceSchema
>;

/**
 * Payment status resource response
 */
export const paymentStatusResourceSchema = z.object({
  type: z.literal("payment-status"),
  id: z.string(),
  attributes: z.object({
    rideId: z.string(),
    status: z.enum(["PAID", "UNPAID"]),
    attemptCount: z.number(),
  }),
});

export type PaymentStatusResource = z.infer<typeof paymentStatusResourceSchema>;
