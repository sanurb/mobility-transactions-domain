/**
 * System Clock Implementation
 *
 * Production implementation of Clock port using real system time.
 */

import type { Clock } from "../../../domain/ports/clock.port.js";

/**
 * System Clock - Uses real system time
 */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/**
 * Factory function to create a SystemClock instance
 */
export const createSystemClock = (): Clock => {
  return new SystemClock();
};
