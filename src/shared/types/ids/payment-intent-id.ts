import type { Brand } from "../branded.js";
import { createBrandedId, unsafeBrandedId } from "../branded.js";

/**
 * Branded type for PaymentIntent entity identifiers.
 *
 * Prevents accidental mixing with other ID types at compile time.
 */
export type PaymentIntentId = Brand<string, "PaymentIntentId">;

/**
 * Create a validated PaymentIntentId from a string value.
 *
 * @param value - The string value to validate and brand
 * @returns A branded PaymentIntentId
 * @throws {Error} If validation fails
 */
export const createPaymentIntentId = (value: string): PaymentIntentId =>
  createBrandedId<"PaymentIntentId">(value);

/**
 * Create a PaymentIntentId without validation.
 *
 * ONLY use for trusted rehydration (e.g., database reads).
 *
 * @param value - The string value to brand
 * @returns A branded PaymentIntentId
 */
export const unsafePaymentIntentId = (value: string): PaymentIntentId =>
  unsafeBrandedId<"PaymentIntentId">(value);
