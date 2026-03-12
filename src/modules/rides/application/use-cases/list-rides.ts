/**
 * ListRides Use Case
 *
 * Business intent: Query rides with filtering and pagination
 *
 * Simple query - no domain logic, just I/O orchestration.
 */

import type { Result } from "../../../../shared/core/result.js";
import type { DomainError } from "../../../../shared/errors/error-types.js";
import type {
  ListRidesQuery,
  ListRidesResult,
  RideRepositoryPort,
} from "../ports/ride-repository.port.js";

/**
 * ListRides Use Case
 */
export class ListRidesUseCase {
  constructor(private readonly repository: RideRepositoryPort) {}

  async execute(
    query: ListRidesQuery
  ): Promise<Result<ListRidesResult, DomainError>> {
    return this.repository.list(query);
  }
}
