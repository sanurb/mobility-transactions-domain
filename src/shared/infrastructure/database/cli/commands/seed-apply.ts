import { define } from "gunshi";
import { ensureSchema } from "../../seeds/engine/ensure-schema.js";
import { runSeedEngine } from "../../seeds/engine/seed-engine.js";
import type { SeedCategory, SeedStepEvent } from "../../seeds/engine/types.js";
import { release, tryAcquire } from "../advisory-lock.js";
import { withConnection } from "../connection.js";
import { emit, emitNdjson, failure, getRunId, success } from "../envelope.js";
import { EXIT } from "../types.js";

const COMMAND = "dbctl seed:apply";

const parseCategory = (raw: string | undefined): SeedCategory | "all" => {
  if (raw === "reference" || raw === "fixture") {
    return raw;
  }
  return "all";
};

export const seedApplyCommand = define({
  name: "seed:apply",
  description: "Execute seeds (with advisory lock)",
  args: {
    follow: {
      type: "boolean",
      short: "f",
      description: "Stream NDJSON progress to stdout",
      default: false,
    },
    replay: {
      type: "boolean",
      short: "r",
      description: "Re-run all seeds (proves idempotency)",
      default: false,
    },
    category: {
      type: "string",
      short: "c",
      description: "Filter: reference, fixture, or all",
      default: "all",
    },
  },
  run: async (ctx) => {
    const start = performance.now();
    const { follow, replay } = ctx.values;
    const category = parseCategory(ctx.values.category);

    try {
      await withConnection(async (sequelize) => {
        const acquired = await tryAcquire(sequelize);
        if (!acquired) {
          emit(
            failure(
              COMMAND,
              "Another dbctl process holds the advisory lock",
              "LOCK_CONTENTION",
              Math.round(performance.now() - start),
              {
                fix: "Run 'dbctl lock:status' to see who holds the lock",
                next_actions: [
                  {
                    command: "dbctl lock:status",
                    description: "Check lock holder",
                  },
                ],
              }
            )
          );
          process.exitCode = EXIT.LOCK_CONTENTION;
          return;
        }

        try {
          if (follow) {
            emitNdjson({
              type: "start",
              run_id: getRunId(),
              command: COMMAND,
              timestamp: new Date().toISOString(),
            });
          }

          await ensureSchema(sequelize);

          const onStep = follow
            ? (event: SeedStepEvent) => {
                emitNdjson({
                  ...event,
                  run_id: getRunId(),
                });
              }
            : undefined;

          const result = await runSeedEngine({
            sequelize,
            replay: replay ?? false,
            category,
            silent: true,
            onStep,
          });

          const nextActions = [
            {
              command: "dbctl seed:verify",
              description: "Check integrity hashes after apply",
            },
            {
              command: "dbctl seed:status",
              description: "View seed metadata",
            },
          ];

          const envelope = success(
            COMMAND,
            {
              mode: result.mode,
              seeds: result.seeds,
              total_rows_affected: result.total_rows_affected,
              total_duration_ms: result.total_duration_ms,
            },
            Math.round(performance.now() - start),
            nextActions
          );

          if (follow) {
            emitNdjson({
              type: "result",
              run_id: getRunId(),
              ok: true,
              command: COMMAND,
              result: envelope.result,
              next_actions: [...envelope.next_actions],
              timestamp: new Date().toISOString(),
            });
          } else {
            emit(envelope);
          }
        } finally {
          await release(sequelize);
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isProductionGuard = message.includes(
        "Seed execution blocked in production"
      );

      emit(
        failure(
          COMMAND,
          message,
          isProductionGuard ? "PRODUCTION_GUARD" : "SEED_APPLY_FAILED",
          Math.round(performance.now() - start),
          isProductionGuard
            ? {
                fix: "Set SEED_ALLOW_PRODUCTION=true to override (audited)",
              }
            : {
                fix: "Check database connectivity and schema state",
                next_actions: [
                  {
                    command: "dbctl schema:ensure",
                    description: "Bootstrap schema first",
                  },
                ],
              }
        )
      );
      process.exitCode = isProductionGuard ? EXIT.PRODUCTION_GUARD : EXIT.ERROR;
    }
  },
});
