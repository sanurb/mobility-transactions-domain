/**
 * Geo-Spatial Index Port - Spatial Query Contract
 *
 * Defines the interface for spatial queries (nearby drivers).
 * Infrastructure adapters implement this port (e.g., PostGIS, Redis Geo).
 */

import type { Location } from "../../../../shared/domain/value-objects/location.js";
import type { DriverId } from "../../domain/value-objects/driver-id.js";

/**
 * Eligible driver with distance information
 */
export interface EligibleDriver {
  readonly driverId: DriverId;
  readonly distanceMeters: number;
}

/**
 * Geo-spatial index port
 */
export interface GeoSpatialIndexPort {
  /**
   * Update a driver's location in the spatial index
   *
   * @param params - Update parameters
   */
  updateLocation(params: {
    driverId: DriverId;
    location: Location;
  }): Promise<void>;

  /**
   * Remove a driver from the spatial index
   *
   * @param driverId - Driver to remove
   */
  removeDriver(driverId: DriverId): Promise<void>;

  /**
   * Find nearby drivers within a radius
   *
   * @param params - Search parameters
   * @returns Array of eligible drivers with distances
   */
  findNearby(params: {
    center: Location;
    radiusMeters: number;
  }): Promise<readonly EligibleDriver[]>;
}
