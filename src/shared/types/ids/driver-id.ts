import type { Brand } from "../branded.js";
import { createBrandedId, unsafeBrandedId } from "../branded.js";

/**
 * Branded type for Driver entity identifiers.
 *
 * Prevents accidental mixing with other ID types at compile time.
 */
export type DriverId = Brand<string, "DriverId">;

/**
 * Create a validated DriverId from a string value.
 *
 * @param value - The string value to validate and brand
 * @returns A branded DriverId
 * @throws {Error} If validation fails
 */
export const createDriverId = (value: string): DriverId =>
  createBrandedId<"DriverId">(value);

/**
 * Create a DriverId without validation.
 *
 * ONLY use for trusted rehydration (e.g., database reads).
 *
 * @param value - The string value to brand
 * @returns A branded DriverId
 */
export const unsafeDriverId = (value: string): DriverId =>
  unsafeBrandedId<"DriverId">(value);
