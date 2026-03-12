/**
 * Driver State Machine - Pure Domain Logic
 *
 * Defines the availability states of a driver and valid state transitions.
 * This follows the same pattern as ride states but with simpler transitions.
 *
 * States are immutable constants (as const object, not enum per project rules).
 * Transitions are explicitly defined as a lookup map.
 * All functions are pure - no side effects, no I/O.
 */

/**
 * All possible driver states
 * Using as const object pattern instead of TypeScript enum
 */
export const DRIVER_STATES = {
  AVAILABLE: "AVAILABLE",
  BUSY: "BUSY",
  OFFLINE: "OFFLINE",
} as const;

/**
 * Type for driver state values
 */
export type DriverState = (typeof DRIVER_STATES)[keyof typeof DRIVER_STATES];

/**
 * Valid state transitions map
 * Each state maps to an array of allowed next states
 *
 * Transition rules:
 * - OFFLINE can move to: AVAILABLE (driver comes online)
 * - AVAILABLE can move to: BUSY (assigned to ride), OFFLINE (goes offline)
 * - BUSY can move to: AVAILABLE (ride complete/released), OFFLINE (force offline)
 */
export const DRIVER_TRANSITIONS: Record<DriverState, readonly DriverState[]> = {
  [DRIVER_STATES.OFFLINE]: [DRIVER_STATES.AVAILABLE],
  [DRIVER_STATES.AVAILABLE]: [DRIVER_STATES.BUSY, DRIVER_STATES.OFFLINE],
  [DRIVER_STATES.BUSY]: [DRIVER_STATES.AVAILABLE, DRIVER_STATES.OFFLINE],
};

/**
 * Check if a state transition is valid
 *
 * @param from - Current state
 * @param to - Target state
 * @returns true if transition is allowed, false otherwise
 *
 * @example
 * canTransition('OFFLINE', 'AVAILABLE') // true
 * canTransition('OFFLINE', 'BUSY') // false
 * canTransition('AVAILABLE', 'BUSY') // true
 */
export const canTransition = (from: DriverState, to: DriverState): boolean => {
  const allowedTransitions = DRIVER_TRANSITIONS[from];
  return allowedTransitions.includes(to);
};

/**
 * Check if a driver is in the AVAILABLE state
 *
 * @param state - State to check
 * @returns true if state is AVAILABLE, false otherwise
 *
 * @example
 * isDriverAvailable('AVAILABLE') // true
 * isDriverAvailable('BUSY') // false
 */
export const isDriverAvailable = (state: DriverState): boolean => {
  return state === DRIVER_STATES.AVAILABLE;
};
