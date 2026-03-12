/**
 * Dispatch Process Manager
 *
 * Explicit saga orchestration for driver-to-ride assignment.
 * This is NOT fake-atomic - it's a multi-step process with:
 * - Idempotency via correlationId
 * - Optimistic locking for driver reservation
 * - Compensation on failure
 * - Audit evidence for every outcome
 */

import type { IdempotencyPolicy } from "../../../shared/application/idempotency/idempotency.policy.js";
import { ok, Result } from "../../../shared/core/result.js";
import { Distance } from "../../../shared/domain/value-objects/distance.js";
import { Location } from "../../../shared/domain/value-objects/location.js";
import type { DomainError } from "../../../shared/errors/error-types.js";
import {
  ConflictError,
  ValidationError,
} from "../../../shared/errors/error-types.js";
import type {
  DispatchCandidate,
  DispatchPolicy,
} from "../../drivers/domain/dispatch-policy.js";
import { createDriverDispatchedEvent } from "../../drivers/domain/events.js";
import type { Clock } from "../../drivers/domain/ports/clock.port.js";
import type { DriverRepositoryPort } from "../../drivers/domain/ports/driver-repository.port.js";
import type { GeoSpatialIndexPort } from "../../drivers/domain/ports/geo-spatial-index.port.js";
import type { DriverId } from "../../drivers/domain/value-objects/driver-id.js";
import { TenantId } from "../../drivers/domain/value-objects/tenant-id.js";
import type {
  DispatchAuditWriter,
  EvaluatedCandidate,
} from "./ports/dispatch-audit-writer.port.js";
import type { DispatchProcessStore } from "./ports/dispatch-process-store.port.js";
import type { EventPublisherPort } from "./ports/event-publisher.port.js";
import type {
  RideAssignmentPort,
  TransitionRideToAssignedParams,
} from "./ports/ride-assignment.port.js";

/**
 * Maximum number of candidates to evaluate (bounded work)
 */
const MAX_CANDIDATES_EVALUATED = 50;

/**
 * Maximum reservation attempts before giving up (bounded work)
 */
const MAX_RESERVATION_ATTEMPTS = 3;

/**
 * Parameters for dispatch operation
 */
export interface DispatchRideParams {
  rideId: string;
  tenantId: string;
  pickupLocation: { lat: number; lng: number };
  searchRadiusMeters: number;
  correlationId: string | undefined;
}

/**
 * Dispatch result DTO
 */
export interface DispatchResultDTO {
  rideId: string;
  driverId: string;
  candidatesEvaluated: number;
  selectionCriteria: string;
  correlationId: string;
  dispatchedAt: string;
}

/**
 * Dispatch Process Manager
 *
 * Orchestrates the complete dispatch saga with explicit failure modes.
 */
export class DispatchProcessManager {
  constructor(
    private readonly driverRepository: DriverRepositoryPort,
    private readonly geoIndex: GeoSpatialIndexPort,
    private readonly dispatchPolicy: DispatchPolicy,
    private readonly rideAssignment: RideAssignmentPort,
    private readonly processStore: DispatchProcessStore,
    private readonly auditWriter: DispatchAuditWriter,
    private readonly idempotencyPolicy: IdempotencyPolicy,
    private readonly clock: Clock,
    private readonly eventBus: EventPublisherPort
  ) {}

  /**
   * Dispatch a ride to a driver
   *
   * This is an explicit saga with 10 steps:
   * 1. Validate correlationId
   * 2. Check process store for idempotent replay
   * 3. Build pickup location
   * 4. Query geo index
   * 5. Load and verify candidates
   * 6. If no eligible: audit + mark failed + return error
   * 7. Select winner via policy
   * 8. Reserve winner with optimistic locking
   * 9. Transition ride via RideAssignmentPort
   * 10. On success: mark succeeded, audit, publish event
   *     On failure: compensate (release driver), mark failed, audit
   */
  async dispatchRide(
    params: DispatchRideParams
  ): Promise<Result<DispatchResultDTO, DomainError>> {
    // Step 1: Validate and normalize correlationId
    const correlationIdResult = this.idempotencyPolicy.requireCorrelationId(
      params.correlationId
    );
    if (correlationIdResult.isErr()) {
      return correlationIdResult;
    }
    const correlationId = correlationIdResult.value;

    // Validate tenantId
    const tenantIdResult = TenantId.create(params.tenantId);
    if (tenantIdResult.isErr()) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult.value;

    // Validate searchRadiusMeters
    if (
      params.searchRadiusMeters <= 0 ||
      !Number.isFinite(params.searchRadiusMeters)
    ) {
      return Result.err(
        new ValidationError("Search radius must be positive and finite")
      );
    }

    // Step 2: Check process store for idempotent replay
    const existingResult = await this.processStore.getByCorrelationId({
      tenantId: params.tenantId,
      correlationId,
    });
    if (existingResult.isErr()) {
      return existingResult;
    }

    const existing = existingResult.value;
    if (existing) {
      // Idempotent replay
      if (existing.status === "SUCCEEDED" && existing.driverId) {
        // Return stored success deterministically
        return ok({
          rideId: params.rideId,
          driverId: existing.driverId,
          candidatesEvaluated: 0, // Not stored in process state
          selectionCriteria: "replayed-from-store",
          correlationId,
          dispatchedAt: existing.completedAt || existing.createdAt,
        });
      }

      if (existing.status === "FAILED") {
        // Return stored failure deterministically
        return Result.err(
          new ConflictError(existing.failureCode || "Dispatch failed", {
            attemptedAction: "dispatch ride",
          })
        );
      }

      // Status is IN_PROGRESS - continue with dispatch
    } else {
      // Create process record
      const createResult = await this.processStore.createIfAbsent({
        tenantId: params.tenantId,
        correlationId,
        rideId: params.rideId,
        createdAt: this.clock.now().toISOString(),
      });
      if (createResult.isErr()) {
        return createResult;
      }
    }

    // Step 3: Build pickup location VO
    const pickupResult = Location.create(
      params.pickupLocation.lat,
      params.pickupLocation.lng
    );
    if (pickupResult.isErr()) {
      await this.markFailedAndAudit({
        tenantId: params.tenantId,
        correlationId,
        rideId: params.rideId,
        failureCode: "INVALID_PICKUP_LOCATION",
        searchRadiusMeters: params.searchRadiusMeters,
        searchCenter: {
          latitude: params.pickupLocation.lat,
          longitude: params.pickupLocation.lng,
        },
        candidates: [],
      });
      return pickupResult;
    }
    const pickup = pickupResult.value;

    // Step 4: Query geo index for nearby drivers
    const nearbyDrivers = await this.geoIndex.findNearby({
      center: pickup,
      radiusMeters: params.searchRadiusMeters,
    });

    // Step 5: Load and verify candidates (bounded work)
    const candidates: DispatchCandidate[] = [];
    const evaluatedCandidates: EvaluatedCandidate[] = [];
    const now = this.clock.now();

    const driversToCheck = nearbyDrivers.slice(0, MAX_CANDIDATES_EVALUATED);

    for (const eligible of driversToCheck) {
      evaluatedCandidates.push({
        driverId: eligible.driverId.value,
        distanceMeters: eligible.distanceMeters,
      });

      // Load driver aggregate
      const driverResult = await this.driverRepository.findById({
        id: eligible.driverId,
      });

      if (driverResult.isErr()) {
        continue; // Skip on error
      }

      const driver = driverResult.value;
      if (!driver) {
        continue; // Skip if not found
      }

      // Verify eligibility via aggregate method
      if (!driver.isEligibleForDispatch(now)) {
        continue; // Skip ineligible
      }

      // Create distance VO
      const distanceResult = Distance.fromMeters(eligible.distanceMeters);
      if (distanceResult.isErr()) {
        continue; // Skip invalid distance
      }

      candidates.push({
        driverId: eligible.driverId,
        distance: distanceResult.value,
      });
    }

    // Step 6: If no eligible drivers, fail with audit
    if (candidates.length === 0) {
      await this.markFailedAndAudit({
        tenantId: params.tenantId,
        correlationId,
        rideId: params.rideId,
        failureCode: "NO_ELIGIBLE_DRIVERS",
        searchRadiusMeters: params.searchRadiusMeters,
        searchCenter: {
          latitude: params.pickupLocation.lat,
          longitude: params.pickupLocation.lng,
        },
        candidates: evaluatedCandidates,
      });

      return Result.err(
        new ValidationError(
          "NO_ELIGIBLE_DRIVERS",
          "No drivers available for dispatch"
        )
      );
    }

    // Step 7: Select winner via dispatch policy
    const selectionResult = this.dispatchPolicy.selectDriver(candidates);
    if (selectionResult.isErr()) {
      await this.markFailedAndAudit({
        tenantId: params.tenantId,
        correlationId,
        rideId: params.rideId,
        failureCode: "SELECTION_FAILED",
        searchRadiusMeters: params.searchRadiusMeters,
        searchCenter: {
          latitude: params.pickupLocation.lat,
          longitude: params.pickupLocation.lng,
        },
        candidates: evaluatedCandidates,
      });
      return selectionResult;
    }

    const selection = selectionResult.value;
    const winner = selection.winner;

    // Step 8: Reserve winner with optimistic locking (bounded attempts)
    let reservationSuccess = false;
    let reservedDriverId: DriverId | null = null;

    for (let attempt = 0; attempt < MAX_RESERVATION_ATTEMPTS; attempt++) {
      // Load winner aggregate fresh
      const winnerResult = await this.driverRepository.findById({
        id: winner.driverId,
      });

      if (winnerResult.isErr()) {
        continue; // Retry on error
      }

      const winnerDriver = winnerResult.value;
      if (!winnerDriver) {
        break; // Winner disappeared, stop trying
      }

      // Attempt reservation
      const reserveResult = winnerDriver.reserveForRide({
        rideId: params.rideId,
        nowUTC: this.clock.now().toISOString(),
        distanceMeters: winner.distance.meters,
      });

      if (reserveResult.isErr()) {
        break; // Cannot reserve (state changed), stop trying
      }

      // Save with optimistic locking
      const saveResult = await this.driverRepository.save(winnerDriver);

      if (saveResult.isOk()) {
        // Reservation succeeded
        reservationSuccess = true;
        reservedDriverId = winner.driverId;
        break;
      }

      // Conflict - retry
    }

    if (!(reservationSuccess && reservedDriverId)) {
      // Reservation failed after bounded attempts
      await this.markFailedAndAudit({
        tenantId: params.tenantId,
        correlationId,
        rideId: params.rideId,
        failureCode: "DRIVER_RESERVATION_CONFLICT",
        searchRadiusMeters: params.searchRadiusMeters,
        searchCenter: {
          latitude: params.pickupLocation.lat,
          longitude: params.pickupLocation.lng,
        },
        candidates: evaluatedCandidates,
      });

      return Result.err(
        new ConflictError("Failed to reserve driver after multiple attempts", {
          attemptedAction: "reserve driver",
        })
      );
    }

    // Step 9: Transition ride via RideAssignmentPort
    const assignParams: TransitionRideToAssignedParams = {
      rideId: params.rideId,
      tenantId: params.tenantId,
      driverId: reservedDriverId.value,
      correlationId,
    };

    const assignResult =
      await this.rideAssignment.transitionRideToAssigned(assignParams);

    if (assignResult.isErr()) {
      // Step 10a: Compensation - release driver
      await this.compensateDriverReservation(reservedDriverId, tenantId);

      await this.markFailedAndAudit({
        tenantId: params.tenantId,
        correlationId,
        rideId: params.rideId,
        failureCode: "RIDE_ASSIGNMENT_FAILED",
        searchRadiusMeters: params.searchRadiusMeters,
        searchCenter: {
          latitude: params.pickupLocation.lat,
          longitude: params.pickupLocation.lng,
        },
        candidates: evaluatedCandidates,
      });

      return assignResult;
    }

    // Step 10b: Success - mark succeeded, audit, publish event
    const dispatchedAt = this.clock.now().toISOString();

    await this.processStore.markSucceeded({
      tenantId: params.tenantId,
      correlationId,
      driverId: reservedDriverId.value,
      completedAt: dispatchedAt,
    });

    await this.auditWriter.writeDispatchAttempt({
      rideId: params.rideId,
      tenantId: params.tenantId,
      correlationId,
      dispatchedAt,
      searchRadiusMeters: params.searchRadiusMeters,
      searchCenter: {
        latitude: params.pickupLocation.lat,
        longitude: params.pickupLocation.lng,
      },
      candidatesEvaluated: evaluatedCandidates.length,
      candidates: evaluatedCandidates,
      selectedDriverId: reservedDriverId.value,
      selectionCriteria: selection.selectionCriteria,
      outcome: "SUCCEEDED",
      failureCode: null,
    });

    // Publish domain event
    const event = createDriverDispatchedEvent({
      driverId: reservedDriverId.value,
      rideId: params.rideId,
      distanceMeters: winner.distance.meters,
      dispatchedAtUTC: this.clock.now().toISOString(),
      correlationId,
    });
    await this.eventBus.publish(event);

    return ok({
      rideId: params.rideId,
      driverId: reservedDriverId.value,
      candidatesEvaluated: evaluatedCandidates.length,
      selectionCriteria: selection.selectionCriteria,
      correlationId,
      dispatchedAt,
    });
  }

  /**
   * Compensate driver reservation on failure
   */
  private async compensateDriverReservation(
    driverId: DriverId,
    tenantId: TenantId
  ): Promise<void> {
    try {
      const driverResult = await this.driverRepository.findById({
        id: driverId,
      });

      if (driverResult.isErr() || !driverResult.value) {
        return; // Cannot compensate
      }

      const driver = driverResult.value;
      const releaseResult = driver.releaseFromRide({
        nowUTC: this.clock.now().toISOString(),
      });

      if (releaseResult.isErr()) {
        return; // Cannot release
      }

      await this.driverRepository.save(driver);
    } catch {
      // Best effort compensation - log but don't fail
    }
  }

  /**
   * Mark process as failed and write audit
   */
  private async markFailedAndAudit(params: {
    tenantId: string;
    correlationId: string;
    rideId: string;
    failureCode: string;
    searchRadiusMeters: number;
    searchCenter: { latitude: number; longitude: number };
    candidates: readonly EvaluatedCandidate[];
  }): Promise<void> {
    const completedAt = this.clock.now().toISOString();

    await this.processStore.markFailed({
      tenantId: params.tenantId,
      correlationId: params.correlationId,
      failureCode: params.failureCode,
      completedAt,
    });

    const outcome =
      params.failureCode === "NO_ELIGIBLE_DRIVERS"
        ? "NO_ELIGIBLE"
        : params.failureCode === "DRIVER_RESERVATION_CONFLICT"
          ? "CONFLICT"
          : "FAILED";

    await this.auditWriter.writeDispatchAttempt({
      rideId: params.rideId,
      tenantId: params.tenantId,
      correlationId: params.correlationId,
      dispatchedAt: completedAt,
      searchRadiusMeters: params.searchRadiusMeters,
      searchCenter: params.searchCenter,
      candidatesEvaluated: params.candidates.length,
      candidates: params.candidates,
      selectedDriverId: null,
      selectionCriteria: "none",
      outcome,
      failureCode: params.failureCode,
    });
  }
}
