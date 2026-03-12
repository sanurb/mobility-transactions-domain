/**
 * Fare Calculation Event Handler
 *
 * Subscribes to RIDE_STATE_CHANGED events and automatically calculates fare
 * when a ride transitions to COMPLETED state.
 *
 * Resilience:
 * - Does not throw exceptions (would crash event bus)
 * - Handles ConflictError silently (idempotent re-delivery)
 * - Logs all other errors at error level
 */

import consola from "consola";
import { ConflictError } from "../../../shared/errors/error-types.js";
import type { EventHandler } from "../../../shared/infrastructure/events/event-bus.js";
import type { RideStateChangedEvent } from "../../../shared/infrastructure/events/event-types.js";
import type { IFareService } from "../application/fare.service.js";

/**
 * Create event handler that auto-calculates fare on ride completion
 *
 * The handler:
 * 1. Checks if ride transitioned to COMPLETED state
 * 2. Calls fareService.calculateAndStoreFare with placeholder inputs
 * 3. Handles ConflictError gracefully (idempotent)
 * 4. Logs errors without re-throwing (resilient)
 *
 * Note: In v1, distance and duration are placeholders (0).
 * With zeros, the minimum fare of 5,000 COP will always apply.
 * Future enhancement: compute actual distance/duration from ride GPS data.
 *
 * @param fareService - Fare service instance
 * @returns Event handler function
 */
export const createFareOnRideCompletedHandler = (
  fareService: IFareService
): EventHandler<RideStateChangedEvent> => {
  return async (event: RideStateChangedEvent): Promise<void> => {
    // Only process COMPLETED state transitions
    if (event.payload.newState !== "COMPLETED") {
      return;
    }

    const rideId = event.aggregateId;
    const tenantId = event.tenantId;

    consola.debug("[FareHandler] Ride completed, calculating fare", {
      rideId,
      tenantId,
      eventId: event.eventId,
      correlationId: event.correlationId,
    });

    try {
      // Calculate and store fare with placeholder inputs
      // V1: distance=0, duration=0 (minimum fare will apply)
      // Future: extract actual values from ride data
      const result = await fareService.calculateAndStoreFare({
        rideId,
        tenantId,
        baseFareCOP: 3500, // Standard base fare for Bogota
        distanceKm: 0, // Placeholder - will compute from ride GPS data in future
        durationMinutes: 0, // Placeholder - will compute from ride timestamps in future
      });

      if (result.isErr()) {
        const error = result.error;

        // ConflictError means fare already calculated (idempotent re-delivery)
        if (error instanceof ConflictError) {
          consola.debug(
            "[FareHandler] Fare already calculated for ride (idempotent)",
            {
              rideId,
              tenantId,
            }
          );
          return;
        }

        // Other errors: log at error level but don't throw
        consola.error("[FareHandler] Failed to calculate fare", {
          rideId,
          tenantId,
          errorType: error.constructor.name,
          errorMessage: error.message,
          eventId: event.eventId,
        });
        return;
      }

      const fare = result.value;
      consola.info("[FareHandler] Fare calculated successfully", {
        rideId,
        tenantId,
        fareId: fare.id,
        totalFareCOP: fare.totalFareCOP,
        minimumApplied: fare.minimumApplied,
      });
    } catch (error) {
      // Catch any unexpected synchronous errors
      consola.error("[FareHandler] Unexpected error in fare calculation", {
        rideId,
        tenantId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        eventId: event.eventId,
      });
      // Do not re-throw - must not crash event bus
    }
  };
};
