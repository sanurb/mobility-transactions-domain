/**
 * Fares Module
 *
 * Main entry point for fare domain, application, and presentation layers.
 * Provides initialization function that wires all dependencies together.
 */

import type { FastifyPluginAsync } from "fastify";
import type { Sequelize } from "sequelize";
import type { IEventBus } from "../../shared/infrastructure/events/event-bus.js";
import { DOMAIN_EVENT_TYPES } from "../../shared/infrastructure/events/event-types.js";
import { createFareRoutes } from "./adapters/inbound/index.js";
import { createFareService } from "./application/fare.service.js";
import type { ClockPort } from "./application/ports/clock.port.js";
import { CalculateFareUseCase } from "./application/use-cases/calculate-fare.js";
import { GetFareUseCase } from "./application/use-cases/get-fare.js";
import { createFareOnRideCompletedHandler } from "./event-handlers/fare-on-ride-completed.js";
import {
  createFareRepository,
  initFareCalculationModel,
} from "./infrastructure/index.js";

/**
 * Initialize the fare module
 *
 * Wires together models, repository, service, event handlers, and routes.
 * Subscribes event handler to RIDE_STATE_CHANGED events.
 * Call this during application startup.
 *
 * @param sequelize - Sequelize instance
 * @param eventBus - Event bus instance
 * @returns Object with fare routes plugin
 */
export const initFareModule = (
  sequelize: Sequelize,
  eventBus: IEventBus
): {
  fareRoutes: FastifyPluginAsync;
} => {
  // Initialize models
  initFareCalculationModel(sequelize);

  // Create repository
  const repository = createFareRepository();

  // Create clock
  const clock: ClockPort = { now: () => new Date().toISOString() };

  // Create service (for event handler)
  const service = createFareService(repository, clock);

  // Create use cases for routes
  const calculateFareUseCase = new CalculateFareUseCase(repository, clock);
  const getFareUseCase = new GetFareUseCase(repository);

  // Create event handler
  const fareOnRideCompletedHandler = createFareOnRideCompletedHandler(service);

  // Subscribe handler to RIDE_STATE_CHANGED events
  eventBus.subscribe(
    DOMAIN_EVENT_TYPES.RIDE_STATE_CHANGED,
    fareOnRideCompletedHandler
  );

  // Create routes
  const fareRoutes = createFareRoutes(calculateFareUseCase, getFareUseCase);

  return {
    fareRoutes,
  };
};

// Re-export public types and utilities
export type {
  FareCalculationDTO,
  IFareService,
} from "./application/fare.service.js";
