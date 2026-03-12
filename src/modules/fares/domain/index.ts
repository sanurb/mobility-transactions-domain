/**
 * Fares Domain Layer - Barrel Export
 *
 * Exports pure domain logic and types.
 */

export {
  calculateFare,
  type FareCalculationPolicy,
} from "./fare-calculator.js";
export type { FareBreakdown, FareInput, FareResult } from "./fare-types.js";
export { PRICING } from "./fare-types.js";
