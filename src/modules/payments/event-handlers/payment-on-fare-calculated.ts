/**
 * Payment Intent Creation Event Handler
 *
 * Subscribes to FARE_CALCULATED events and creates payment intents
 * via the CreatePaymentIntentUseCase.
 *
 * Resilience:
 * - Does not throw (would crash event bus)
 * - Idempotent: use case returns existing intent on duplicate rideId
 * - Logs all errors at appropriate levels
 */

import { randomUUID } from "node:crypto";
import consola from "consola";
import { MoneyCOP } from "../../../shared/domain/value-objects/money-cop.js";
import type { EventHandler } from "../../../shared/infrastructure/events/event-bus.js";
import type { FareCalculatedEvent } from "../../../shared/infrastructure/events/event-types.js";
import {
  unsafePaymentIntentId,
  unsafeRideId,
  unsafeRiderId,
} from "../../../shared/types/ids/index.js";
import type { CreatePaymentIntentUseCase } from "../application/use-cases/create-payment-intent.js";

/**
 * Branded-ID + VO conversion happens here at the adapter boundary,
 * keeping the use case free of primitive-to-VO parsing.
 */
export const createPaymentOnFareCalculatedHandler = (
  createPaymentIntent: CreatePaymentIntentUseCase,
  getRiderId: (rideId: string, tenantId?: string) => Promise<string | null>
): EventHandler<FareCalculatedEvent> => {
  return async (event: FareCalculatedEvent): Promise<void> => {
    const { rideId, totalFareCOP } = event.payload;
    const { tenantId, eventId, correlationId, causationId } = event;

    consola.debug("[PaymentHandler] Fare calculated, creating payment intent", {
      rideId,
      tenantId,
      fareId: event.aggregateId,
      totalFareCOP,
      eventId,
    });

    try {
      const riderId = await getRiderId(rideId, tenantId);

      if (!riderId) {
        consola.error("[PaymentHandler] Could not find riderId for ride", {
          rideId,
          tenantId,
          eventId,
        });
        return;
      }

      const amountResult = MoneyCOP.create(totalFareCOP);
      if (amountResult.isErr()) {
        consola.error("[PaymentHandler] Invalid fare amount", {
          rideId,
          tenantId,
          totalFareCOP,
          error: amountResult.error.message,
        });
        return;
      }

      const output = await createPaymentIntent.execute({
        id: unsafePaymentIntentId(randomUUID()),
        rideId: unsafeRideId(rideId),
        riderId: unsafeRiderId(riderId),
        amountCOP: amountResult.value,
        fareBreakdown: {
          baseFare: 0,
          distanceComponent: 0,
          timeComponent: 0,
          minimumFareApplied: true,
        },
        correlationId: correlationId ?? eventId,
        causationId,
      });

      consola.info("[PaymentHandler] Payment intent created", {
        rideId,
        tenantId,
        paymentIntentId: output.paymentIntentId,
        amountCOP: output.amountCOP,
      });
    } catch (error) {
      consola.error(
        "[PaymentHandler] Unexpected error creating payment intent",
        {
          rideId,
          tenantId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          eventId,
        }
      );
    }
  };
};
