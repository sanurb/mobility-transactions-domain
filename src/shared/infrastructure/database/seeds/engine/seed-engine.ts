/**
 * Seed engine: Umzug-managed, SERIALIZABLE-transacted, replay-safe orchestrator.
 *
 * Each seed runs inside a single SERIALIZABLE transaction for concurrency
 * safety. Retries serialization failures up to MAX_RETRIES. Computes and
 * persists integrity hashes for drift detection. Logs structured metrics.
 *
 * Modes:
 * - normal:     only pending seeds execute (Umzug ledger)
 * - replay:     all seeds re-execute via RerunBehavior.ALLOW (proves idempotency)
 * - verifyOnly: compares stored hashes against current data definitions
 */

import type { Sequelize } from "sequelize";
import { Transaction } from "sequelize";
import { Umzug } from "umzug";
import { referenceSeed } from "../catalog/0001-reference-drivers.js";
import { fixtureSeed } from "../catalog/0002-fixture-scenarios.js";
import { assertNotProduction } from "./seed-guard.js";
import {
  checkDrift,
  computeHash,
  ensureIntegrityTable,
  storeHash,
} from "./seed-integrity.js";
import { logSeed } from "./seed-logger.js";
import { SeedMetaStorage } from "./seed-meta-storage.js";
import type {
  SeedContext,
  SeedEngineOptions,
  SeedEngineResult,
  SeedMigration,
  SeedResult,
  VerifyResult,
} from "./types.js";

const ALL_SEEDS: ReadonlyArray<SeedMigration> = [referenceSeed, fixtureSeed];

const MAX_RETRIES = 3;

const isSerializationError = (err: unknown): boolean => {
  if (!(err instanceof Error)) {
    return false;
  }
  const errObj = err as unknown as Record<string, unknown>;
  const parent = errObj.parent;
  if (parent instanceof Error) {
    const parentObj = parent as unknown as Record<string, unknown>;
    return parentObj.code === "40001";
  }
  return false;
};

const executeSeed = async (
  sequelize: Sequelize,
  storage: SeedMetaStorage,
  seed: SeedMigration,
  retryCount: number,
  opts: SeedEngineOptions
): Promise<SeedResult> => {
  const start = performance.now();
  const hash = computeHash(seed.data());

  const drift = await checkDrift(sequelize, seed.name, hash);
  if (drift.drifted && !opts.silent) {
    logSeed({
      name: seed.name,
      category: seed.category,
      event: "drift",
      hash,
      error: `Data definition changed. Previous: ${drift.previousHash}`,
    });
  }

  if (!opts.silent) {
    logSeed({ name: seed.name, category: seed.category, event: "start" });
  }

  opts.onStep?.({
    type: "step",
    name: seed.name,
    status: "running",
    timestamp: new Date().toISOString(),
  });

  const txn = await sequelize.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
  });

  try {
    const ctx: SeedContext = { sequelize, transaction: txn };
    const rowsAffected = await seed.up(ctx);
    await storeHash(sequelize, txn, seed.name, hash);
    await txn.commit();

    const durationMs = Math.round(performance.now() - start);
    storage.setPendingMeta(seed.name, {
      category: seed.category,
      hash,
      duration_ms: durationMs,
      rows_affected: rowsAffected,
      applied_at: new Date().toISOString(),
    });

    if (!opts.silent) {
      logSeed({
        name: seed.name,
        category: seed.category,
        event: "complete",
        durationMs,
        rowsAffected,
        hash,
        retryCount: retryCount > 0 ? retryCount : undefined,
      });
    }

    opts.onStep?.({
      type: "step",
      name: seed.name,
      status: "complete",
      timestamp: new Date().toISOString(),
      duration_ms: durationMs,
      rows_affected: rowsAffected,
    });

    return {
      name: seed.name,
      category: seed.category,
      event: opts.replay ? "replayed" : "applied",
      hash,
      duration_ms: durationMs,
      rows_affected: rowsAffected,
      retries: retryCount,
      drift: { drifted: drift.drifted, previous_hash: drift.previousHash },
    };
  } catch (err) {
    await txn.rollback();
    const durationMs = Math.round(performance.now() - start);

    if (!opts.silent) {
      logSeed({
        name: seed.name,
        category: seed.category,
        event: "error",
        durationMs,
        retryCount,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    opts.onStep?.({
      type: "step",
      name: seed.name,
      status: "error",
      timestamp: new Date().toISOString(),
      duration_ms: durationMs,
      error: err instanceof Error ? err.message : String(err),
    });

    throw err;
  }
};

const executeSeedWithRetry = async (
  sequelize: Sequelize,
  storage: SeedMetaStorage,
  seed: SeedMigration,
  opts: SeedEngineOptions
): Promise<SeedResult> => {
  let retryCount = 0;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    try {
      return await executeSeed(sequelize, storage, seed, retryCount, opts);
    } catch (err) {
      if (isSerializationError(err) && retryCount < MAX_RETRIES) {
        retryCount++;
        if (!opts.silent) {
          logSeed({
            name: seed.name,
            category: seed.category,
            event: "retry",
            retryCount,
          });
        }
        continue;
      }
      throw err;
    }
  }
};

const verifySeeds = async (
  sequelize: Sequelize,
  seeds: ReadonlyArray<SeedMigration>,
  opts: SeedEngineOptions
): Promise<VerifyResult[]> => {
  const results: VerifyResult[] = [];

  for (const seed of seeds) {
    const hash = computeHash(seed.data());
    const drift = await checkDrift(sequelize, seed.name, hash);
    const status = drift.drifted
      ? "DRIFTED"
      : drift.previousHash
        ? "OK"
        : "NOT_APPLIED";

    if (!opts.silent) {
      logSeed({
        name: seed.name,
        category: seed.category,
        event: "verify",
        hash,
        error:
          status === "DRIFTED"
            ? `Expected: ${hash}, Stored: ${drift.previousHash}`
            : undefined,
      });
    }

    results.push({
      name: seed.name,
      category: seed.category,
      hash,
      status,
      stored_hash: drift.previousHash,
    });
  }

  return results;
};

/**
 * Create and run the seed engine.
 *
 * @param opts.sequelize   - Sequelize instance with active connection
 * @param opts.replay      - Re-run all seeds (proves idempotency)
 * @param opts.category    - Filter: "reference", "fixture", or "all"
 * @param opts.verifyOnly  - Only check integrity hashes, do not mutate
 * @param opts.onStep      - Callback for NDJSON streaming
 * @param opts.silent      - Suppress logSeed() stdout for CLI mode
 */
export const runSeedEngine = async (
  opts: SeedEngineOptions
): Promise<SeedEngineResult> => {
  assertNotProduction();

  const {
    sequelize,
    replay = false,
    category = "all",
    verifyOnly = false,
  } = opts;

  const storage = new SeedMetaStorage(sequelize);
  await storage.ensureTable();
  await ensureIntegrityTable(sequelize);

  const seeds = ALL_SEEDS.filter(
    (s) => category === "all" || s.category === category
  );

  const engineStart = performance.now();

  if (verifyOnly) {
    const verifications = await verifySeeds(sequelize, seeds, opts);
    return {
      mode: "verify",
      seeds: [],
      verifications,
      total_rows_affected: 0,
      total_duration_ms: Math.round(performance.now() - engineStart),
    };
  }

  // Collect results via side-channel (Umzug up() callback must be void-returning)
  const seedResults = new Map<string, SeedResult>();

  const umzug = new Umzug({
    migrations: seeds.map((seed) => ({
      name: seed.name,
      up: async () => {
        const result = await executeSeedWithRetry(
          sequelize,
          storage,
          seed,
          opts
        );
        seedResults.set(seed.name, result);
      },
      down: async () => {
        /* Seeds are forward-only. Use TRUNCATE to reset. */
      },
    })),
    storage,
    logger: undefined,
  });

  if (replay) {
    await umzug.up({ migrations: seeds.map((s) => s.name), rerun: "ALLOW" });
  } else {
    const pending = await umzug.pending();
    if (pending.length === 0) {
      if (!opts.silent) {
        console.log(
          "[seed] All seeds already applied. Use SEED_REPLAY=true to re-run."
        );
      }
      return {
        mode: "apply",
        seeds: [],
        verifications: [],
        total_rows_affected: 0,
        total_duration_ms: Math.round(performance.now() - engineStart),
      };
    }
    await umzug.up();
  }

  const results = seeds
    .map((s) => seedResults.get(s.name))
    .filter((r): r is SeedResult => r !== undefined);

  return {
    mode: replay ? "replay" : "apply",
    seeds: results,
    verifications: [],
    total_rows_affected: results.reduce((sum, r) => sum + r.rows_affected, 0),
    total_duration_ms: Math.round(performance.now() - engineStart),
  };
};
