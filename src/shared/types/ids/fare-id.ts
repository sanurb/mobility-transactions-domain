import type { Brand } from "../branded.js";
import { createBrandedId, unsafeBrandedId } from "../branded.js";

/**
 * Branded type for Fare entity identifiers.
 *
 * Prevents accidental mixing with other ID types at compile time.
 */
export type FareId = Brand<string, "FareId">;

/**
 * Create a validated FareId from a string value.
 *
 * @param value - The string value to validate and brand
 * @returns A branded FareId
 * @throws {Error} If validation fails
 */
export const createFareId = (value: string): FareId =>
  createBrandedId<"FareId">(value);

/**
 * Create a FareId without validation.
 *
 * ONLY use for trusted rehydration (e.g., database reads).
 *
 * @param value - The string value to brand
 * @returns A branded FareId
 */
export const unsafeFareId = (value: string): FareId =>
  unsafeBrandedId<"FareId">(value);
