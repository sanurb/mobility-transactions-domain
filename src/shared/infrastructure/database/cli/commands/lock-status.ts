import { define } from "gunshi";
import { LOCK_KEY, queryLockStatus } from "../advisory-lock.js";
import { withConnection } from "../connection.js";
import { emit, failure, success } from "../envelope.js";
import { EXIT } from "../types.js";

const COMMAND = "dbctl lock:status";

export const lockStatusCommand = define({
  name: "lock:status",
  description: "Show advisory lock state",
  run: async () => {
    const start = performance.now();
    try {
      await withConnection(async (sequelize) => {
        const status = await queryLockStatus(sequelize);
        emit(
          success(
            COMMAND,
            { lock_key: LOCK_KEY, ...status },
            Math.round(performance.now() - start),
            [
              {
                command: "dbctl seed:status",
                description: "Check seed status",
              },
              {
                command: "dbctl migrate:status",
                description: "Check migration status",
              },
            ]
          )
        );
      });
    } catch (err) {
      emit(
        failure(
          COMMAND,
          err instanceof Error ? err.message : String(err),
          "LOCK_STATUS_FAILED",
          Math.round(performance.now() - start),
          { fix: "Ensure DATABASE_URL is set and PostgreSQL is reachable" }
        )
      );
      process.exitCode = EXIT.ERROR;
    }
  },
});
