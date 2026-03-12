/**
 * Dispatch Module
 *
 * Main entry point for dispatch bounded context.
 * Provides initialization function that wires all dependencies together.
 * Depends on RideAssignmentPort from rides module (injected).
 */

import type { FastifyPluginAsync } from "fastify";
import type { Sequelize } from "sequelize";
import { createIdempotencyPolicy } from "../../shared/application/idempotency/idempotency.policy.js";
import type { IEventBus } from "../../shared/infrastructure/events/event-bus.js";
import {
  createDriverRepository,
  createSystemClock,
} from "../drivers/adapters/outbound/index.js";
import { NearestFirstDispatchPolicy } from "../drivers/domain/dispatch-policy.js";
import type { GeoSpatialIndexPort } from "../drivers/domain/ports/geo-spatial-index.port.js";
import { createDispatchJsonApiRoutes } from "./adapters/inbound/index.js";
import { DispatchProcessManager } from "./application/dispatch.process-manager.js";
import type { RideAssignmentPort } from "./application/ports/ride-assignment.port.js";
import { createInMemoryDispatchAuditWriter } from "./infrastructure/in-memory-dispatch-audit-writer.js";
import { createInMemoryDispatchProcessStore } from "./infrastructure/in-memory-dispatch-process-store.js";
import { initDispatchAuditModel } from "./infrastructure/persistence/dispatch-audit.model.js";

/**
 * Initialize the dispatch module
 *
 * Wires together all dispatch dependencies including cross-context port.
 * Call this during application startup after ride module initialization.
 *
 * @param sequelize - Sequelize instance
 * @param eventBus - Event bus instance
 * @param rideAssignmentPort - Cross-context port from rides module
 * @returns Object with dispatch routes plugin
 */
export const initDispatchModule = (
  sequelize: Sequelize,
  eventBus: IEventBus,
  rideAssignmentPort: RideAssignmentPort,
  sharedGeoIndex: GeoSpatialIndexPort
): {
  dispatchRoutes: FastifyPluginAsync;
} => {
  // Initialize dispatch-owned models
  initDispatchAuditModel(sequelize);

  // Reuse driver infrastructure (dispatch operates on drivers)
  const driverRepository = createDriverRepository();
  const geoIndex = sharedGeoIndex; // Use shared geo index from driver module
  const clock = createSystemClock();

  // Create dispatch policy
  const dispatchPolicy = new NearestFirstDispatchPolicy();

  // Create dispatch-specific ports (in-memory for now)
  const auditWriter = createInMemoryDispatchAuditWriter();
  const processStore = createInMemoryDispatchProcessStore();
  const idempotencyPolicy = createIdempotencyPolicy();

  // Create process manager
  const processManager = new DispatchProcessManager(
    driverRepository,
    geoIndex,
    dispatchPolicy,
    rideAssignmentPort,
    processStore,
    auditWriter,
    idempotencyPolicy,
    clock,
    eventBus
  );

  // Create JSON:API routes
  const dispatchRoutes = createDispatchJsonApiRoutes(processManager);

  return {
    dispatchRoutes,
  };
};

export type { DispatchResultDTO } from "./application/dispatch.process-manager.js";
