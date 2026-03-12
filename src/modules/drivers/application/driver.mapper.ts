import type { Driver } from "../domain/driver.aggregate.js";
import type { DriverState } from "../domain/driver-states.js";

/**
 * Driver DTO - stable representation for API responses
 */
export interface DriverDTO {
  id: string;
  state: DriverState;
  currentLocation: {
    latitude: number;
    longitude: number;
    accuracy: number;
    bearing: number;
    speed: number;
    recordedAt: string;
  } | null;
  version: number;
  registeredAt: string;
  updatedAt: string;
}

/**
 * Map Driver aggregate to DTO
 */
export const mapDriverToDTO = (driver: Driver): DriverDTO => {
  return {
    id: driver.id,
    state: driver.state,
    currentLocation: driver.currentLocation
      ? {
          latitude: driver.currentLocation.location.latitude,
          longitude: driver.currentLocation.location.longitude,
          accuracy: driver.currentLocation.accuracyMeters,
          bearing: driver.currentLocation.bearingDegrees,
          speed: driver.currentLocation.speedMetersPerSecond,
          recordedAt: driver.currentLocation.recordedAt.toISOString(),
        }
      : null,
    version: driver.getVersion(),
    registeredAt: driver.registeredAt.toISOString(),
    updatedAt: driver.updatedAt.toISOString(),
  };
};
