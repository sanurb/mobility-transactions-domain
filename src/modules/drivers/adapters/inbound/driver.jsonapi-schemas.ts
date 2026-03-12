/**
 * JSON:API Zod Schemas for Drivers
 *
 * Validates incoming JSON:API requests for driver resources.
 * Enforces PRD requirements:
 * - No TenantId
 * - Coordinate bounds (finite, latitude/longitude ranges)
 * - Accuracy bounds (non-negative)
 * - String length limits
 * - Driver state enum validation
 */

import { z } from "zod";
import { DRIVER_STATES } from "../../domain/driver-states.js";

/**
 * Coordinate validation: finite, reasonable bounds for Earth
 */
const latitudeSchema = z.number().finite().min(-90).max(90);

const longitudeSchema = z.number().finite().min(-180).max(180);

/**
 * Accuracy validation: non-negative meters
 */
const accuracySchema = z.number().finite().nonnegative();

/**
 * Bearing validation: 0-359 degrees
 */
const bearingSchema = z.number().finite().min(0).max(359);

/**
 * Speed validation: non-negative meters per second
 */
const speedSchema = z.number().finite().nonnegative();

/**
 * Driver state enum
 */
const driverStateSchema = z.enum([
  DRIVER_STATES.AVAILABLE,
  DRIVER_STATES.BUSY,
  DRIVER_STATES.OFFLINE,
]);

/**
 * Schema for POST /api/drivers
 *
 * JSON:API request body:
 * {
 *   "data": {
 *     "type": "drivers",
 *     "attributes": {
 *       "driverId": "..."
 *     }
 *   }
 * }
 */
export const RegisterDriverSchema = z.object({
  data: z.object({
    type: z.literal("drivers"),
    attributes: z.object({
      driverId: z.string().min(1).max(128),
    }),
  }),
});

export type RegisterDriverRequest = z.infer<typeof RegisterDriverSchema>;

/**
 * Schema for PATCH /api/drivers/:id/availability
 *
 * JSON:API request body:
 * {
 *   "data": {
 *     "type": "driver-availability-updates",
 *     "attributes": {
 *       "state": "AVAILABLE"
 *     }
 *   }
 * }
 */
export const UpdateAvailabilitySchema = z.object({
  data: z.object({
    type: z.literal("driver-availability-updates"),
    attributes: z.object({
      state: driverStateSchema,
    }),
  }),
});

export type UpdateAvailabilityRequest = z.infer<
  typeof UpdateAvailabilitySchema
>;

/**
 * Schema for PATCH /api/drivers/:id/location
 *
 * JSON:API request body:
 * {
 *   "data": {
 *     "type": "driver-location-updates",
 *     "attributes": {
 *       "latitude": 4.6097,
 *       "longitude": -74.0817,
 *       "accuracy": 10.5,
 *       "bearing": 180,
 *       "speed": 5.2,
 *       "recordedAt": "2026-02-13T14:00:00.000Z"
 *     }
 *   }
 * }
 */
export const UpdateLocationSchema = z.object({
  data: z.object({
    type: z.literal("driver-location-updates"),
    attributes: z.object({
      latitude: latitudeSchema,
      longitude: longitudeSchema,
      accuracy: accuracySchema,
      bearing: bearingSchema,
      speed: speedSchema,
      recordedAt: z.string().datetime(),
    }),
  }),
});

export type UpdateLocationRequest = z.infer<typeof UpdateLocationSchema>;

/**
 * Route param validation
 */
export const DriverIdParamSchema = z.object({
  id: z.string().min(1).max(128),
});

export type DriverIdParam = z.infer<typeof DriverIdParamSchema>;
