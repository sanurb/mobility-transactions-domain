/**
 * Driver Repository
 *
 * Persistence adapter implementing DriverRepositoryPort.
 * Handles optimistic concurrency control via version-based CAS.
 *
 * Note: tenant_id column remains in DB for future use, but domain layer
 * does not use TenantId per PRD (isolation via ownership/role/geo).
 */

import type { Transaction } from "sequelize";
import { Result } from "../../../../../shared/core/result.js";
import {
  ConflictError,
  type DomainError,
  InfrastructureError,
} from "../../../../../shared/errors/error-types.js";
import { sequelize } from "../../../../../shared/infrastructure/database/sequelize.js";
import type { DriverRepositoryPort } from "../../../application/ports/driver-repository.port.js";
import { Driver, type DriverProps } from "../../../domain/driver.aggregate.js";
import { DriverId } from "../../../domain/value-objects/driver-id.js";
import { Location } from "../../../domain/value-objects/location.js";
import { LocationUpdate } from "../../../domain/value-objects/location-update.js";
import { DriverModel } from "./driver.model.js";
import { DriverLocationModel } from "./driver-location.model.js";

/**
 * Default tenant_id value (empty per PRD - no multi-tenancy in domain)
 */
const DEFAULT_TENANT_ID = "";

/**
 * Map Sequelize DriverModel to Driver aggregate
 *
 * Converts persisted primitives to domain value objects.
 * Returns InfrastructureError with DATA_CORRUPTION if persisted data is invalid.
 */
const mapDriverModelToAggregate = (
  model: DriverModel
): Result<Driver, InfrastructureError> => {
  // Map DriverId
  const driverIdResult = DriverId.create(model.id);
  if (driverIdResult.isErr()) {
    return Result.err(
      new InfrastructureError(
        "DATA_CORRUPTION: Invalid driver ID in database",
        {
          service: "database",
          cause: driverIdResult.error,
          retryable: false,
        }
      )
    );
  }

  // Map current location (all-or-none)
  let currentLocation: LocationUpdate | null = null;
  if (model.current_location_latitude !== null) {
    // All location fields must be present
    if (
      model.current_location_longitude === null ||
      model.current_location_accuracy_meters === null ||
      model.current_location_bearing_degrees === null ||
      model.current_location_speed_mps === null ||
      model.current_location_recorded_at === null
    ) {
      return Result.err(
        new InfrastructureError(
          "DATA_CORRUPTION: Partial current location in database",
          {
            service: "database",
            retryable: false,
          }
        )
      );
    }

    // Create Location VO
    const locationResult = Location.create(
      Number(model.current_location_latitude),
      Number(model.current_location_longitude)
    );
    if (locationResult.isErr()) {
      return Result.err(
        new InfrastructureError(
          "DATA_CORRUPTION: Invalid location coordinates in database",
          {
            service: "database",
            cause: locationResult.error,
            retryable: false,
          }
        )
      );
    }

    // Create LocationUpdate VO
    const locationUpdateResult = LocationUpdate.create({
      location: locationResult.value,
      accuracyMeters: Number(model.current_location_accuracy_meters),
      bearingDegrees: Number(model.current_location_bearing_degrees),
      speedMetersPerSecond: Number(model.current_location_speed_mps),
      recordedAt: model.current_location_recorded_at,
    });
    if (locationUpdateResult.isErr()) {
      return Result.err(
        new InfrastructureError(
          "DATA_CORRUPTION: Invalid location update metadata in database",
          {
            service: "database",
            cause: locationUpdateResult.error,
            retryable: false,
          }
        )
      );
    }

    currentLocation = locationUpdateResult.value;
  }

  // Reconstitute Driver aggregate
  const props: DriverProps = {
    id: driverIdResult.value,
    state: model.state,
    currentLocation,
    currentRideId: null, // Not persisted yet (will be added in future iteration)
    registeredAt: model.registered_at,
    updatedAt: model.updated_at,
    version: model.version,
  };

  return Result.ok(Driver.reconstitute(props));
};

/**
 * Map Driver aggregate to Sequelize model attributes
 *
 * Extracts primitives from aggregate.
 * Enforces all-or-none current location mapping.
 */
const mapDriverAggregateToModel = (driver: Driver): Partial<DriverModel> => {
  const props = driver.toProps();

  // All-or-none location mapping
  let locationFields: Partial<DriverModel> = {
    current_location_latitude: null,
    current_location_longitude: null,
    current_location_accuracy_meters: null,
    current_location_bearing_degrees: null,
    current_location_speed_mps: null,
    current_location_recorded_at: null,
  };

  if (props.currentLocation !== null) {
    locationFields = {
      current_location_latitude: props.currentLocation.location.latitude,
      current_location_longitude: props.currentLocation.location.longitude,
      current_location_accuracy_meters: props.currentLocation.accuracyMeters,
      current_location_bearing_degrees: props.currentLocation.bearingDegrees,
      current_location_speed_mps: props.currentLocation.speedMetersPerSecond,
      current_location_recorded_at: props.currentLocation.recordedAt,
    };
  }

  return {
    id: props.id.value,
    tenant_id: DEFAULT_TENANT_ID,
    state: props.state,
    version: props.version,
    registered_at: props.registeredAt,
    ...locationFields,
  };
};

/**
 * Driver Repository Implementation
 */
export class DriverRepository implements DriverRepositoryPort {
  /**
   * Find a driver by ID
   */
  async findById(params: {
    id: DriverId;
  }): Promise<Result<Driver | null, DomainError>> {
    try {
      const model = await DriverModel.findOne({
        where: {
          id: params.id.value,
        },
      });

      if (!model) {
        return Result.ok(null);
      }

      return mapDriverModelToAggregate(model);
    } catch (error) {
      return Result.err(
        new InfrastructureError("Failed to find driver", {
          service: "database",
          cause: error,
          retryable: true,
        })
      );
    }
  }

  /**
   * Save a driver (create or update) with optimistic locking
   *
   * Uses CAS (Compare-And-Swap) on version column.
   * Returns ConflictError on concurrent modification.
   */
  async save(driver: Driver): Promise<Result<Driver, DomainError>> {
    try {
      return await sequelize.transaction(async (transaction: Transaction) => {
        const props = driver.toProps();
        const modelData = mapDriverAggregateToModel(driver);

        // Check if driver exists
        const existingDriver = await DriverModel.findOne({
          where: {
            id: props.id.value,
          },
          transaction,
        });

        if (!existingDriver) {
          // Create new driver with version 1
          const created = await DriverModel.create(
            {
              id: props.id.value,
              tenant_id: DEFAULT_TENANT_ID,
              state: props.state,
              version: 1,
              current_location_latitude:
                props.currentLocation?.location.latitude ?? null,
              current_location_longitude:
                props.currentLocation?.location.longitude ?? null,
              current_location_accuracy_meters:
                props.currentLocation?.accuracyMeters ?? null,
              current_location_bearing_degrees:
                props.currentLocation?.bearingDegrees ?? null,
              current_location_speed_mps:
                props.currentLocation?.speedMetersPerSecond ?? null,
              current_location_recorded_at:
                props.currentLocation?.recordedAt ?? null,
              registered_at: props.registeredAt,
            },
            { transaction }
          );

          // Append location history if present
          if (props.currentLocation !== null) {
            await DriverLocationModel.create(
              {
                driver_id: props.id.value,
                tenant_id: DEFAULT_TENANT_ID,
                latitude: props.currentLocation.location.latitude,
                longitude: props.currentLocation.location.longitude,
                accuracy_meters: props.currentLocation.accuracyMeters,
                bearing_degrees: props.currentLocation.bearingDegrees,
                speed_mps: props.currentLocation.speedMetersPerSecond,
                recorded_at: props.currentLocation.recordedAt,
              },
              { transaction }
            );
          }

          // Reload and reconstitute
          const reloaded = await DriverModel.findByPk(created.id, {
            transaction,
          });
          if (!reloaded) {
            throw new Error("Failed to reload created driver");
          }

          const driverResult = mapDriverModelToAggregate(reloaded);
          if (driverResult.isErr()) {
            return driverResult;
          }

          return Result.ok(driverResult.value);
        }

        // Update existing driver with CAS on version
        // Domain aggregate already incremented version, so:
        // - SET version = props.version (already incremented by domain)
        // - WHERE version = props.version - 1 (match DB version before domain increment)
        const [affectedRows] = await DriverModel.update(
          {
            ...modelData,
            version: props.version, // Domain already incremented
          },
          {
            where: {
              id: props.id.value,
              version: props.version - 1, // CAS: match pre-increment version
            },
            transaction,
          }
        );

        // CAS failed - concurrent modification detected
        if (affectedRows === 0) {
          // Fetch current state for better error message
          const currentDriver = await DriverModel.findOne({
            where: {
              id: props.id.value,
            },
            transaction,
          });

          return Result.err(
            new ConflictError(
              `Concurrent modification detected. Expected version ${props.version - 1}, current version ${currentDriver?.version ?? "unknown"}`,
              {
                currentState: currentDriver?.state,
                attemptedAction: "save driver",
              }
            )
          );
        }

        // Append location history if present
        if (props.currentLocation !== null) {
          await DriverLocationModel.create(
            {
              driver_id: props.id.value,
              tenant_id: DEFAULT_TENANT_ID,
              latitude: props.currentLocation.location.latitude,
              longitude: props.currentLocation.location.longitude,
              accuracy_meters: props.currentLocation.accuracyMeters,
              bearing_degrees: props.currentLocation.bearingDegrees,
              speed_mps: props.currentLocation.speedMetersPerSecond,
              recorded_at: props.currentLocation.recordedAt,
            },
            { transaction }
          );
        }

        // Reload and reconstitute with new version
        const updated = await DriverModel.findByPk(props.id.value, {
          transaction,
        });
        if (!updated) {
          throw new Error("Failed to reload updated driver");
        }

        const driverResult = mapDriverModelToAggregate(updated);
        if (driverResult.isErr()) {
          return driverResult;
        }

        return Result.ok(driverResult.value);
      });
    } catch (error) {
      // Preserve specific error types
      if (error instanceof ConflictError) {
        return Result.err(error);
      }
      return Result.err(
        new InfrastructureError("Failed to save driver", {
          service: "database",
          cause: error,
          retryable: false, // State changes should not be retried blindly
        })
      );
    }
  }
}

/**
 * Create a driver repository instance
 */
export const createDriverRepository = (): DriverRepositoryPort => {
  return new DriverRepository();
};
