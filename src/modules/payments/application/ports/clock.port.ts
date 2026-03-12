/**
 * Clock Port
 *
 * Time abstraction for application and adapter layers.
 *
 * DESIGN PRINCIPLES:
 * - Used by application/adapters for bookkeeping ONLY
 * - Domain receives timestamps via parameters (explicit dependency)
 * - Enables deterministic testing without time-based flakiness
 * - Returns ISO 8601 UTC strings for consistency
 *
 * USAGE:
 * - Outbox record creation timestamps
 * - Publish timestamps
 * - Adapter-level audit fields
 *
 * NOT USED FOR:
 * - Domain logic (domain takes timestamps as params)
 * - Business rules (time rules belong in domain, with time as input)
 */
export interface ClockPort {
  /**
   * Get current UTC time as ISO 8601 string.
   *
   * @returns ISO 8601 formatted UTC timestamp
   * @example "2024-02-13T13:45:30.123Z"
   */
  nowUTC(): string;
}
