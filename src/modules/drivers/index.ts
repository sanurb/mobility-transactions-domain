/**
 * Drivers Module
 *
 * Main entry point for driver domain, application, and adapters.
 * Provides initialization function that wires all dependencies together.
 */

import type { FastifyPluginAsync } from "fastify";
import type { Sequelize } from "sequelize";
import type { IEventBus } from "../../shared/infrastructure/events/event-bus.js";
import { createDriverRoutes } from "./adapters/index.js";
import {
  createDriverRepository,
  createGeoSpatialIndex,
  createSystemClock,
  initDriverModels,
} from "./adapters/outbound/index.js";
import { createDriverService } from "./application/driver.service.js";
import type { GeoSpatialIndexPort } from "./application/ports/geo-spatial-index.port.js";

/**
 * Initialize the driver module
 *
 * Wires together models, repository, geo-index, clock, service, and routes.
 * Call this during application startup.
 *
 * @param sequelize - Sequelize instance
 * @param eventBus - Event bus instance
 * @returns Object with driver routes plugin and shared geoIndex
 */
export const initDriverModule = (
  sequelize: Sequelize,
  eventBus: IEventBus
): {
  driverRoutes: FastifyPluginAsync;
  geoIndex: GeoSpatialIndexPort;
} => {
  // Initialize models
  initDriverModels(sequelize);

  // Create repository
  const repository = createDriverRepository();

  // Create geo-spatial index
  const geoIndex = createGeoSpatialIndex();

  // Create clock
  const clock = createSystemClock();

  // Create service
  const service = createDriverService(repository, geoIndex, eventBus, clock);

  // Create routes (JSON:API adapter)
  const driverRoutes = createDriverRoutes({ driverService: service });

  return {
    driverRoutes,
    geoIndex,
  };
};

export type {
  DriverDTO,
  IDriverService,
} from "./application/driver.service.js";
// Re-export public types and utilities
export type { DriverState } from "./domain/driver-states.js";
export { DRIVER_STATES } from "./domain/driver-states.js";
