/**
 * FareRepository - Outbound adapter implementing FareRepositoryPort
 *
 * Maps between domain VOs and Sequelize models.
 * Enforces write-once semantics via unique constraint.
 */

import { createId } from "@paralleldrive/cuid2";
import { type Result, tryCatchAsync } from "../../../../shared/core/result.js";
import {
  FareAmount,
  MoneyCOP,
  PricingVersion,
} from "../../../../shared/domain/value-objects/index.js";
import type { DomainError } from "../../../../shared/errors/error-types.js";
import {
  ConflictError,
  InfrastructureError,
} from "../../../../shared/errors/error-types.js";
import { unsafeRideId } from "../../../../shared/types/ids/index.js";
import type {
  FareRecord,
  FareRepositoryPort,
} from "../../application/ports/index.js";
import { FareCalculationModel } from "../../infrastructure/fare-calculation.model.js";

/**
 * Map Sequelize model to FareRecord with VOs.
 * Uses unsafe constructors for trusted DB data.
 */
const mapModelToRecord = (model: FareCalculationModel): FareRecord => {
  // Reconstitute VOs from trusted DB data
  const baseFare = MoneyCOP.fromTrusted(model.base_fare_cop);
  const distanceComponent = MoneyCOP.fromTrusted(model.distance_component_cop);
  const timeComponent = MoneyCOP.fromTrusted(model.time_component_cop);

  // Reconstitute FareAmount from trusted DB fields (preserves stored minimumApplied)
  const totalFare = FareAmount.fromTrusted(
    model.total_fare_cop,
    model.minimum_applied
  );

  // Reconstitute PricingVersion
  const pricingVersionResult = PricingVersion.create(model.pricing_version);
  if (pricingVersionResult.isErr()) {
    throw new InfrastructureError("Corrupt PricingVersion in database", {
      service: "database",
      retryable: false,
    });
  }

  return {
    id: model.id,
    rideId: unsafeRideId(model.ride_id),
    baseFare,
    distanceKm: Number(model.distance_km),
    durationMinutes: Number(model.duration_minutes),
    distanceComponent,
    timeComponent,
    totalFare,
    pricingVersion: pricingVersionResult.value,
    calculatedAtUTC: model.calculated_at.toISOString(),
    createdAtUTC: model.createdAt.toISOString(),
  };
};

/**
 * FareRepository implementation using Sequelize.
 */
export class FareRepository implements FareRepositoryPort {
  async save(
    record: Omit<FareRecord, "id" | "createdAtUTC">
  ): Promise<Result<FareRecord, DomainError>> {
    return tryCatchAsync(
      async () => {
        const fare = await FareCalculationModel.create({
          id: createId(),
          ride_id: record.rideId,
          tenant_id: "", // PRD: no tenantId
          base_fare_cop: record.baseFare.amount,
          distance_km: record.distanceKm,
          duration_minutes: record.durationMinutes,
          distance_component_cop: record.distanceComponent.amount,
          time_component_cop: record.timeComponent.amount,
          total_fare_cop: record.totalFare.amount,
          minimum_applied: record.totalFare.minimumApplied,
          pricing_version: record.pricingVersion.value,
          calculated_at: new Date(record.calculatedAtUTC),
        });

        return mapModelToRecord(fare);
      },
      (error) => {
        // Check for unique constraint violation on rideId
        const errorMessage = String(error);
        if (
          errorMessage.includes("unique constraint") ||
          errorMessage.includes("UNIQUE constraint") ||
          errorMessage.includes("duplicate key")
        ) {
          return new ConflictError("Fare already calculated for ride", {
            currentState: "CALCULATED",
            attemptedAction: "calculate fare",
          });
        }

        return new InfrastructureError("Failed to save fare calculation", {
          service: "database",
          cause: error,
          retryable: true,
        });
      }
    );
  }

  async findByRideId(
    rideId: import("../../../../shared/types/ids/index.js").RideId
  ): Promise<Result<FareRecord | null, DomainError>> {
    return tryCatchAsync(
      async () => {
        const fare = await FareCalculationModel.findOne({
          where: {
            ride_id: rideId,
          },
        });

        if (!fare) {
          return null;
        }

        return mapModelToRecord(fare);
      },
      (error) =>
        new InfrastructureError("Failed to find fare calculation", {
          service: "database",
          cause: error,
          retryable: true,
        })
    );
  }
}

/**
 * Create a FareRepository instance.
 */
export const createFareRepository = (): FareRepositoryPort => {
  return new FareRepository();
};
