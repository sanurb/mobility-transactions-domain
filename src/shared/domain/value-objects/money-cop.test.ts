import { describe, expect, it } from "vitest";
import { MoneyCOP } from "./money-cop.js";
import { buildMoneyCOP } from "./test/data/build-money-cop.js";

describe("MoneyCOP", () => {
  describe("create", () => {
    it("When valid amount provided, then returns ok result with COP currency", () => {
      const amount = 10_000;

      const result = MoneyCOP.create(amount);

      expect(result.unwrap().amount).toBe(amount);
      expect(result.unwrap().currency).toBe("COP");
    });

    it("When negative amount provided, then rejects with validation error", () => {
      const negativeAmount = -100;

      const result = MoneyCOP.create(negativeAmount);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toMatchObject({
          message: expect.stringContaining("non-negative"),
        });
      }
    });

    it("When non-integer amount provided, then rejects with validation error", () => {
      const decimalAmount = 100.5;

      const result = MoneyCOP.create(decimalAmount);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toMatchObject({
          message: expect.stringContaining("integer"),
        });
      }
    });

    it("When NaN provided, then rejects with validation error", () => {
      const nanAmount = Number.NaN;

      const result = MoneyCOP.create(nanAmount);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toMatchObject({
          message: expect.stringContaining("finite"),
        });
      }
    });

    it("When Infinity provided, then rejects with validation error", () => {
      const infiniteAmount = Number.POSITIVE_INFINITY;

      const result = MoneyCOP.create(infiniteAmount);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toMatchObject({
          message: expect.stringContaining("finite"),
        });
      }
    });
  });

  describe("add", () => {
    it("When adding two amounts, then sums amounts correctly", () => {
      const money1 = buildMoneyCOP({ amount: 5000 });
      const money2 = buildMoneyCOP({ amount: 3000 });
      const expectedSum = 8000;

      const result = money1.add(money2);

      expect(result.amount).toBe(expectedSum);
    });
  });

  describe("equals", () => {
    it("When amounts are equal, then returns true", () => {
      const amount = 5000;
      const money1 = buildMoneyCOP({ amount });
      const money2 = buildMoneyCOP({ amount });

      const result = money1.equals(money2);

      expect(result).toBe(true);
    });

    it("When amounts differ, then returns false", () => {
      const money1 = buildMoneyCOP({ amount: 5000 });
      const money2 = buildMoneyCOP({ amount: 3000 });

      const result = money1.equals(money2);

      expect(result).toBe(false);
    });
  });

  describe("isZero", () => {
    it("When amount is zero, then returns true", () => {
      const zeroMoney = buildMoneyCOP({ amount: 0 });

      const result = zeroMoney.isZero();

      expect(result).toBe(true);
    });

    it("When amount is non-zero, then returns false", () => {
      const nonZeroMoney = buildMoneyCOP({ amount: 100 });

      const result = nonZeroMoney.isZero();

      expect(result).toBe(false);
    });
  });

  describe("isGreaterThan", () => {
    it("When first amount is greater, then returns true", () => {
      const money1 = buildMoneyCOP({ amount: 10_000 });
      const money2 = buildMoneyCOP({ amount: 5000 });

      const result = money1.isGreaterThan(money2);

      expect(result).toBe(true);
    });

    it("When first amount is smaller, then returns false", () => {
      const money1 = buildMoneyCOP({ amount: 3000 });
      const money2 = buildMoneyCOP({ amount: 5000 });

      const result = money1.isGreaterThan(money2);

      expect(result).toBe(false);
    });
  });

  describe("fromTrusted", () => {
    it("When called with valid amount, then returns instance without validation", () => {
      const trustedAmount = 7500;

      const result = MoneyCOP.fromTrusted(trustedAmount);

      expect(result.amount).toBe(trustedAmount);
      expect(result.currency).toBe("COP");
    });
  });
});
