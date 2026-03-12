/**
 * Runtime Value Objects with enforced invariants.
 *
 * These VOs provide payments-grade correctness for domain concepts:
 * - MoneyCOP: Colombian Pesos with integer-only amounts
 * - IdempotencyKey: Canonicalized retry-safe keys
 * - FareAmount: Policy-driven fare calculation with deterministic rounding
 * - PricingVersion: Semantic versioning for fare algorithms
 *
 * All VOs are:
 * - Immutable
 * - Standalone (no base class)
 * - Factory-based (Result<T, ValidationError>)
 * - Deterministic (identical inputs → identical outputs)
 */

export { Distance } from "./distance.js";
export { FareAmount, type FarePolicy } from "./fare-amount.js";
export { IdempotencyKey } from "./idempotency-key.js";
export { Location } from "./location.js";
export { MoneyCOP } from "./money-cop.js";
export { PricingVersion } from "./pricing-version.js";
