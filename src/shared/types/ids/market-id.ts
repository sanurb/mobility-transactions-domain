import type { Brand } from "../branded.js";
import { createBrandedId, unsafeBrandedId } from "../branded.js";

/**
 * Branded type for Market entity identifiers.
 *
 * Markets represent geographic scopes for pricing and operations.
 * This aligns with PRD geographic isolation (not multi-tenant).
 */
export type MarketId = Brand<string, "MarketId">;

/**
 * Create a validated MarketId from a string value.
 *
 * @param value - The string value to validate and brand
 * @returns A branded MarketId
 * @throws {Error} If validation fails
 */
export const createMarketId = (value: string): MarketId =>
  createBrandedId<"MarketId">(value);

/**
 * Create a MarketId without validation.
 *
 * ONLY use for trusted rehydration (e.g., database reads).
 *
 * @param value - The string value to brand
 * @returns A branded MarketId
 */
export const unsafeMarketId = (value: string): MarketId =>
  unsafeBrandedId<"MarketId">(value);
