/**
 * CLI envelope types for dbctl — agent-first database control plane.
 *
 * All commands emit a JSON envelope with HATEOAS next_actions,
 * enabling AI agents to discover and compose operations.
 */

export const SCHEMA_VERSION = "1.0.0" as const;
export const CLI_VERSION = "0.1.0" as const;

export interface NextAction {
  readonly command: string;
  readonly description: string;
}

export interface Envelope<T = unknown> {
  readonly schema_version: typeof SCHEMA_VERSION;
  readonly cli_version: typeof CLI_VERSION;
  readonly command: string;
  readonly run_id: string;
  readonly ok: boolean;
  readonly result?: T;
  readonly error?: { message: string; code: string };
  readonly fix?: string;
  readonly duration_ms: number;
  readonly next_actions: ReadonlyArray<NextAction>;
}

export interface NdjsonEvent {
  readonly type: "start" | "step" | "result";
  readonly run_id: string;
  readonly timestamp: string;
  readonly command?: string;
  readonly name?: string;
  readonly status?: string;
  readonly duration_ms?: number;
  readonly rows_affected?: number;
  readonly ok?: boolean;
  readonly result?: unknown;
  readonly next_actions?: ReadonlyArray<NextAction>;
  readonly error?: string;
}

/** Exit codes for dbctl commands. */
export const EXIT = {
  SUCCESS: 0,
  ERROR: 1,
  DRIFT: 2,
  LOCK_CONTENTION: 3,
  PRODUCTION_GUARD: 4,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];
