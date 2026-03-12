/**
 * JSON envelope builders for dbctl output.
 *
 * All output is machine-parseable JSON written to stdout.
 * NDJSON lines stream progress; the final line is always the envelope.
 */

import { randomUUID } from "node:crypto";
import type { Envelope, NdjsonEvent, NextAction } from "./types.js";
import { CLI_VERSION, SCHEMA_VERSION } from "./types.js";

let currentRunId: string | undefined;

export const getRunId = (): string => {
  if (!currentRunId) {
    currentRunId = randomUUID();
  }
  return currentRunId;
};

export const resetRunId = (): void => {
  currentRunId = undefined;
};

export const success = <T>(
  command: string,
  result: T,
  duration_ms: number,
  next_actions: ReadonlyArray<NextAction> = []
): Envelope<T> => ({
  schema_version: SCHEMA_VERSION,
  cli_version: CLI_VERSION,
  command,
  run_id: getRunId(),
  ok: true,
  result,
  duration_ms,
  next_actions,
});

export const failure = (
  command: string,
  message: string,
  code: string,
  duration_ms: number,
  opts?: { fix?: string; next_actions?: ReadonlyArray<NextAction> }
): Envelope => ({
  schema_version: SCHEMA_VERSION,
  cli_version: CLI_VERSION,
  command,
  run_id: getRunId(),
  ok: false,
  error: { message, code },
  fix: opts?.fix,
  duration_ms,
  next_actions: opts?.next_actions ?? [],
});

export const emit = (envelope: Envelope): void => {
  process.stdout.write(JSON.stringify(envelope) + "\n");
};

export const emitNdjson = (event: NdjsonEvent): void => {
  process.stdout.write(JSON.stringify(event) + "\n");
};
