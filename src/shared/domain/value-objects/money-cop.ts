import { Result } from "../../core/result.js";
import { ValidationError } from "../../errors/error-types.js";

/**
 * MoneyCOP represents Colombian Pesos (COP) as an immutable integer amount.
 *
 * Invariants:
 * - amount MUST be finite (no NaN/Infinity)
 * - amount MUST be integer
 * - amount MUST be non-negative (>= 0)
 * - currency is always 'COP' (no stringly-typed currency)
 *
 * Why: Payments-grade correctness requires strict monetary value handling.
 * Integer-only COP prevents floating-point precision errors in fare calculations.
 */
export class MoneyCOP {
  readonly #amount: number;
  readonly #currency = "COP" as const;

  private constructor(amount: number) {
    this.#amount = amount;
  }

  /**
   * Create MoneyCOP with validation.
   * Returns ValidationError if amount violates invariants.
   */
  static create(amount: number): Result<MoneyCOP, ValidationError> {
    if (!Number.isFinite(amount)) {
      return Result.err(new ValidationError("MoneyCOP amount must be finite"));
    }

    if (!Number.isInteger(amount)) {
      return Result.err(
        new ValidationError("MoneyCOP amount must be an integer")
      );
    }

    if (amount < 0) {
      return Result.err(
        new ValidationError("MoneyCOP amount must be non-negative")
      );
    }

    return Result.ok(new MoneyCOP(amount));
  }

  /**
   * Create MoneyCOP without validation (trusted source).
   * MUST be used only by outbound adapters for rehydration (DB reads).
   */
  static fromTrusted(amount: number): MoneyCOP {
    return new MoneyCOP(amount);
  }

  get amount(): number {
    return this.#amount;
  }

  get currency(): "COP" {
    return this.#currency;
  }

  /**
   * Add two MoneyCOP values.
   * Sum of non-negative integers is non-negative, but still validates finite.
   */
  add(other: MoneyCOP): MoneyCOP {
    const sum = this.#amount + other.#amount;

    if (!Number.isFinite(sum)) {
      throw new Error("MoneyCOP addition resulted in non-finite value");
    }

    return new MoneyCOP(sum);
  }

  isGreaterThan(other: MoneyCOP): boolean {
    return this.#amount > other.#amount;
  }

  isZero(): boolean {
    return this.#amount === 0;
  }

  equals(other: MoneyCOP): boolean {
    return this.#amount === other.#amount;
  }
}
