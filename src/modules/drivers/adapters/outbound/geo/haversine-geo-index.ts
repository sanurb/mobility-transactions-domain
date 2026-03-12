/**
 * Haversine Geo-Spatial Index Adapter
 *
 * In-memory implementation of GeoSpatialIndexPort using Haversine distance.
 * This is a v1 implementation - the port abstraction allows swapping to
 * PostGIS/Redis/H3 without changing application code.
 */

import type {
  EligibleDriver,
  GeoSpatialIndexPort,
} from "../../../application/ports/geo-spatial-index.port.js";
import { Distance } from "../../../domain/value-objects/distance.js";
import type { DriverId } from "../../../domain/value-objects/driver-id.js";
import type { Location } from "../../../domain/value-objects/location.js";

/**
 * In-memory haversine geo-spatial index
 */
export class HaversineGeoIndex implements GeoSpatialIndexPort {
  private readonly locations: Map<string, Location> = new Map();

  /**
   * Update a driver's location in the spatial index
   */
  async updateLocation(params: {
    driverId: DriverId;
    location: Location;
  }): Promise<void> {
    this.locations.set(params.driverId.value, params.location);
  }

  /**
   * Remove a driver from the spatial index
   */
  async removeDriver(driverId: DriverId): Promise<void> {
    this.locations.delete(driverId.value);
  }

  /**
   * Find nearby drivers within a radius
   *
   * Returns drivers sorted by distance (ascending) with deterministic
   * tie-breaking by driverId (ascending).
   */
  async findNearby(params: {
    center: Location;
    radiusMeters: number;
  }): Promise<readonly EligibleDriver[]> {
    const { center, radiusMeters } = params;

    // Validate radius at boundary
    if (radiusMeters <= 0 || !Number.isFinite(radiusMeters)) {
      return [];
    }

    // Find all drivers within radius
    const eligible: Array<{ driverId: string; distanceMeters: number }> = [];

    for (const [driverIdValue, location] of this.locations.entries()) {
      const distance = Distance.haversine(center, location);

      if (distance.meters <= radiusMeters) {
        eligible.push({
          driverId: driverIdValue,
          distanceMeters: distance.meters,
        });
      }
    }

    // Sort by distance ascending, then by driverId ascending for deterministic tie-breaking
    eligible.sort((a, b) => {
      const distanceDiff = a.distanceMeters - b.distanceMeters;
      if (distanceDiff !== 0) {
        return distanceDiff;
      }
      return a.driverId.localeCompare(b.driverId);
    });

    // Map to EligibleDriver format (need to reconstitute DriverId VOs)
    const { DriverId: DriverIdCtor } = await import(
      "../../../domain/value-objects/driver-id.js"
    );

    const results: EligibleDriver[] = [];
    for (const item of eligible) {
      const driverIdResult = DriverIdCtor.create(item.driverId);
      if (driverIdResult.isOk()) {
        results.push({
          driverId: driverIdResult.value,
          distanceMeters: item.distanceMeters,
        });
      }
    }

    return results;
  }
}

/**
 * Factory function to create a geo-spatial index
 */
export const createGeoSpatialIndex = (): GeoSpatialIndexPort => {
  return new HaversineGeoIndex();
};
