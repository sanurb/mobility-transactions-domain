/**
 * Dispatch Process Store Port
 *
 * Saga progress persistence for idempotency and retry handling.
 * Enables deterministic replay of dispatch operations by correlationId.
 */

import type { Result } from "../../../../shared/core/result.js";
import type { DomainError } from "../../../../shared/errors/error-types.js";

/**
 * Dispatch process status
 */
export type DispatchProcessStatus = "IN_PROGRESS" | "SUCCEEDED" | "FAILED";

/**
 * Dispatch process state
 */
export interface DispatchProcessState {
  tenantId: string;
  correlationId: string;
  rideId: string;
  status: DispatchProcessStatus;
  driverId: string | null;
  failureCode: string | null;
  createdAt: string;
  completedAt: string | null;
}

/**
 * Parameters for querying by correlation ID
 */
export interface GetByCorrelationIdParams {
  tenantId: string;
  correlationId: string;
}

/**
 * Parameters for creating a process record if absent
 */
export interface CreateIfAbsentParams {
  tenantId: string;
  correlationId: string;
  rideId: string;
  createdAt: string;
}

/**
 * Parameters for marking process as succeeded
 */
export interface MarkSucceededParams {
  tenantId: string;
  correlationId: string;
  driverId: string;
  completedAt: string;
}

/**
 * Parameters for marking process as failed
 */
export interface MarkFailedParams {
  tenantId: string;
  correlationId: string;
  failureCode: string;
  completedAt: string;
}

/**
 * Dispatch Process Store Port
 */
export interface DispatchProcessStore {
  /**
   * Get dispatch process state by correlation ID
   *
   * @param params - Query parameters
   * @returns Result with process state or null if not found
   */
  getByCorrelationId(
    params: GetByCorrelationIdParams
  ): Promise<Result<DispatchProcessState | null, DomainError>>;

  /**
   * Create a process record if it doesn't already exist
   *
   * @param params - Creation parameters
   * @returns Result with process state
   */
  createIfAbsent(
    params: CreateIfAbsentParams
  ): Promise<Result<DispatchProcessState, DomainError>>;

  /**
   * Mark a process as succeeded
   *
   * @param params - Update parameters
   * @returns Result with void on success
   */
  markSucceeded(
    params: MarkSucceededParams
  ): Promise<Result<void, DomainError>>;

  /**
   * Mark a process as failed
   *
   * @param params - Update parameters
   * @returns Result with void on success
   */
  markFailed(params: MarkFailedParams): Promise<Result<void, DomainError>>;
}
