/**
 * Ride State Machine - Pure Domain Logic
 *
 * Defines the lifecycle states of a ride and valid state transitions.
 * This is the foundation of the ride domain - all other components depend on these rules.
 *
 * States are immutable constants (as const object, not enum per project rules).
 * Transitions are explicitly defined as a lookup map.
 * All functions are pure - no side effects, no I/O.
 */

/**
 * All possible ride states
 * Using as const object pattern instead of TypeScript enum
 */
export const RIDE_STATES = {
  CREATED: "CREATED",
  DISPATCHING: "DISPATCHING",
  ASSIGNED: "ASSIGNED",
  STARTED: "STARTED",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELED",
  EXPIRED: "EXPIRED",
  FAILED: "FAILED",
} as const;

/**
 * Type for ride state values
 */
export type RideState = (typeof RIDE_STATES)[keyof typeof RIDE_STATES];

/**
 * Role of the actor who initiated a state change
 */
export type ChangedByRole = "rider" | "driver" | "system";

/**
 * Valid state transitions map
 * Each state maps to an array of allowed next states
 *
 * Transition rules:
 * - CREATED can move to: DISPATCHING (normal flow), CANCELED, EXPIRED, FAILED
 * - DISPATCHING can move to: ASSIGNED (driver accepted), CANCELED, EXPIRED, FAILED
 * - ASSIGNED can move to: STARTED (driver arrived), CANCELED, EXPIRED, FAILED
 * - STARTED can move to: COMPLETED (normal end), FAILED
 * - Terminal states (COMPLETED, CANCELED, EXPIRED, FAILED) have no outgoing transitions
 *
 * Note: Cancel is only allowed before the ride starts
 * Note: Expire is only allowed while waiting for driver (CREATED, DISPATCHING, ASSIGNED)
 * Note: Fail can happen at any non-terminal state
 */
export const RIDE_TRANSITIONS: Record<RideState, readonly RideState[]> = {
  [RIDE_STATES.CREATED]: [
    RIDE_STATES.DISPATCHING,
    RIDE_STATES.CANCELED,
    RIDE_STATES.EXPIRED,
    RIDE_STATES.FAILED,
  ],
  [RIDE_STATES.DISPATCHING]: [
    RIDE_STATES.ASSIGNED,
    RIDE_STATES.CANCELED,
    RIDE_STATES.EXPIRED,
    RIDE_STATES.FAILED,
  ],
  [RIDE_STATES.ASSIGNED]: [
    RIDE_STATES.STARTED,
    RIDE_STATES.CANCELED,
    RIDE_STATES.EXPIRED,
    RIDE_STATES.FAILED,
  ],
  [RIDE_STATES.STARTED]: [RIDE_STATES.COMPLETED, RIDE_STATES.FAILED],
  [RIDE_STATES.COMPLETED]: [],
  [RIDE_STATES.CANCELED]: [],
  [RIDE_STATES.EXPIRED]: [],
  [RIDE_STATES.FAILED]: [],
};

/**
 * Expiration timeout policies (in seconds)
 * Defines how long a ride can stay in certain states before auto-expiring
 */
export const EXPIRATION_POLICIES = {
  /** DISPATCHING expires after 2 minutes if no driver accepts */
  DISPATCHING: 120,
  /** ASSIGNED expires after 5 minutes if driver doesn't start */
  ASSIGNED: 300,
} as const;

/**
 * Check if a state transition is valid
 *
 * @param from - Current state
 * @param to - Target state
 * @returns true if transition is allowed, false otherwise
 *
 * @example
 * canTransition('CREATED', 'DISPATCHING') // true
 * canTransition('STARTED', 'CANCELED') // false
 * canTransition('COMPLETED', 'FAILED') // false (terminal state)
 */
export const canTransition = (from: RideState, to: RideState): boolean => {
  const allowedTransitions = RIDE_TRANSITIONS[from];
  return allowedTransitions.includes(to);
};

/**
 * Check if a state is terminal (no outgoing transitions)
 *
 * @param state - State to check
 * @returns true if state is terminal, false otherwise
 *
 * @example
 * isTerminalState('COMPLETED') // true
 * isTerminalState('STARTED') // false
 */
export const isTerminalState = (state: RideState): boolean => {
  return RIDE_TRANSITIONS[state].length === 0;
};

/**
 * Get all valid next states from a given state
 *
 * @param state - Current state
 * @returns Array of valid next states (empty for terminal states)
 *
 * @example
 * getValidNextStates('CREATED') // ['DISPATCHING', 'CANCELED', 'EXPIRED', 'FAILED']
 * getValidNextStates('COMPLETED') // []
 */
export const getValidNextStates = (state: RideState): readonly RideState[] => {
  return RIDE_TRANSITIONS[state];
};

/**
 * Get expiration policy in seconds for a given state
 *
 * @param state - State to check
 * @returns Expiration timeout in seconds, or null if state has no expiration
 *
 * @example
 * expirationPolicySeconds('DISPATCHING') // 120
 * expirationPolicySeconds('ASSIGNED') // 300
 * expirationPolicySeconds('STARTED') // null
 */
export const expirationPolicySeconds = (state: RideState): number | null => {
  if (state === RIDE_STATES.DISPATCHING) {
    return EXPIRATION_POLICIES.DISPATCHING;
  }
  if (state === RIDE_STATES.ASSIGNED) {
    return EXPIRATION_POLICIES.ASSIGNED;
  }
  return null;
};

/**
 * Add seconds to an ISO UTC string (pure function)
 *
 * @param isoUtc - ISO 8601 UTC timestamp string
 * @param seconds - Number of seconds to add
 * @returns New ISO UTC timestamp string
 *
 * @example
 * addSecondsToIsoUtc('2026-02-13T14:00:00.000Z', 120) // '2026-02-13T14:02:00.000Z'
 */
export const addSecondsToIsoUtc = (isoUtc: string, seconds: number): string => {
  const date = new Date(isoUtc);
  date.setSeconds(date.getSeconds() + seconds);
  return date.toISOString();
};

/**
 * Compare two ISO UTC strings (pure function)
 *
 * @param isoUtc1 - First ISO UTC timestamp
 * @param isoUtc2 - Second ISO UTC timestamp
 * @returns true if isoUtc1 is after isoUtc2
 *
 * @example
 * isAfter('2026-02-13T14:02:00.000Z', '2026-02-13T14:00:00.000Z') // true
 * isAfter('2026-02-13T14:00:00.000Z', '2026-02-13T14:02:00.000Z') // false
 */
export const isAfter = (isoUtc1: string, isoUtc2: string): boolean => {
  return new Date(isoUtc1) > new Date(isoUtc2);
};
