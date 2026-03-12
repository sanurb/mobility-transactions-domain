/**
 * Zod schemas for dispatch JSON:API request/response validation
 *
 * All request inputs are validated at the API boundary using these schemas.
 * Enforces JSON:API media type and required headers.
 */

import { z } from "zod";

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * POST /api/dispatch/requests - Create a dispatch request (dispatch a ride)
 *
 * JSON:API type: "dispatch-requests"
 * Attributes: { rideId, correlationId? }
 */
export const DispatchRequestSchema = z.object({
  rideId: z.string().min(1).max(128),
  correlationId: z.string().min(1).max(256).optional(),
  pickupLocation: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  searchRadiusMeters: z.number().positive().finite().optional(),
});

export type DispatchRequestAttributes = z.infer<typeof DispatchRequestSchema>;

/**
 * Full JSON:API document for dispatch request
 */
export const DispatchRequestDocumentSchema = z.object({
  data: z.object({
    type: z.literal("dispatch-requests"),
    attributes: DispatchRequestSchema,
  }),
});

export type DispatchRequestDocument = z.infer<
  typeof DispatchRequestDocumentSchema
>;

// ============================================================================
// Header Validation
// ============================================================================

/**
 * Validate required Idempotency-Key header
 */
export const validateIdempotencyKeyHeader = (
  idempotencyKey: string | undefined
): { valid: true; key: string } | { valid: false; error: string } => {
  if (!idempotencyKey) {
    return {
      valid: false,
      error: "Idempotency-Key header is required for dispatch requests",
    };
  }

  const trimmed = idempotencyKey.trim();
  if (trimmed.length === 0) {
    return {
      valid: false,
      error: "Idempotency-Key header must not be empty",
    };
  }

  if (trimmed.length > 256) {
    return {
      valid: false,
      error: "Idempotency-Key header must not exceed 256 characters",
    };
  }

  return { valid: true, key: trimmed };
};
