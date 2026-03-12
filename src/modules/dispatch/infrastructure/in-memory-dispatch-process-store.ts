/**
 * In-Memory Dispatch Process Store
 *
 * In-memory implementation of DispatchProcessStore for initial launch.
 * Stores saga state in memory (lost on restart).
 *
 * TODO: Replace with persistent implementation (Sequelize model) in Phase 4.
 */

import { ok, type Result } from "../../../shared/core/result.js";
import type { DomainError } from "../../../shared/errors/error-types.js";
import type {
  CreateIfAbsentParams,
  DispatchProcessState,
  DispatchProcessStore,
  GetByCorrelationIdParams,
  MarkFailedParams,
  MarkSucceededParams,
} from "../application/ports/dispatch-process-store.port.js";

/**
 * In-Memory Dispatch Process Store
 */
export class InMemoryDispatchProcessStore implements DispatchProcessStore {
  private readonly processes: Map<string, DispatchProcessState> = new Map();

  async getByCorrelationId(
    params: GetByCorrelationIdParams
  ): Promise<Result<DispatchProcessState | null, DomainError>> {
    const key = this.makeKey(params.tenantId, params.correlationId);
    const state = this.processes.get(key);
    return ok(state ?? null);
  }

  async createIfAbsent(
    params: CreateIfAbsentParams
  ): Promise<Result<DispatchProcessState, DomainError>> {
    const key = this.makeKey(params.tenantId, params.correlationId);

    // Check if already exists
    const existing = this.processes.get(key);
    if (existing) {
      return ok(existing);
    }

    // Create new record
    const state: DispatchProcessState = {
      tenantId: params.tenantId,
      correlationId: params.correlationId,
      rideId: params.rideId,
      status: "IN_PROGRESS",
      driverId: null,
      failureCode: null,
      createdAt: params.createdAt,
      completedAt: null,
    };

    this.processes.set(key, state);
    return ok(state);
  }

  async markSucceeded(
    params: MarkSucceededParams
  ): Promise<Result<void, DomainError>> {
    const key = this.makeKey(params.tenantId, params.correlationId);
    const state = this.processes.get(key);

    if (state) {
      state.status = "SUCCEEDED";
      state.driverId = params.driverId;
      state.completedAt = params.completedAt;
    }

    return ok(undefined);
  }

  async markFailed(
    params: MarkFailedParams
  ): Promise<Result<void, DomainError>> {
    const key = this.makeKey(params.tenantId, params.correlationId);
    const state = this.processes.get(key);

    if (state) {
      state.status = "FAILED";
      state.failureCode = params.failureCode;
      state.completedAt = params.completedAt;
    }

    return ok(undefined);
  }

  /**
   * Make composite key for tenant + correlationId
   */
  private makeKey(tenantId: string, correlationId: string): string {
    return `${tenantId}:${correlationId}`;
  }

  /**
   * Clear all records (for testing)
   */
  clear(): void {
    this.processes.clear();
  }
}

/**
 * Factory function to create an in-memory dispatch process store
 */
export const createInMemoryDispatchProcessStore = (): DispatchProcessStore => {
  return new InMemoryDispatchProcessStore();
};
