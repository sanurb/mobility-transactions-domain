import type { Sequelize, Transaction } from "sequelize";

export type SeedCategory = "reference" | "fixture";

export interface SeedContext {
  readonly sequelize: Sequelize;
  readonly transaction: Transaction;
}

export interface SeedMigration {
  readonly name: string;
  readonly category: SeedCategory;
  /** Returns canonical data for integrity hashing. Must be deterministic. */
  data(): unknown;
  /** Execute seed mutations, return total rows affected. */
  up(ctx: SeedContext): Promise<number>;
}

export interface SeedMetaRecord {
  readonly name: string;
  readonly category: string;
  readonly hash: string;
  readonly duration_ms: number;
  readonly rows_affected: number;
  readonly applied_at: string;
}

export interface SeedEngineOptions {
  readonly sequelize: Sequelize;
  readonly replay?: boolean;
  readonly category?: SeedCategory | "all";
  readonly verifyOnly?: boolean;
  readonly onStep?: (event: SeedStepEvent) => void;
  readonly silent?: boolean;
}

// ── CLI-facing result types (additive, backward-compatible) ──────────

export interface SeedResult {
  readonly name: string;
  readonly category: SeedCategory;
  readonly event: "applied" | "skipped" | "replayed";
  readonly hash: string;
  readonly duration_ms: number;
  readonly rows_affected: number;
  readonly retries: number;
  readonly drift: { drifted: boolean; previous_hash: string | null };
}

export interface VerifyResult {
  readonly name: string;
  readonly category: SeedCategory;
  readonly hash: string;
  readonly status: "OK" | "DRIFTED" | "NOT_APPLIED";
  readonly stored_hash: string | null;
}

export interface SeedEngineResult {
  readonly mode: "apply" | "replay" | "verify";
  readonly seeds: ReadonlyArray<SeedResult>;
  readonly verifications: ReadonlyArray<VerifyResult>;
  readonly total_rows_affected: number;
  readonly total_duration_ms: number;
}

export interface SeedStepEvent {
  readonly type: "step";
  readonly name: string;
  readonly status: "running" | "complete" | "error";
  readonly timestamp: string;
  readonly duration_ms?: number;
  readonly rows_affected?: number;
  readonly error?: string;
}
