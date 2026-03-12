/**
 * Faked Ports for Dispatch Testing
 *
 * Test doubles for external ports used by dispatch.
 * Provides predictable, in-memory implementations for unit tests.
 */

import { ok, Result } from "../../../../shared/core/result.js";
import type { DomainError } from "../../../../shared/errors/error-types.js";
import {
  ConflictError,
  ValidationError,
} from "../../../../shared/errors/error-types.js";
import type {
  DispatchAuditRecord,
  DispatchAuditWriter,
} from "../../application/ports/dispatch-audit-writer.port.js";
import type {
  CreateIfAbsentParams,
  DispatchProcessState,
  DispatchProcessStore,
  GetByCorrelationIdParams,
  MarkFailedParams,
  MarkSucceededParams,
} from "../../application/ports/dispatch-process-store.port.js";
import type {
  RideAssignmentPort,
  TransitionRideToAssignedParams,
} from "../../application/ports/ride-assignment.port.js";

/**
 * Fake Ride Assignment Port
 *
 * Simulates ride state transitions for dispatch testing.
 * Can be configured to succeed or fail.
 */
export class FakeRideAssignmentPort implements RideAssignmentPort {
  private shouldFail = false;

  setFailure(fail: boolean): void {
    this.shouldFail = fail;
  }

  async transitionRideToAssigned(
    _params: TransitionRideToAssignedParams
  ): Promise<Result<void, DomainError>> {
    if (this.shouldFail) {
      return Result.err(
        new ValidationError(
          "RIDE_NOT_FOUND",
          "Ride not found or not in DISPATCHING state"
        )
      );
    }
    return ok(undefined);
  }
}

/**
 * Fake Dispatch Audit Writer
 *
 * In-memory audit trail for testing.
 */
export class FakeDispatchAuditWriter implements DispatchAuditWriter {
  private records: DispatchAuditRecord[] = [];

  async writeDispatchAttempt(
    record: DispatchAuditRecord
  ): Promise<Result<void, DomainError>> {
    this.records.push(record);
    return ok(undefined);
  }

  getRecords(): readonly DispatchAuditRecord[] {
    return this.records;
  }

  reset(): void {
    this.records = [];
  }
}

/**
 * Fake Dispatch Process Store
 *
 * In-memory process state for testing.
 */
export class FakeDispatchProcessStore implements DispatchProcessStore {
  private states = new Map<string, DispatchProcessState>();

  async getByCorrelationId(
    params: GetByCorrelationIdParams
  ): Promise<Result<DispatchProcessState | null, DomainError>> {
    const key = `${params.tenantId}:${params.correlationId}`;
    const state = this.states.get(key) ?? null;
    return ok(state);
  }

  async createIfAbsent(
    params: CreateIfAbsentParams
  ): Promise<Result<DispatchProcessState, DomainError>> {
    const key = `${params.tenantId}:${params.correlationId}`;
    if (this.states.has(key)) {
      return Result.err(
        new ConflictError("Process already exists", {
          attemptedAction: "create process",
        })
      );
    }

    const state: DispatchProcessState = {
      tenantId: params.tenantId,
      correlationId: params.correlationId,
      rideId: params.rideId,
      status: "IN_PROGRESS",
      driverId: null,
      createdAt: params.createdAt,
      completedAt: null,
      failureCode: null,
    };

    this.states.set(key, state);

    return ok(state);
  }

  async markSucceeded(
    params: MarkSucceededParams
  ): Promise<Result<void, DomainError>> {
    const key = `${params.tenantId}:${params.correlationId}`;
    const state = this.states.get(key);

    if (!state) {
      return Result.err(
        new ValidationError("PROCESS_NOT_FOUND", "Dispatch process not found")
      );
    }

    this.states.set(key, {
      ...state,
      status: "SUCCEEDED",
      driverId: params.driverId,
      completedAt: params.completedAt,
    });

    return ok(undefined);
  }

  async markFailed(
    params: MarkFailedParams
  ): Promise<Result<void, DomainError>> {
    const key = `${params.tenantId}:${params.correlationId}`;
    const state = this.states.get(key);

    if (!state) {
      return Result.err(
        new ValidationError("PROCESS_NOT_FOUND", "Dispatch process not found")
      );
    }

    this.states.set(key, {
      ...state,
      status: "FAILED",
      failureCode: params.failureCode,
      completedAt: params.completedAt,
    });

    return ok(undefined);
  }

  reset(): void {
    this.states.clear();
  }

  getState(
    tenantId: string,
    correlationId: string
  ): DispatchProcessState | null {
    const key = `${tenantId}:${correlationId}`;
    return this.states.get(key) ?? null;
  }
}
