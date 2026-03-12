import { define } from "gunshi";
import { runMigrationsWithResults } from "../../run-migrations.js";
import { release, tryAcquire } from "../advisory-lock.js";
import { withConnection } from "../connection.js";
import { emit, emitNdjson, failure, getRunId, success } from "../envelope.js";
import { EXIT } from "../types.js";

const COMMAND = "dbctl migrate:apply";

export const migrateApplyCommand = define({
  name: "migrate:apply",
  description: "Execute migrations (with advisory lock)",
  args: {
    follow: {
      type: "boolean",
      short: "f",
      description: "Stream NDJSON progress to stdout",
      default: false,
    },
  },
  run: async (ctx) => {
    const start = performance.now();
    const follow = ctx.values.follow;

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

          const results = await runMigrationsWithResults(sequelize);

          if (follow) {
            for (const r of results) {
              emitNdjson({
                type: "step",
                run_id: getRunId(),
                name: r.name,
                status: "complete",
                duration_ms: r.duration_ms,
                timestamp: new Date().toISOString(),
              });
            }
          }

          const envelope = success(
            COMMAND,
            {
              migrations: results,
              count: results.length,
              total_duration_ms: results.reduce(
                (sum, r) => sum + r.duration_ms,
                0
              ),
            },
            Math.round(performance.now() - start),
            [
              {
                command: "dbctl migrate:status",
                description: "Verify constraints are in place",
              },
              {
                command: "dbctl seed:apply",
                description: "Seed development data",
              },
            ]
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
      emit(
        failure(
          COMMAND,
          err instanceof Error ? err.message : String(err),
          "MIGRATE_APPLY_FAILED",
          Math.round(performance.now() - start)
        )
      );
      process.exitCode = EXIT.ERROR;
    }
  },
});
