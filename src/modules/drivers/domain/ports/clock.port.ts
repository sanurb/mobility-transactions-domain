/**
 * Clock Port - Injectable Time
 *
 * Enables testable time-dependent behavior in domain logic.
 */

export interface Clock {
  /**
   * Get current time
   * @returns Current date and time
   */
  now(): Date;
}
