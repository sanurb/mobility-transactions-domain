/**
 * Fare repository re-export and DTO type.
 *
 * Implementation lives in adapters/outbound; this module re-exports for
 * infrastructure barrel and defines FareCalculationDTO for presentation layer.
 */

import type { FareRecord as FareRecordType } from "../application/ports/index.js";

export {
  createFareRepository,
  FareRepository,
} from "../adapters/outbound/fare.repository.js";
export type {
  FareRecord,
  FareRepositoryPort as IFareRepository,
} from "../application/ports/index.js";

/** Params for saving a new fare (omit id and createdAt from FareRecord). */
export type CreateFareParams = Omit<FareRecordType, "id" | "createdAtUTC">;
