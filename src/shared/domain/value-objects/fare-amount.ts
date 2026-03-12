import { Result } from "../../core/result.js";
import { ValidationError } from "../../errors/error-types.js";
import { MoneyCOP } from "./money-cop.js";

/**
 * Policy for fare amount calculation.
 * Injected to avoid baking rigid global minimums into shared VOs.
 */
export type FarePolicy = {
  readonly minimumFareCOP: number;
};

/**
 * FareAmount represents a fare after applying deterministic rounding and policy-driven minimum.
 *
 * Why policy input:
 * - PRD states minimum fare is a business default (5000 COP for Bogota)
 * - Baking a single global minimum into a shared VO creates rigidity
 * - Different markets may have different minimums
 * - Policy can evolve without changing VO implementation
 *
 * Invariants:
 * - Applies Math.ceil rounding to raw amount
 * - Enforces minimum via explicit policy parameter
 * - Final amount is finite integer >= 0
 * - Validates policy.minimumFareCOP is valid (affects correctness)
 */
export class FareAmount {
  readonly #amount: number;
  readonly #minimumApplied: boolean;

  private constructor(amount: number, minimumApplied: boolean) {
    this.#amount = amount;
    this.#minimumApplied = minimumApplied;
  }

  /**
   * Create FareAmount with deterministic rounding and policy-driven minimum.
   */
  static create(
    rawAmount: number,
    policy: FarePolicy
  ): Result<FareAmount, ValidationError> {
    if (!Number.isFinite(policy.minimumFareCOP)) {
      return Result.err(
        new ValidationError("FarePolicy minimumFareCOP must be finite")
      );
    }

    if (!Number.isInteger(policy.minimumFareCOP)) {
      return Result.err(
        new ValidationError("FarePolicy minimumFareCOP must be an integer")
      );
    }

    if (policy.minimumFareCOP < 0) {
      return Result.err(
        new ValidationError("FarePolicy minimumFareCOP must be non-negative")
      );
    }

    if (!Number.isFinite(rawAmount)) {
      return Result.err(
        new ValidationError("FareAmount raw amount must be finite")
      );
    }

    const ceiled = Math.ceil(rawAmount);
    const minimumApplied = ceiled < policy.minimumFareCOP;
    const finalAmount = Math.max(ceiled, policy.minimumFareCOP);

    if (!Number.isFinite(finalAmount)) {
      return Result.err(
        new ValidationError("FareAmount final amount must be finite")
      );
    }

    if (!Number.isInteger(finalAmount)) {
      return Result.err(
        new ValidationError("FareAmount final amount must be an integer")
      );
    }

    if (finalAmount < 0) {
      return Result.err(
        new ValidationError("FareAmount final amount must be non-negative")
      );
    }

    return Result.ok(new FareAmount(finalAmount, minimumApplied));
  }

  /**
   * Reconstitute from trusted persistence (no validation).
   * Use only for rehydrating from database records where amount and minimumApplied
   * are known-good values.
   */
  static fromTrusted(amount: number, minimumApplied: boolean): FareAmount {
    return new FareAmount(amount, minimumApplied);
  }

  get amount(): number {
    return this.#amount;
  }

  get minimumApplied(): boolean {
    return this.#minimumApplied;
  }

  /**
   * Convert to MoneyCOP for monetary operations.
   */
  toMoney(): MoneyCOP {
    return MoneyCOP.fromTrusted(this.#amount);
  }

  equals(other: FareAmount): boolean {
    return (
      this.#amount === other.#amount &&
      this.#minimumApplied === other.#minimumApplied
    );
  }
}
