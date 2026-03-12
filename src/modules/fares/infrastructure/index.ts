/**
 * Fares Infrastructure Layer - Barrel Export
 *
 * Exports persistence models and repositories.
 */

export {
  type CreateFareParams,
  createFareRepository,
  FareRepository,
  type IFareRepository,
} from "./fare.repository.js";
export {
  type FareCalculationAttributes,
  type FareCalculationCreationAttributes,
  FareCalculationModel,
  initFareCalculationModel,
} from "./fare-calculation.model.js";
