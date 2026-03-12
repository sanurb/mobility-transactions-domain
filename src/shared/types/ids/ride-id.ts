import type { Brand } from "../branded.js";
import { createBrandedId, unsafeBrandedId } from "../branded.js";

/**
 * Branded type for Ride entity identifiers.
 *
 * Prevents accidental mixing with other ID types at compile time.
 */
export type RideId = Brand<string, "RideId">;

/**
 * Create a validated RideId from a string value.
 *
 * @param value - The string value to validate and brand
 * @returns A branded RideId
 * @throws {Error} If validation fails
 */
export const createRideId = (value: string): RideId =>
  createBrandedId<"RideId">(value);

/**
 * Create a RideId without validation.
 *
 * ONLY use for trusted rehydration (e.g., database reads).
 *
 * @param value - The string value to brand
 * @returns A branded RideId
 */
export const unsafeRideId = (value: string): RideId =>
  unsafeBrandedId<"RideId">(value);
