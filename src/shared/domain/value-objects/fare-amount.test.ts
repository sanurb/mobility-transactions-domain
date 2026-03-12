import { describe, expect, it } from "vitest";
import { FareAmount, type FarePolicy } from "./fare-amount.js";
import { buildFareAmount } from "./test/data/build-fare-amount.js";

describe("FareAmount", () => {
  describe("create", () => {
    it("When raw has decimals, then rounds up deterministically", () => {
      const rawAmount = 4567.89;
      const policy: FarePolicy = { minimumFareCOP: 5000 };
      const expectedAmount = 5000;

      const result = FareAmount.create(rawAmount, policy);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap().amount).toBe(expectedAmount);
    });

    it("When raw is below minimum, then minimumApplied is true and amount equals minimum", () => {
      const rawAmount = 3000;
      const minimumFareCOP = 5000;
      const policy: FarePolicy = { minimumFareCOP };

      const result = FareAmount.create(rawAmount, policy);

      expect(result.unwrap().amount).toBe(minimumFareCOP);
      expect(result.unwrap().minimumApplied).toBe(true);
    });

    it("When raw is above minimum, then minimumApplied is false", () => {
      const rawAmount = 8000;
      const policy: FarePolicy = { minimumFareCOP: 5000 };

      const result = FareAmount.create(rawAmount, policy);

      expect(result.unwrap().amount).toBe(rawAmount);
      expect(result.unwrap().minimumApplied).toBe(false);
    });

    it("When raw is NaN, then rejects with validation error", () => {
      const rawAmount = Number.NaN;
      const policy: FarePolicy = { minimumFareCOP: 5000 };

      const result = FareAmount.create(rawAmount, policy);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toMatchObject({
          message: expect.stringContaining("finite"),
        });
      }
    });

    it("When raw is Infinity, then rejects with validation error", () => {
      const rawAmount = Number.POSITIVE_INFINITY;
      const policy: FarePolicy = { minimumFareCOP: 5000 };

      const result = FareAmount.create(rawAmount, policy);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toMatchObject({
          message: expect.stringContaining("finite"),
        });
      }
    });

    it("When policy minimum is non-integer, then rejects with validation error", () => {
      const rawAmount = 6000;
      const policy: FarePolicy = { minimumFareCOP: 5000.5 };

      const result = FareAmount.create(rawAmount, policy);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toMatchObject({
          message: expect.stringContaining("integer"),
        });
      }
    });

    it("When policy minimum is negative, then rejects with validation error", () => {
      const rawAmount = 6000;
      const policy: FarePolicy = { minimumFareCOP: -100 };

      const result = FareAmount.create(rawAmount, policy);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toMatchObject({
          message: expect.stringContaining("non-negative"),
        });
      }
    });
  });

  describe("toMoney", () => {
    it("When converting to money, then amount and currency are correct", () => {
      const expectedAmount = 7500;
      const fareAmount = buildFareAmount({ rawAmount: expectedAmount });

      const money = fareAmount.toMoney();

      expect(money.amount).toBe(expectedAmount);
      expect(money.currency).toBe("COP");
    });
  });

  describe("equals", () => {
    it("When amounts and flags match, then returns true", () => {
      const fare1 = buildFareAmount({ rawAmount: 3000, minimumFareCOP: 5000 });
      const fare2 = buildFareAmount({ rawAmount: 4000, minimumFareCOP: 5000 });

      const result = fare1.equals(fare2);

      expect(result).toBe(true);
    });

    it("When amounts differ, then returns false", () => {
      const fare1 = buildFareAmount({ rawAmount: 8000, minimumFareCOP: 5000 });
      const fare2 = buildFareAmount({ rawAmount: 9000, minimumFareCOP: 5000 });

      const result = fare1.equals(fare2);

      expect(result).toBe(false);
    });
  });
});
