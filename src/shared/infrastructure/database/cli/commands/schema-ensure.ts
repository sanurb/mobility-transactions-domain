import { define } from "gunshi";
import { ensureSchema } from "../../seeds/engine/ensure-schema.js";
import { release, tryAcquire } from "../advisory-lock.js";
import { withConnection } from "../connection.js";
import { emit, failure, success } from "../envelope.js";
import { EXIT } from "../types.js";

const COMMAND = "dbctl schema:ensure";

export const schemaEnsureCommand = define({
  name: "schema:ensure",
  description: "Bootstrap: models + sync + migrations",
  run: async () => {
    const start = performance.now();
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
          await ensureSchema(sequelize);

          emit(
            success(
              COMMAND,
              { status: "schema_ready" },
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
            )
          );
        } finally {
          await release(sequelize);
        }
      });
    } catch (err) {
      emit(
        failure(
          COMMAND,
          err instanceof Error ? err.message : String(err),
          "SCHEMA_ENSURE_FAILED",
          Math.round(performance.now() - start),
          { fix: "Ensure DATABASE_URL is set and PostgreSQL is reachable" }
        )
      );
      process.exitCode = EXIT.ERROR;
    }
  },
});
