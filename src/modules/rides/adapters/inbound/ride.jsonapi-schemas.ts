/**
 * JSON:API Zod Schemas for Rides
 *
 * Validates incoming JSON:API requests for ride resources.
 * Enforces PRD requirements:
 * - No TenantId
 * - Coordinate bounds
 * - String length limits
 * - State enum validation
 */

import { z } from "zod";
import { RIDE_STATES } from "../../domain/ride-states.js";

/**
 * Coordinate validation: finite, reasonable bounds for Earth
 */
const coordinateSchema = z.number().finite().min(-90).max(90);

const longitudeSchema = z.number().finite().min(-180).max(180);

/**
 * Location schema
 */
const locationSchema = z.object({
  lat: coordinateSchema,
  lng: longitudeSchema,
});

/**
 * Ride state enum
 */
const rideStateSchema = z.enum([
  RIDE_STATES.CREATED,
  RIDE_STATES.DISPATCHING,
  RIDE_STATES.ASSIGNED,
  RIDE_STATES.STARTED,
  RIDE_STATES.COMPLETED,
  RIDE_STATES.CANCELED,
  RIDE_STATES.EXPIRED,
  RIDE_STATES.FAILED,
]);

/**
 * Schema for POST /api/rides
 *
 * JSON:API request body:
 * {
 *   "data": {
 *     "type": "rides",
 *     "attributes": {
 *       "riderId": "...",
 *       "pickup": { "lat": ..., "lng": ... },
 *       "dropoff": { "lat": ..., "lng": ... },
 *       "marketId": "..." (optional)
 *     }
 *   }
 * }
 */
export const CreateRideRequestSchema = z.object({
  data: z.object({
    type: z.literal("rides"),
    attributes: z.object({
      riderId: z.string().min(1).max(128),
      pickup: locationSchema,
      dropoff: locationSchema,
      marketId: z.string().min(1).max(128).optional(),
    }),
  }),
});

export type CreateRideRequest = z.infer<typeof CreateRideRequestSchema>;

/**
 * Schema for POST /api/rides/:id/transitions
 *
 * JSON:API request body:
 * {
 *   "data": {
 *     "type": "ride-transitions",
 *     "attributes": {
 *       "toState": "DISPATCHING",
 *       "reason": "Driver accepted" (optional)
 *     }
 *   }
 * }
 */
export const TransitionRideRequestSchema = z.object({
  data: z.object({
    type: z.literal("ride-transitions"),
    attributes: z.object({
      toState: rideStateSchema,
      reason: z.string().max(500).optional(),
      driverId: z.string().min(1).max(128).optional(),
    }),
  }),
});

export type TransitionRideRequest = z.infer<typeof TransitionRideRequestSchema>;

/**
 * Route param validation
 */
export const RideIdParamSchema = z.object({
  id: z.string().min(1).max(128),
});

export type RideIdParam = z.infer<typeof RideIdParamSchema>;

/**
 * Get ride query params (optional includeTransitions)
 */
export const GetRideQuerySchema = z.object({
  includeTransitions: z.coerce.boolean().optional(),
});

export type GetRideQuery = z.infer<typeof GetRideQuerySchema>;

/**
 * List rides query params
 */
export const ListRidesQuerySchema = z.object({
  "filter[state]": rideStateSchema.optional(),
  "page[limit]": z.coerce.number().int().positive().max(100).optional(),
  "page[offset]": z.coerce.number().int().nonnegative().optional(),
});

export type ListRidesQuery = z.infer<typeof ListRidesQuerySchema>;
