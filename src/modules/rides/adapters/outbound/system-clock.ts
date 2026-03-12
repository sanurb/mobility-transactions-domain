/**
 * System Clock Adapter
 *
 * Production implementation of ClockPort using system time.
 */

import type { ClockPort } from "../../application/ports/clock.port.js";

export class SystemClock implements ClockPort {
  now(): string {
    return new Date().toISOString();
  }
}
