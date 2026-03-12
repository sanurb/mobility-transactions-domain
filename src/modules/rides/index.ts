/**
 * Rides Module
 *
 * Main entry point for ride domain, application, and controller layers.
 * Provides initialization function that wires all dependencies together.
 */

import type { FastifyPluginAsync } from "fastify";
import type { Sequelize } from "sequelize";
import { Result } from "../../shared/core/result.js";
import type { IEventBus } from "../../shared/infrastructure/events/event-bus.js";
import { unsafeDriverId, unsafeRideId } from "../../shared/types/ids/index.js";
import type {
  RideAssignmentPort,
  TransitionRideToAssignedParams,
} from "../dispatch/application/ports/ride-assignment.port.js";
import { createRideRoutes } from "./adapters/inbound/ride.jsonapi-routes.js";
import { RideRepositoryImpl } from "./adapters/outbound/ride.repository.js";
import type { ClockPort } from "./application/ports/clock.port.js";
import {
  CreateRideUseCase,
  GetRideUseCase,
  ListRidesUseCase,
  TransitionRideUseCase,
} from "./application/use-cases/index.js";
import { initRideModels } from "./infrastructure/index.js";

/**
 * Initialize the ride module
 *
 * @param sequelize - Sequelize instance
 * @param eventBus - Event bus instance
 * @returns Object with ride routes plugin and ride assignment port
 */
export const initRideModule = (
  sequelize: Sequelize,
  eventBus: IEventBus
): {
  rideRoutes: FastifyPluginAsync;
  rideAssignmentPort: RideAssignmentPort;
} => {
  // Initialize models
  initRideModels(sequelize);

  // Create repository and clock
  const repository = new RideRepositoryImpl();
  const clock: ClockPort = { now: () => new Date().toISOString() };

  // Create use cases
  const createRideUseCase = new CreateRideUseCase(repository, clock);
  const transitionRideUseCase = new TransitionRideUseCase(
    repository,
    clock,
    eventBus
  );
  const getRideUseCase = new GetRideUseCase(repository);
  const listRidesUseCase = new ListRidesUseCase(repository);

  // Create JSON:API routes
  const rideRoutes = createRideRoutes({
    createRideUseCase,
    transitionRideUseCase,
    getRideUseCase,
    listRidesUseCase,
  });

  // Create ride assignment port for dispatch module
  const rideAssignmentPort: RideAssignmentPort = {
    async transitionRideToAssigned(
      params: TransitionRideToAssignedParams
    ): Promise<
      Result<void, import("../../shared/errors/error-types.js").DomainError>
    > {
      const result = await transitionRideUseCase.execute({
        rideId: unsafeRideId(params.rideId),
        toState: "ASSIGNED" as import("./domain/ride-states.js").RideState,
        changedBy: "dispatch-system",
        changedByRole: "system",
        driverId: unsafeDriverId(params.driverId),
        reason: "Driver assigned via dispatch",
      });

      if (result.isErr()) {
        return result;
      }

      return Result.ok(undefined);
    },
  };

  return {
    rideRoutes,
    rideAssignmentPort,
  };
};

// Re-export public types and utilities
export type { RideState } from "./domain/ride-states.js";
export { RIDE_STATES } from "./domain/ride-states.js";
