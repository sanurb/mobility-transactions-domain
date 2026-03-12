/**
 * Payment Repository Integration Tests
 *
 * Tests verify Sequelize adapter behavior with real PostgreSQL (Testcontainers).
 * INTEGRATION scope: unit-test rules do not strictly apply.
 */

import { randomUUID } from "node:crypto";
import type { Sequelize, Transaction } from "sequelize";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { MoneyCOP } from "../../../../shared/domain/value-objects/money-cop.js";
import {
  unsafePaymentIntentId,
  unsafeRideId,
  unsafeRiderId,
} from "../../../../shared/types/ids/index.js";
import {
  cleanTestDatabase,
  initTestDb,
} from "../../../../test/helpers/test-db.js";
import { PaymentRepository } from "../../adapters/outbound/payment.repository.js";
import type {
  PaymentsTx,
  PaymentsTxContext,
} from "../../application/ports/unit-of-work.port.js";
import { PaymentIntent } from "../../domain/payment-intent.aggregate.js";
import {
  buildFareBreakdown,
  buildIdempotencyKey,
} from "../helpers/payment-test-factories.js";

const TX_TOKEN = Symbol("tx") as PaymentsTx;
let currentTx: Transaction | null = null;
const txContext: PaymentsTxContext = {
  resolveSequelizeTx(tx) {
    if (tx === TX_TOKEN && currentTx) {
      return currentTx;
    }
    throw new Error(
      "PaymentRepository integration test: no active transaction"
    );
  },
};

describe("PaymentRepository Integration", () => {
  let sequelize: Sequelize;
  const repo = new PaymentRepository(txContext);

  beforeAll(async () => {
    sequelize = await initTestDb();
  });

  beforeEach(async () => {
    await cleanTestDatabase();
    currentTx = null;
  });

  test("When saving a new PaymentIntent, then findByRideId returns a fully reconstituted aggregate", async () => {
    // Arrange
    const intentId = unsafePaymentIntentId(randomUUID());
    const rideId = unsafeRideId(randomUUID());
    const intent = PaymentIntent.create({
      id: intentId,
      rideId,
      riderId: unsafeRiderId(randomUUID()),
      amountCOP: MoneyCOP.fromTrusted(25_000),
      fareBreakdown: buildFareBreakdown(),
      createdAtUTC: "2026-02-13T10:00:00.000Z",
    });
    intent.pullDomainEvents();

    // Act
    await sequelize.transaction(async (t) => {
      currentTx = t;
      await repo.save(intent, TX_TOKEN);
    });
    const loaded = await repo.findByRideId(rideId);

    // Assert
    expect(loaded).not.toBeNull();
    expect(String(loaded?.id)).toBe(String(intentId));
    expect(loaded?.amountCOP.amount).toBe(25_000);
  });

  test("When saving with settlement attempts, then attempts are persisted and reloaded", async () => {
    // Arrange
    const intentId = unsafePaymentIntentId(randomUUID());
    const rideId = unsafeRideId(randomUUID());
    const intent = PaymentIntent.create({
      id: intentId,
      rideId,
      riderId: unsafeRiderId(randomUUID()),
      amountCOP: MoneyCOP.fromTrusted(25_000),
      fareBreakdown: buildFareBreakdown(),
      createdAtUTC: "2026-02-13T10:00:00.000Z",
    });
    intent.attemptSettlement({
      idempotencyKey: buildIdempotencyKey(),
      outcome: "SUCCEEDED",
      providerRef: "provider-ref-123",
      reasonCode: null,
      initiatedAtUTC: "2026-02-13T10:01:00.000Z",
      completedAtUTC: "2026-02-13T10:01:05.000Z",
    });
    intent.pullDomainEvents();

    // Act
    await sequelize.transaction(async (t) => {
      currentTx = t;
      await repo.save(intent, TX_TOKEN);
    });
    const loaded = await repo.findByRideId(rideId);

    // Assert
    expect(loaded).not.toBeNull();
    expect(loaded?.attemptCount).toBe(1);
    expect(loaded?.paymentStatus).toBe("PAID");
  });
});
