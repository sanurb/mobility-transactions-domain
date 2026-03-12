import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { MoneyCOP } from "../../../../shared/domain/value-objects/money-cop.js";
import {
  unsafePaymentIntentId,
  unsafeRideId,
  unsafeRiderId,
} from "../../../../shared/types/ids/index.js";
import { PaymentIntent } from "../../domain/payment-intent.aggregate.js";
import {
  buildFareBreakdown,
  buildIdempotencyKey,
} from "../helpers/payment-test-factories.js";

describe("PaymentIntent Aggregate", () => {
  describe("create", () => {
    test("When creating with valid props, then it records PaymentIntentCreated", () => {
      const id = unsafePaymentIntentId(randomUUID());
      const rideId = unsafeRideId(randomUUID());
      const riderId = unsafeRiderId(randomUUID());
      const amountCOP = MoneyCOP.fromTrusted(25_000);

      const intent = PaymentIntent.create({
        id,
        rideId,
        riderId,
        amountCOP,
        fareBreakdown: buildFareBreakdown(),
        createdAtUTC: "2026-02-13T10:00:00.000Z",
      });

      const events = intent.pullDomainEvents();
      expect(events).toHaveLength(1);
      const firstEvent = events.at(0);
      expect(firstEvent?.eventType).toBe("PaymentIntentCreated");
    });
  });

  describe("attemptSettlement - success", () => {
    test("When first attempt succeeds, then it records SettlementSucceeded and status becomes PAID", () => {
      const intent = PaymentIntent.create({
        id: unsafePaymentIntentId(randomUUID()),
        rideId: unsafeRideId(randomUUID()),
        riderId: unsafeRiderId(randomUUID()),
        amountCOP: MoneyCOP.fromTrusted(25_000),
        fareBreakdown: buildFareBreakdown(),
        createdAtUTC: "2026-02-13T10:00:00.000Z",
      });
      intent.pullDomainEvents();

      const result = intent.attemptSettlement({
        idempotencyKey: buildIdempotencyKey(),
        outcome: "SUCCEEDED",
        providerRef: "provider-ref-123",
        reasonCode: null,
        initiatedAtUTC: "2026-02-13T10:01:00.000Z",
        completedAtUTC: "2026-02-13T10:01:05.000Z",
      });

      expect(result.isOk()).toBe(true);
      expect(intent.paymentStatus).toBe("PAID");
      const events = intent.pullDomainEvents();
      expect(events).toContainEqual(
        expect.objectContaining({ eventType: "SettlementSucceeded" })
      );
    });
  });

  describe("attemptSettlement - policy violations", () => {
    test("When attempting after SUCCEEDED, then it rejects with anti-duplication policy violation", () => {
      const intent = PaymentIntent.create({
        id: unsafePaymentIntentId(randomUUID()),
        rideId: unsafeRideId(randomUUID()),
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

      const result = intent.attemptSettlement({
        idempotencyKey: buildIdempotencyKey(),
        outcome: "SUCCEEDED",
        providerRef: "provider-ref-456",
        reasonCode: null,
        initiatedAtUTC: "2026-02-13T10:02:00.000Z",
        completedAtUTC: "2026-02-13T10:02:05.000Z",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toMatchObject({
          policyName: "PAYMENT_ANTI_DUPLICATION",
        });
      }
    });

    test("When exceeding attempt limit, then it rejects with attempt-limit violation", () => {
      const intent = PaymentIntent.create({
        id: unsafePaymentIntentId(randomUUID()),
        rideId: unsafeRideId(randomUUID()),
        riderId: unsafeRiderId(randomUUID()),
        amountCOP: MoneyCOP.fromTrusted(25_000),
        fareBreakdown: buildFareBreakdown(),
        createdAtUTC: "2026-02-13T10:00:00.000Z",
      });
      intent.attemptSettlement({
        idempotencyKey: buildIdempotencyKey({ value: "attempt-1" }),
        outcome: "FAILED",
        providerRef: null,
        reasonCode: "network_error",
        initiatedAtUTC: "2026-02-13T10:01:00.000Z",
        completedAtUTC: "2026-02-13T10:01:05.000Z",
      });
      intent.attemptSettlement({
        idempotencyKey: buildIdempotencyKey({ value: "attempt-2" }),
        outcome: "FAILED",
        providerRef: null,
        reasonCode: "network_error",
        initiatedAtUTC: "2026-02-13T10:02:00.000Z",
        completedAtUTC: "2026-02-13T10:02:05.000Z",
      });
      intent.attemptSettlement({
        idempotencyKey: buildIdempotencyKey({ value: "attempt-3" }),
        outcome: "FAILED",
        providerRef: null,
        reasonCode: "network_error",
        initiatedAtUTC: "2026-02-13T10:03:00.000Z",
        completedAtUTC: "2026-02-13T10:03:05.000Z",
      });

      const result = intent.attemptSettlement({
        idempotencyKey: buildIdempotencyKey({ value: "attempt-4" }),
        outcome: "FAILED",
        providerRef: null,
        reasonCode: "network_error",
        initiatedAtUTC: "2026-02-13T10:04:00.000Z",
        completedAtUTC: "2026-02-13T10:04:05.000Z",
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toMatchObject({
          policyName: "PAYMENT_ATTEMPT_LIMIT",
        });
      }
    });

    test("When declined requires action, then it rejects subsequent attempt until acknowledgment", () => {
      const intent = PaymentIntent.create({
        id: unsafePaymentIntentId(randomUUID()),
        rideId: unsafeRideId(randomUUID()),
        riderId: unsafeRiderId(randomUUID()),
        amountCOP: MoneyCOP.fromTrusted(25_000),
        fareBreakdown: buildFareBreakdown(),
        createdAtUTC: "2026-02-13T10:00:00.000Z",
      });
      intent.attemptSettlement({
        idempotencyKey: buildIdempotencyKey({ value: "attempt-1" }),
        outcome: "DECLINED",
        providerRef: "provider-ref-123",
        reasonCode: "insufficient_funds",
        initiatedAtUTC: "2026-02-13T10:01:00.000Z",
        completedAtUTC: "2026-02-13T10:01:05.000Z",
      });

      const result = intent.attemptSettlement({
        idempotencyKey: buildIdempotencyKey({ value: "attempt-2" }),
        outcome: "DECLINED",
        providerRef: "provider-ref-456",
        reasonCode: "insufficient_funds",
        initiatedAtUTC: "2026-02-13T10:02:00.000Z",
        completedAtUTC: "2026-02-13T10:02:05.000Z",
        riderAcknowledgedDecline: false,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toMatchObject({
          policyName: "PAYMENT_DECLINED_ACTION_REQUIRED",
        });
      }
    });
  });

  describe("paymentStatus", () => {
    test("When no successful settlement exists, then status is UNPAID", () => {
      const intent = PaymentIntent.create({
        id: unsafePaymentIntentId(randomUUID()),
        rideId: unsafeRideId(randomUUID()),
        riderId: unsafeRiderId(randomUUID()),
        amountCOP: MoneyCOP.fromTrusted(25_000),
        fareBreakdown: buildFareBreakdown(),
        createdAtUTC: "2026-02-13T10:00:00.000Z",
      });

      const status = intent.paymentStatus;

      expect(status).toBe("UNPAID");
    });
  });

  describe("attemptSettlement - idempotency", () => {
    test("When duplicate idempotency key, then it returns existing attempt without new events", () => {
      const intent = PaymentIntent.create({
        id: unsafePaymentIntentId(randomUUID()),
        rideId: unsafeRideId(randomUUID()),
        riderId: unsafeRiderId(randomUUID()),
        amountCOP: MoneyCOP.fromTrusted(25_000),
        fareBreakdown: buildFareBreakdown(),
        createdAtUTC: "2026-02-13T10:00:00.000Z",
      });
      const idempotencyKey = buildIdempotencyKey({ value: "attempt-1" });
      const firstResult = intent.attemptSettlement({
        idempotencyKey,
        outcome: "SUCCEEDED",
        providerRef: "provider-ref-123",
        reasonCode: null,
        initiatedAtUTC: "2026-02-13T10:01:00.000Z",
        completedAtUTC: "2026-02-13T10:01:05.000Z",
      });
      intent.pullDomainEvents();

      const secondResult = intent.attemptSettlement({
        idempotencyKey,
        outcome: "SUCCEEDED",
        providerRef: "provider-ref-456",
        reasonCode: null,
        initiatedAtUTC: "2026-02-13T10:02:00.000Z",
        completedAtUTC: "2026-02-13T10:02:05.000Z",
      });

      expect(secondResult.isOk()).toBe(true);
      expect(secondResult.unwrap()).toBe(firstResult.unwrap());
      expect(intent.pullDomainEvents()).toHaveLength(0);
    });
  });
});
