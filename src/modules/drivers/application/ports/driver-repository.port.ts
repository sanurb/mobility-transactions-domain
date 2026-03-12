/**
 * Driver Repository Port - Persistence Contract
 *
 * Defines the interface for driver aggregate persistence.
 * Infrastructure adapters implement this port.
 *
 * No tenantId per PRD - isolation via ownership/role/geo.
 */

import type { Result } from "../../../../shared/core/result.js";
import type { DomainError } from "../../../../shared/errors/error-types.js";
import type { Driver } from "../../domain/driver.aggregate.js";
import type { DriverId } from "../../domain/value-objects/driver-id.js";

/**
 * Driver repository port
 */
export interface DriverRepositoryPort {
  /**
   * Find a driver by ID
   *
   * @param params - Query parameters
   * @returns Result with Driver if found, null if not found, or error
   */
  findById(params: {
    id: DriverId;
  }): Promise<Result<Driver | null, DomainError>>;

  /**
   * Save a driver (create or update)
   * Handles optimistic locking at the repository layer
   *
   * @param driver - Driver aggregate to save
   * @returns Result with saved Driver or error
   */
  save(driver: Driver): Promise<Result<Driver, DomainError>>;
}
