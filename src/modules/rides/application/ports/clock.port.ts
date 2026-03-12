/**
 * Clock Port
 *
 * Abstraction for current time access.
 * Enables deterministic testing and time injection.
 *
 * Application layer uses this port to get nowUTC values
 * which are then passed into domain as parameters.
 */

/**
 * Clock Port
 */
export interface ClockPort {
  /**
   * Get current time as ISO UTC string
   *
   * @returns ISO 8601 UTC timestamp (e.g., '2026-02-13T14:35:47.000Z')
   */
  now(): string;
}
