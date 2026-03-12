/**
 * Drivers Outbound Adapters
 *
 * Exports all persistence layer components for the driver domain.
 */

import type { Sequelize } from "sequelize";
import { initDriverModel } from "./persistence/driver.model.js";
import { initDriverLocationModel } from "./persistence/driver-location.model.js";

// Export geo-spatial index adapter
export {
  createGeoSpatialIndex,
  HaversineGeoIndex,
} from "./geo/haversine-geo-index.js";
export type {
  DriverAttributes,
  DriverCreationAttributes,
} from "./persistence/driver.model.js";
// Export models
export { DriverModel, initDriverModel } from "./persistence/driver.model.js";
// Export repository
export {
  createDriverRepository,
  DriverRepository,
} from "./persistence/driver.repository.js";
export type {
  DriverLocationAttributes,
  DriverLocationCreationAttributes,
} from "./persistence/driver-location.model.js";
export {
  DriverLocationModel,
  initDriverLocationModel,
} from "./persistence/driver-location.model.js";

// Export clock implementation
export {
  createSystemClock,
  SystemClock,
} from "./time/system-clock.js";

/**
 * Initialize all driver-related models and associations
 *
 * Call this during application startup before accepting requests.
 *
 * @param sequelize - Sequelize instance
 * @returns Object with initialized models
 */
export const initDriverModels = (sequelize: Sequelize) => {
  const Driver = initDriverModel(sequelize);
  const DriverLocation = initDriverLocationModel(sequelize, Driver);

  return {
    Driver,
    DriverLocation,
  };
};
