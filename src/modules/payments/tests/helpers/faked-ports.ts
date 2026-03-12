/**
 * Faked Ports for Payment Use Case Tests
 *
 * In-memory implementations of application ports for unit testing.
 * Fakes MUST implement real port interfaces (compile-time enforcement).
 */

import { Result } from "../../../../shared/core/result.js";
import type { IdempotencyKey } from "../../../../shared/domain/value-objects/idempotency-key.js";
import type { MoneyCOP } from "../../../../shared/domain/value-objects/money-cop.js";
import type { DomainError } from "../../../../shared/errors/error-types.js";
import type {
  PaymentIntentId,
  RideId,
  RiderId,
} from "../../../../shared/types/ids/index.js";
import type {
  ChargeParams,
  ChargeResult,
  ClockPort,
  IdGeneratorPort,
  OutboxEnvelope,
  OutboxPort,
  OutboxRecord,
  PaymentProviderPort,
  PaymentRepositoryPort,
  PaymentsTx,
  UnitOfWorkPort,
} from "../../application/ports/index.js";
import { PaymentIntent } from "../../domain/payment-intent.aggregate.js";
import type { FareBreakdownRef } from "../../domain/payment-types.js";

/**
 * FakePaymentRepository - in-memory storage with reconstitution
 *
 * Simulates real persistence by creating independent snapshots on save/load.
 * This ensures tests catch issues where aggregate mutations leak across boundaries.
 */
export class FakePaymentRepository implements PaymentRepositoryPort {
  readonly #intents = new Map<
    string,
    {
      id: PaymentIntentId;
      rideId: RideId;
      riderId: RiderId;
      amountCOP: typeof MoneyCOP;
      fareBreakdown: FareBreakdownRef;
      createdAtUTC: string;
      version: number;
      attempts: Array<{
        paymentIntentId: PaymentIntentId;
        attemptNumber: number;
        idempotencyKey: typeof IdempotencyKey;
        outcome: "SUCCEEDED" | "DECLINED" | "FAILED" | "UNKNOWN" | "PENDING";
        providerRef: string | null;
        reasonCode: string | null;
        initiatedAtUTC: string;
        completedAtUTC: string | null;
      }>;
    }
  >();

  async save(aggregate: PaymentIntent, _tx: PaymentsTx): Promise<void> {
    // Create snapshot (independent copy) to simulate persistence
    const snapshot = {
      id: aggregate.id,
      rideId: aggregate.rideId,
      riderId: aggregate.riderId,
      amountCOP: aggregate.amountCOP,
      fareBreakdown: aggregate.fareBreakdown,
      createdAtUTC: aggregate.createdAtUTC,
      version: aggregate.getVersion(),
      attempts: aggregate.attempts.map((a) => ({
        paymentIntentId: a.paymentIntentId,
        attemptNumber: a.attemptNumber,
        idempotencyKey: a.idempotencyKey,
        outcome: a.outcome,
        providerRef: a.providerRef,
        reasonCode: a.reasonCode,
        initiatedAtUTC: a.initiatedAtUTC,
        completedAtUTC: a.completedAtUTC,
      })),
    };
    this.#intents.set(String(aggregate.id), snapshot as never);
  }

  async findById(id: PaymentIntentId): Promise<PaymentIntent | null> {
    const snapshot = this.#intents.get(String(id));
    if (!snapshot) {
      return null;
    }

    // Reconstitute from snapshot (independent instance)
    return PaymentIntent.reconstitute(snapshot as never);
  }

  async findByRideId(rideId: RideId): Promise<PaymentIntent | null> {
    for (const snapshot of this.#intents.values()) {
      if (String(snapshot.rideId) === String(rideId)) {
        // Reconstitute from snapshot (independent instance)
        return PaymentIntent.reconstitute(snapshot as never);
      }
    }
    return null;
  }

  reset(): void {
    this.#intents.clear();
  }
}

/**
 * FakeOutbox - stores enqueued envelopes; fetch/mark are no-ops for unit tests.
 */
export class FakeOutbox implements OutboxPort {
  readonly #enqueued: OutboxEnvelope[] = [];

  async enqueue(
    envelopes: readonly OutboxEnvelope[],
    _tx: PaymentsTx
  ): Promise<void> {
    this.#enqueued.push(...envelopes);
  }

  async fetchUnpublished(_limit: number): Promise<readonly OutboxRecord[]> {
    return [];
  }

  async markPublished(
    _ids: readonly string[],
    _publishedAtUTC: string
  ): Promise<void> {}

  async markFailed(
    _id: string,
    _error: string,
    _failedAtUTC: string
  ): Promise<void> {}

  get enqueued(): readonly OutboxEnvelope[] {
    return [...this.#enqueued];
  }

  reset(): void {
    this.#enqueued.length = 0;
  }
}

/**
 * FakeClock - returns configured ISO string
 */
export class FakeClock implements ClockPort {
  #nowUTC: string;

  constructor(nowUTC?: string) {
    this.#nowUTC = nowUTC ?? new Date().toISOString();
  }

  nowUTC(): string {
    return this.#nowUTC;
  }

  setNowUTC(nowUTC: string): void {
    this.#nowUTC = nowUTC;
  }
}

/**
 * FakePaymentProvider - returns configured outcome
 */
export class FakePaymentProvider implements PaymentProviderPort {
  #outcome: "SUCCEEDED" | "DECLINED" | "FAILED" | "UNKNOWN";
  #providerRef: string | null;
  #reasonCode: string | null;

  constructor(
    outcome: "SUCCEEDED" | "DECLINED" | "FAILED" | "UNKNOWN" = "SUCCEEDED",
    providerRef: string | null = "fake-provider-ref",
    reasonCode: string | null = null
  ) {
    this.#outcome = outcome;
    this.#providerRef = providerRef;
    this.#reasonCode = reasonCode;
  }

  async charge(
    _params: ChargeParams
  ): Promise<Result<ChargeResult, DomainError>> {
    const completedAtUTC = new Date().toISOString();
    if (this.#outcome === "SUCCEEDED") {
      return Result.ok({
        outcome: this.#outcome,
        providerRef: this.#providerRef ?? "fake-provider-ref",
        reasonCode: this.#reasonCode,
        completedAtUTC,
      });
    }
    return Result.ok({
      outcome: this.#outcome,
      providerRef: this.#providerRef ?? "",
      reasonCode: this.#reasonCode ?? "provider_error",
      completedAtUTC,
    });
  }

  setOutcome(
    outcome: "SUCCEEDED" | "DECLINED" | "FAILED" | "UNKNOWN",
    providerRef: string | null = null,
    reasonCode: string | null = null
  ): void {
    this.#outcome = outcome;
    this.#providerRef = providerRef;
    this.#reasonCode = reasonCode;
  }
}

/**
 * FakeUnitOfWork - no-op transaction wrapper
 */
export class FakeUnitOfWork implements UnitOfWorkPort {
  async withTransaction<T>(fn: (tx: PaymentsTx) => Promise<T>): Promise<T> {
    // Execute without real transaction boundary
    return fn({} as PaymentsTx);
  }
}

/**
 * FakeIdGenerator - returns deterministic sequential IDs for tests
 */
export class FakeIdGenerator implements IdGeneratorPort {
  #counter = 0;

  generate(): string {
    this.#counter += 1;
    return `fake-id-${this.#counter}`;
  }

  reset(): void {
    this.#counter = 0;
  }
}
