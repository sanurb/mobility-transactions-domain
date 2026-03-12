/**
 * Ride Assignment Port
 *
 * Abstraction for transitioning rides from DISPATCHING to ASSIGNED state.
 * Prevents cross-bounded-context concrete dependencies.
 * Dispatch context depends on this port, not on rides service directly.
 */

import type { Result } from "../../../../shared/core/result.js";
import type { DomainError } from "../../../../shared/errors/error-types.js";

/**
 * Parameters for transitioning ride to assigned state
 */
export interface TransitionRideToAssignedParams {
  rideId: string;
  tenantId: string;
  driverId: string;
  correlationId: string;
}

/**
 * Ride Assignment Port
 */
export interface RideAssignmentPort {
  /**
   * Transition a ride from DISPATCHING to ASSIGNED state
   *
   * @param params - Transition parameters
   * @returns Result with void on success or DomainError on failure
   */
  transitionRideToAssigned(
    params: TransitionRideToAssignedParams
  ): Promise<Result<void, DomainError>>;
}
