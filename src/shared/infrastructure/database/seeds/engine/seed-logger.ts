/**
 * Structured logging and metrics for seed execution.
 *
 * Emits JSON log lines compatible with structured log aggregators.
 * Tracks duration, affected rows, retry count, and integrity hashes.
 */

export interface SeedLogEntry {
  readonly name: string;
  readonly category: string;
  readonly event:
    | "start"
    | "complete"
    | "error"
    | "skip"
    | "verify"
    | "drift"
    | "retry";
  readonly durationMs?: number;
  readonly rowsAffected?: number;
  readonly hash?: string;
  readonly retryCount?: number;
  readonly error?: string;
}

export const logSeed = (entry: SeedLogEntry): void => {
  const line = {
    timestamp: new Date().toISOString(),
    level: entry.event === "error" ? "error" : "info",
    component: "seed-engine",
    ...entry,
  };

  if (entry.event === "error") {
    console.error(JSON.stringify(line));
  } else {
    console.log(JSON.stringify(line));
  }
};
