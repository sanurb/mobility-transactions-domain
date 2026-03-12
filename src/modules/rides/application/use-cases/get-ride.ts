/**
 * GetRide Use Case
 *
 * Business intent: Retrieve a single ride by ID
 *
 * Simple query - no domain logic, just I/O orchestration.
 */

import type { Result } from "../../../../shared/core/result.js";
import type { DomainError } from "../../../../shared/errors/error-types.js";
import type { RideId } from "../../../../shared/types/ids/ride-id.js";
import type { Ride } from "../../domain/ride.aggregate.js";
import type { RideRepositoryPort } from "../ports/ride-repository.port.js";

/**
 * Input for GetRide use case
 */
export interface GetRideInput {
  rideId: RideId;
}

/**
 * GetRide Use Case
 */
export class GetRideUseCase {
  constructor(private readonly repository: RideRepositoryPort) {}

  async execute(
    input: GetRideInput
  ): Promise<Result<Ride | null, DomainError>> {
    return this.repository.findById(input.rideId);
  }
}
