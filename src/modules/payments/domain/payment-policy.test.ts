import { describe, expect, it } from "vitest";
import { PolicyViolationError } from "../../../shared/errors/error-types.js";
import {
  canAttemptSettlement,
  derivePaymentStatus,
  getNextAttemptNumber,
  type SettlementAttemptLike,
} from "./payment-policy.js";
import { SETTLEMENT_OUTCOMES } from "./payment-types.js";

const buildSettlementAttempt = (
  outcome: string = SETTLEMENT_OUTCOMES.FAILED
): SettlementAttemptLike => ({
  outcome: outcome as SettlementAttemptLike["outcome"],
});

describe("payment-policy", () => {
  describe("canAttemptSettlement", () => {
    describe("success cases", () => {
      it("When no prior attempts exist, then allows first attempt", () => {
        const result = canAttemptSettlement({ priorAttempts: [] });

        expect(result.isOk()).toBe(true);
        expect(result.unwrap()).toBe(true);
      });

      it("When first attempt FAILED, then allows second attempt", () => {
        const priorAttempts = [
          buildSettlementAttempt(SETTLEMENT_OUTCOMES.FAILED),
        ];

        const result = canAttemptSettlement({ priorAttempts });

        expect(result.isOk()).toBe(true);
      });

      it("When two attempts FAILED, then allows third attempt", () => {
        const priorAttempts = [
          buildSettlementAttempt(SETTLEMENT_OUTCOMES.FAILED),
          buildSettlementAttempt(SETTLEMENT_OUTCOMES.FAILED),
        ];

        const result = canAttemptSettlement({ priorAttempts });

        expect(result.isOk()).toBe(true);
      });

      it("When last attempt DECLINED and rider acknowledged, then allows retry", () => {
        const priorAttempts = [
          buildSettlementAttempt(SETTLEMENT_OUTCOMES.DECLINED),
        ];

        const result = canAttemptSettlement({
          priorAttempts,
          riderAcknowledgedDecline: true,
        });

        expect(result.isOk()).toBe(true);
      });

      it("When last attempt is UNKNOWN, then allows retry", () => {
        const priorAttempts = [
          buildSettlementAttempt(SETTLEMENT_OUTCOMES.UNKNOWN),
        ];

        const result = canAttemptSettlement({ priorAttempts });

        expect(result.isOk()).toBe(true);
      });

      it("When last attempt is PENDING, then allows retry", () => {
        const priorAttempts = [
          buildSettlementAttempt(SETTLEMENT_OUTCOMES.PENDING),
        ];

        const result = canAttemptSettlement({ priorAttempts });

        expect(result.isOk()).toBe(true);
      });
    });

    describe("anti-duplication (PAYMENT_ANTI_DUPLICATION policy)", () => {
      it("When prior attempt SUCCEEDED, then returns PolicyViolationError with PAYMENT_ANTI_DUPLICATION", () => {
        const priorAttempts = [
          buildSettlementAttempt(SETTLEMENT_OUTCOMES.SUCCEEDED),
        ];

        const result = canAttemptSettlement({ priorAttempts });

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error).toBeInstanceOf(PolicyViolationError);
          expect(result.error).toMatchObject({
            policyName: "PAYMENT_ANTI_DUPLICATION",
          });
        }
      });

      it("When SUCCEEDED is not the last attempt, then still blocks with anti-duplication", () => {
        const priorAttempts = [
          buildSettlementAttempt(SETTLEMENT_OUTCOMES.SUCCEEDED),
          buildSettlementAttempt(SETTLEMENT_OUTCOMES.FAILED),
        ];

        const result = canAttemptSettlement({ priorAttempts });

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error).toMatchObject({
            policyName: "PAYMENT_ANTI_DUPLICATION",
          });
        }
      });
    });

    describe("attempt limit (PAYMENT_ATTEMPT_LIMIT policy)", () => {
      it("When 3 prior FAILED attempts exist, then returns PolicyViolationError with PAYMENT_ATTEMPT_LIMIT", () => {
        const priorAttempts = [
          buildSettlementAttempt(SETTLEMENT_OUTCOMES.FAILED),
          buildSettlementAttempt(SETTLEMENT_OUTCOMES.FAILED),
          buildSettlementAttempt(SETTLEMENT_OUTCOMES.FAILED),
        ];

        const result = canAttemptSettlement({ priorAttempts });

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error).toBeInstanceOf(PolicyViolationError);
          expect(result.error).toMatchObject({
            policyName: "PAYMENT_ATTEMPT_LIMIT",
          });
        }
      });
    });

    describe("DECLINED handling (PAYMENT_DECLINED_ACTION_REQUIRED policy)", () => {
      it("When last attempt DECLINED and riderAcknowledgedDecline is false, then blocks attempt", () => {
        const priorAttempts = [
          buildSettlementAttempt(SETTLEMENT_OUTCOMES.DECLINED),
        ];

        const result = canAttemptSettlement({
          priorAttempts,
          riderAcknowledgedDecline: false,
        });

        expect(result.isErr()).toBe(true);
      });

      it("When last attempt DECLINED and riderAcknowledgedDecline is not provided, then returns PolicyViolationError with PAYMENT_DECLINED_ACTION_REQUIRED", () => {
        const priorAttempts = [
          buildSettlementAttempt(SETTLEMENT_OUTCOMES.DECLINED),
        ];

        const result = canAttemptSettlement({ priorAttempts });

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error).toBeInstanceOf(PolicyViolationError);
          expect(result.error).toMatchObject({
            policyName: "PAYMENT_DECLINED_ACTION_REQUIRED",
          });
        }
      });

      it("When DECLINED is not the last attempt, then allows retry", () => {
        const priorAttempts = [
          buildSettlementAttempt(SETTLEMENT_OUTCOMES.DECLINED),
          buildSettlementAttempt(SETTLEMENT_OUTCOMES.FAILED),
        ];

        const result = canAttemptSettlement({ priorAttempts });

        expect(result.isOk()).toBe(true);
      });
    });

    describe("policy priority", () => {
      it("When SUCCEEDED exists and attempt limit reached, then anti-duplication takes precedence", () => {
        const priorAttempts = [
          buildSettlementAttempt(SETTLEMENT_OUTCOMES.FAILED),
          buildSettlementAttempt(SETTLEMENT_OUTCOMES.SUCCEEDED),
          buildSettlementAttempt(SETTLEMENT_OUTCOMES.FAILED),
        ];

        const result = canAttemptSettlement({ priorAttempts });

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error).toMatchObject({
            policyName: "PAYMENT_ANTI_DUPLICATION",
          });
        }
      });
    });
  });

  describe("getNextAttemptNumber", () => {
    it("When attempts array is empty, then returns 1", () => {
      const result = getNextAttemptNumber([]);

      expect(result).toBe(1);
    });

    it("When one prior attempt exists, then returns 2", () => {
      const priorAttempts = [buildSettlementAttempt()];

      const result = getNextAttemptNumber(priorAttempts);

      expect(result).toBe(2);
    });

    it("When three prior attempts exist, then returns 4", () => {
      const priorAttempts = [
        buildSettlementAttempt(),
        buildSettlementAttempt(),
        buildSettlementAttempt(),
      ];

      const result = getNextAttemptNumber(priorAttempts);

      expect(result).toBe(4);
    });

    it("When attempts are non-sequential, then returns count-based number", () => {
      const priorAttempts = [
        buildSettlementAttempt(),
        buildSettlementAttempt(),
      ];

      const result = getNextAttemptNumber(priorAttempts);

      expect(result).toBe(3);
    });
  });

  describe("derivePaymentStatus", () => {
    it("When no attempts exist, then returns UNPAID", () => {
      const result = derivePaymentStatus([]);

      expect(result).toBe("UNPAID");
    });

    it("When no SUCCEEDED attempt exists, then returns UNPAID", () => {
      const attempts = [
        buildSettlementAttempt(SETTLEMENT_OUTCOMES.FAILED),
        buildSettlementAttempt(SETTLEMENT_OUTCOMES.DECLINED),
      ];

      const result = derivePaymentStatus(attempts);

      expect(result).toBe("UNPAID");
    });

    it("When SUCCEEDED attempt exists, then returns PAID", () => {
      const attempts = [buildSettlementAttempt(SETTLEMENT_OUTCOMES.SUCCEEDED)];

      const result = derivePaymentStatus(attempts);

      expect(result).toBe("PAID");
    });

    it("When SUCCEEDED is not the last attempt, then still returns PAID", () => {
      const attempts = [
        buildSettlementAttempt(SETTLEMENT_OUTCOMES.SUCCEEDED),
        buildSettlementAttempt(SETTLEMENT_OUTCOMES.FAILED),
      ];

      const result = derivePaymentStatus(attempts);

      expect(result).toBe("PAID");
    });

    it("When only PENDING attempts exist, then returns UNPAID", () => {
      const attempts = [buildSettlementAttempt(SETTLEMENT_OUTCOMES.PENDING)];

      const result = derivePaymentStatus(attempts);

      expect(result).toBe("UNPAID");
    });

    it("When only UNKNOWN attempts exist, then returns UNPAID", () => {
      const attempts = [buildSettlementAttempt(SETTLEMENT_OUTCOMES.UNKNOWN)];

      const result = derivePaymentStatus(attempts);

      expect(result).toBe("UNPAID");
    });
  });
});
