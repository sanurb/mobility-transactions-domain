/**
 * ClockPort - Time abstraction for deterministic testing
 *
 * Application layer receives timestamps as strings (no Date objects in domain).
 * Use cases call clock.now() to set audit timestamps.
 */

export interface ClockPort {
  /**
   * Get current UTC time as ISO 8601 string.
   *
   * @returns ISO 8601 UTC timestamp (e.g., '2026-02-13T10:00:00.000Z')
   */
  now(): string;
}
