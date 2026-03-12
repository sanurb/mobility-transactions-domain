/**
 * Fake implementations of ports for testing.
 *
 * These are in-memory fakes that enforce port contracts without I/O.
 */

import { createId } from "@paralleldrive/cuid2";
import { Result } from "../../../../shared/core/result.js";
import {
  ConflictError,
  type DomainError,
} from "../../../../shared/errors/error-types.js";
import type { RideId } from "../../../../shared/types/ids/index.js";
import type {
  ClockPort,
  FareRecord,
  FareRepositoryPort,
} from "../../application/ports/index.js";

/**
 * FakeFareRepository - In-memory implementation for testing.
 *
 * Enforces write-once semantics (one fare per rideId).
 */
export class FakeFareRepository implements FareRepositoryPort {
  private readonly fares = new Map<string, FareRecord>();

  async save(
    record: Omit<FareRecord, "id" | "createdAtUTC">
  ): Promise<Result<FareRecord, DomainError>> {
    const rideIdKey = record.rideId as string;

    // Check for duplicate
    if (this.fares.has(rideIdKey)) {
      return Result.err(
        new ConflictError("Fare already calculated for ride", {
          currentState: "CALCULATED",
          attemptedAction: "calculate fare",
        })
      );
    }

    // Create full record
    const fullRecord: FareRecord = {
      id: createId(),
      ...record,
      createdAtUTC: new Date().toISOString(),
    };

    this.fares.set(rideIdKey, fullRecord);
    return Result.ok(fullRecord);
  }

  async findByRideId(
    rideId: RideId
  ): Promise<Result<FareRecord | null, DomainError>> {
    const rideIdKey = rideId as string;
    const fare = this.fares.get(rideIdKey) ?? null;
    return Result.ok(fare);
  }

  // Test helper: reset state
  reset(): void {
    this.fares.clear();
  }

  // Test helper: get all fares
  getAll(): FareRecord[] {
    return Array.from(this.fares.values());
  }
}

/**
 * FakeClock - Fixed time for deterministic testing.
 */
export class FakeClock implements ClockPort {
  constructor(private fixedTime = "2026-02-13T10:00:00.000Z") {}

  now(): string {
    return this.fixedTime;
  }

  // Test helper: set fixed time
  setTime(isoString: string): void {
    this.fixedTime = isoString;
  }
}
