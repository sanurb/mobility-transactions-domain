/**
 * ExpireStaleRides Use Case
 *
 * Business intent: Automatically expire rides that have exceeded their timeout
 *
 * Orchestrates:
 * 1. Find expired rides via repository
 * 2. For each expired ride, transition to EXPIRED state
 * 3. Return explicit outcome summary (operational clarity)
 *
 * Individual transition failures are tracked but don't fail entire batch.
 * MUST NOT swallow errors silently - returns detailed summary.
 */

import { Result } from "../../../../shared/core/result.js";
import type { DomainError } from "../../../../shared/errors/error-types.js";
import { RIDE_STATES } from "../../domain/ride-states.js";
import type { ClockPort } from "../ports/clock.port.js";
import type { RideRepositoryPort } from "../ports/ride-repository.port.js";

/**
 * Input for ExpireStaleRides use case
 */
export interface ExpireStaleRidesInput {
  batchSize?: number;
}

/**
 * Outcome summary for batch expiration operation
 */
export interface ExpireStaleRidesOutput {
  processedCount: number;
  expiredCount: number;
  conflictCount: number;
  failedCount: number;
}

/**
 * ExpireStaleRides Use Case
 */
export class ExpireStaleRidesUseCase {
  private static readonly DEFAULT_BATCH_SIZE = 100;

  constructor(
    private readonly repository: RideRepositoryPort,
    private readonly clock: ClockPort
  ) {}

  async execute(
    input: ExpireStaleRidesInput = {}
  ): Promise<Result<ExpireStaleRidesOutput, DomainError>> {
    const batchSize =
      input.batchSize ?? ExpireStaleRidesUseCase.DEFAULT_BATCH_SIZE;
    const nowUTC = this.clock.now();

    // Find expired rides
    const findResult = await this.repository.findExpired({
      nowUTC,
      limit: batchSize,
    });

    if (findResult.isErr()) {
      return findResult;
    }

    const expiredRides = findResult.value;

    // Initialize counters
    let expiredCount = 0;
    let conflictCount = 0;
    let failedCount = 0;

    // Process each expired ride
    for (const ride of expiredRides) {
      // Transition to EXPIRED
      const transitionResult = ride.transition({
        toState: RIDE_STATES.EXPIRED,
        changedBy: "system",
        changedByRole: "system",
        reason: "Expiration policy exceeded",
        nowUTC,
      });

      if (transitionResult.isErr()) {
        // Domain error (e.g., terminal state, invalid transition)
        failedCount++;
        continue;
      }

      // Persist
      const saveResult = await this.repository.save(ride);

      if (saveResult.isErr()) {
        const error = saveResult.error;
        // Distinguish conflict (concurrent update) from other failures
        if (error._tag === "CONFLICT") {
          conflictCount++;
        } else {
          failedCount++;
        }
      } else {
        expiredCount++;
      }
    }

    return Result.ok({
      processedCount: expiredRides.length,
      expiredCount,
      conflictCount,
      failedCount,
    });
  }
}
