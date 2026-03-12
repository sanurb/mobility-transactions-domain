/**
 * Rides Infrastructure Module
 *
 * Exports all persistence layer components for the ride domain.
 */

import type { Sequelize } from "sequelize";
import { initRideModel } from "./ride.model.js";
import { initRideTransitionModel } from "./ride-transition.model.js";

export type { RideAttributes, RideCreationAttributes } from "./ride.model.js";
// Export models
export { initRideModel, RideModel } from "./ride.model.js";
export type {
  ChangedByRole,
  RideTransitionAttributes,
  RideTransitionCreationAttributes,
} from "./ride-transition.model.js";
export {
  initRideTransitionModel,
  RideTransitionModel,
} from "./ride-transition.model.js";

// DEPRECATED: Legacy repository removed in 07-10. Use adapters/outbound/ride.repository.ts
// export {
//   RideRepository,
//   createRideRepository,
//   type IRideRepository,
//   type RideDTO,
//   type RideTransitionDTO,
//   type RideWithTransitions,
//   type CreateRideParams,
//   type TransitionRideParams,
//   type ListRidesParams,
//   type ListResult,
// } from "./ride.repository.js";

/**
 * Initialize all ride-related models and associations
 *
 * Call this during application startup before accepting requests.
 *
 * @param sequelize - Sequelize instance
 * @returns Object with initialized models
 */
export const initRideModels = (sequelize: Sequelize) => {
  const Ride = initRideModel(sequelize);
  const RideTransition = initRideTransitionModel(sequelize, Ride);

  return {
    Ride,
    RideTransition,
  };
};
