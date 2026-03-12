/**
 * Ride Repository Port Implementation
 *
 * Infrastructure adapter that implements RideRepositoryPort.
 * Maps between Ride aggregates and Sequelize models.
 *
 * PRD alignment:
 * - No tenantId parameters (removed from all operations)
 * - Operates on Ride aggregates (reconstitute from persistence, persist from aggregate)
 * - Optimistic locking via version field
 */

import type { Transaction } from "sequelize";
import { Op } from "sequelize";
import { type Result, tryCatchAsync } from "../../../../shared/core/result.js";
import { Location } from "../../../../shared/domain/value-objects/location.js";
import {
  ConflictError,
  type DomainError,
  InfrastructureError,
} from "../../../../shared/errors/error-types.js";
import { sequelize } from "../../../../shared/infrastructure/database/sequelize.js";
import {
  type RideId,
  unsafeDriverId,
  unsafeRideId,
  unsafeRiderId,
} from "../../../../shared/types/ids/index.js";
import type {
  ListRidesQuery,
  ListRidesResult,
  RideRepositoryPort,
  RideTransitionDTO,
} from "../../application/ports/ride-repository.port.js";
import { Ride } from "../../domain/ride.aggregate.js";
import { RIDE_STATES } from "../../domain/ride-states.js";
import { RideModel } from "../../infrastructure/ride.model.js";
import { RideTransitionModel } from "../../infrastructure/ride-transition.model.js";

/**
 * Map Sequelize model to Ride aggregate
 */
const mapModelToAggregate = (model: RideModel): Ride => {
  const pickup = Location.create(
    Number(model.pickup_lat),
    Number(model.pickup_lng)
  );
  const dropoff = Location.create(
    Number(model.dropoff_lat),
    Number(model.dropoff_lng)
  );

  if (pickup.isErr() || dropoff.isErr()) {
    throw new InfrastructureError("Invalid location data in database", {
      service: "database",
      cause: "Location validation failed during reconstitution",
      retryable: false,
    });
  }

  return Ride.reconstitute({
    id: unsafeRideId(model.id),
    riderId: unsafeRiderId(model.rider_id),
    driverId: model.driver_id ? unsafeDriverId(model.driver_id) : null,
    marketId: null, // Not in current schema, can be added later
    state: model.state,
    pickup: pickup.value,
    dropoff: dropoff.value,
    requestedAtUTC: model.requested_at.toISOString(),
    startedAtUTC: model.started_at?.toISOString() ?? null,
    completedAtUTC: model.completed_at?.toISOString() ?? null,
    expiresAtUTC: model.expires_at?.toISOString() ?? null,
    version: model.version,
  });
};

/**
 * Ride Repository Implementation
 */
export class RideRepositoryImpl implements RideRepositoryPort {
  /**
   * Save a ride aggregate (create or update)
   */
  async save(aggregate: Ride): Promise<Result<void, DomainError>> {
    return tryCatchAsync(
      async () => {
        await sequelize.transaction(async (transaction: Transaction) => {
          // Check if ride exists
          const existing = await RideModel.findByPk(aggregate.id, {
            transaction,
          });

          if (existing) {
            // Update existing ride with optimistic locking
            const currentVersion = aggregate.getVersion();
            const [affectedRows] = await RideModel.update(
              {
                state: aggregate.state,
                driver_id: aggregate.driverId,
                started_at: aggregate.startedAtUTC
                  ? new Date(aggregate.startedAtUTC)
                  : null,
                completed_at: aggregate.completedAtUTC
                  ? new Date(aggregate.completedAtUTC)
                  : null,
                expires_at: aggregate.expiresAtUTC
                  ? new Date(aggregate.expiresAtUTC)
                  : null,
                version: currentVersion,
              },
              {
                where: {
                  id: aggregate.id,
                  version: currentVersion - 1, // Optimistic lock
                },
                transaction,
              }
            );

            if (affectedRows === 0) {
              throw new ConflictError(
                `Concurrent modification detected for ride ${aggregate.id}`,
                {
                  currentState: existing.state,
                  attemptedAction: "save aggregate",
                }
              );
            }

            // Pull domain events from aggregate
            const events = aggregate.pullDomainEvents();

            // Record transitions for RideStateChanged events
            for (const event of events) {
              if (event.eventType === "RideStateChanged") {
                const payload = event.payload as {
                  previousState: string;
                  newState: string;
                  changedBy: string;
                  changedByRole: "rider" | "driver" | "system";
                  reason?: string;
                };

                await RideTransitionModel.create(
                  {
                    ride_id: aggregate.id,
                    from_state: payload.previousState,
                    to_state: payload.newState,
                    changed_by: payload.changedBy,
                    changed_by_role: payload.changedByRole,
                    reason: payload.reason ?? null,
                    correlation_id: event.correlationId ?? null,
                  },
                  { transaction }
                );
              }
            }
          } else {
            // Create new ride
            await RideModel.create(
              {
                id: aggregate.id,
                tenant_id: "", // Empty string per PRD (no tenant model)
                rider_id: aggregate.riderId,
                driver_id: aggregate.driverId,
                state: aggregate.state,
                pickup_lat: aggregate.pickup.latitude,
                pickup_lng: aggregate.pickup.longitude,
                dropoff_lat: aggregate.dropoff.latitude,
                dropoff_lng: aggregate.dropoff.longitude,
                requested_at: new Date(aggregate.requestedAtUTC),
                started_at: aggregate.startedAtUTC
                  ? new Date(aggregate.startedAtUTC)
                  : null,
                completed_at: aggregate.completedAtUTC
                  ? new Date(aggregate.completedAtUTC)
                  : null,
                expires_at: aggregate.expiresAtUTC
                  ? new Date(aggregate.expiresAtUTC)
                  : null,
                version: aggregate.getVersion(),
              },
              { transaction }
            );

            // Create initial transition
            await RideTransitionModel.create(
              {
                ride_id: aggregate.id,
                from_state: "NONE",
                to_state: RIDE_STATES.CREATED,
                changed_by: aggregate.riderId,
                changed_by_role: "rider",
                reason: "Ride requested",
              },
              { transaction }
            );
          }
        });
      },
      (error: unknown) => {
        if (error instanceof ConflictError) {
          return error;
        }
        return new InfrastructureError("Failed to save ride", {
          service: "database",
          cause: error,
          retryable: true,
        });
      }
    );
  }

  /**
   * Find ride by ID
   */
  async findById(id: RideId): Promise<Result<Ride | null, DomainError>> {
    return tryCatchAsync(
      async () => {
        const model = await RideModel.findByPk(id);

        if (!model) {
          return null;
        }

        return mapModelToAggregate(model);
      },
      (error: unknown) =>
        new InfrastructureError("Failed to find ride", {
          service: "database",
          cause: error,
          retryable: true,
        })
    );
  }

  /**
   * Find expired rides
   */
  async findExpired(params: {
    nowUTC: string;
    limit: number;
  }): Promise<Result<Ride[], DomainError>> {
    return tryCatchAsync(
      async () => {
        const models = await RideModel.findAll({
          where: {
            state: {
              [Op.in]: [RIDE_STATES.DISPATCHING, RIDE_STATES.ASSIGNED],
            },
            expires_at: {
              [Op.lte]: new Date(params.nowUTC),
            },
          },
          limit: params.limit,
          order: [["expires_at", "ASC"]],
        });

        return models.map(mapModelToAggregate);
      },
      (error: unknown) =>
        new InfrastructureError("Failed to find expired rides", {
          service: "database",
          cause: error,
          retryable: true,
        })
    );
  }

  /**
   * List rides with filtering and pagination
   */
  async findTransitions(
    rideId: RideId
  ): Promise<Result<RideTransitionDTO[], DomainError>> {
    return tryCatchAsync(
      async () => {
        const models = await RideTransitionModel.findAll({
          where: { ride_id: rideId },
          order: [["created_at", "ASC"]],
        });

        return models.map((m) => ({
          fromState: m.from_state,
          toState: m.to_state,
          changedBy: m.changed_by,
          changedByRole: m.changed_by_role,
          reason: m.reason,
          createdAt: m.created_at.toISOString(),
        }));
      },
      (error: unknown) =>
        new InfrastructureError("Failed to find ride transitions", {
          service: "database",
          cause: error,
          retryable: true,
        })
    );
  }

  async list(
    query: ListRidesQuery
  ): Promise<Result<ListRidesResult, DomainError>> {
    return tryCatchAsync(
      async () => {
        const where: Record<string, unknown> = {};

        if (query.riderId) {
          where.rider_id = query.riderId;
        }
        if (query.driverId) {
          where.driver_id = query.driverId;
        }
        if (query.state) {
          where.state = query.state;
        }

        const { count, rows } = await RideModel.findAndCountAll({
          where,
          limit: query.limit ?? 50,
          offset: query.offset ?? 0,
          order: [["created_at", "DESC"]],
        });

        return {
          rides: rows.map(mapModelToAggregate),
          total: count,
        };
      },
      (error: unknown) =>
        new InfrastructureError("Failed to list rides", {
          service: "database",
          cause: error,
          retryable: true,
        })
    );
  }
}
