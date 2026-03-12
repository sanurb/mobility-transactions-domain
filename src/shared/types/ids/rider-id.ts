import type { Brand } from "../branded.js";
import { createBrandedId, unsafeBrandedId } from "../branded.js";

/**
 * Branded type for Rider entity identifiers.
 *
 * Prevents accidental mixing with other ID types at compile time.
 */
export type RiderId = Brand<string, "RiderId">;

/**
 * Create a validated RiderId from a string value.
 *
 * @param value - The string value to validate and brand
 * @returns A branded RiderId
 * @throws {Error} If validation fails
 */
export const createRiderId = (value: string): RiderId =>
  createBrandedId<"RiderId">(value);

/**
 * Create a RiderId without validation.
 *
 * ONLY use for trusted rehydration (e.g., database reads).
 *
 * @param value - The string value to brand
 * @returns A branded RiderId
 */
export const unsafeRiderId = (value: string): RiderId =>
  unsafeBrandedId<"RiderId">(value);
