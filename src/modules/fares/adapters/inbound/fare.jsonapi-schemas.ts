/**
 * Fare JSON:API Zod Schemas
 *
 * Validates inputs at HTTP boundary.
 * Enforces finite numbers, length bounds, and format constraints.
 */

import { z } from "zod";

/**
 * Schema for calculating a fare (POST /api/fares)
 */
export const CalculateFareRequestSchema = z.object({
  data: z.object({
    type: z.literal("fares"),
    attributes: z.object({
      rideId: z.string().trim().min(1).max(128),
      baseFareCOP: z.number().int().nonnegative().finite(),
      distanceKm: z.number().nonnegative().finite(),
      durationMinutes: z.number().nonnegative().finite(),
      minimumFareCOP: z.number().int().nonnegative().finite(),
      pricingVersion: z
        .string()
        .trim()
        .regex(
          /^v\d+\.\d+\.\d+$/,
          "Must be semantic version format (e.g., v1.0.0)"
        ),
    }),
  }),
});

export type CalculateFareRequest = z.infer<typeof CalculateFareRequestSchema>;

/**
 * Schema for getting a fare by ride ID (GET /api/fares/by-ride/:rideId)
 */
export const GetFareByRideParamsSchema = z.object({
  rideId: z.string().trim().min(1).max(128),
});

export type GetFareByRideParams = z.infer<typeof GetFareByRideParamsSchema>;
