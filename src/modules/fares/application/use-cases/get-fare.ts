/**
 * GetFare Use Case - Load fare by ride ID
 *
 * Simple query use case that delegates to repository.
 */

import type { Result } from "../../../../shared/core/result.js";
import type { DomainError } from "../../../../shared/errors/error-types.js";
import type { RideId } from "../../../../shared/types/ids/index.js";
import type { FareRecord, FareRepositoryPort } from "../ports/index.js";

/**
 * GetFare Use Case - Load fare calculation by ride ID.
 *
 * Returns null if not found (not an error condition).
 */
export class GetFareUseCase {
  constructor(private readonly repository: FareRepositoryPort) {}

  async execute(
    rideId: RideId
  ): Promise<Result<FareRecord | null, DomainError>> {
    return this.repository.findByRideId(rideId);
  }
}
