import { define } from "gunshi";
import { withConnection } from "../connection.js";
import { emit, failure, success } from "../envelope.js";
import { EXIT } from "../types.js";

const COMMAND = "dbctl migrate:status";

interface ConstraintInfo {
  readonly name: string;
  readonly type: string;
  readonly table: string;
}

export const migrateStatusCommand = define({
  name: "migrate:status",
  description: "Show which constraints/indexes exist vs expected",
  run: async () => {
    const start = performance.now();
    try {
      await withConnection(async (sequelize) => {
        const [indexes] = await sequelize.query(`
          SELECT indexname AS name, 'index' AS type, tablename AS table
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname LIKE 'ux_%'
          ORDER BY tablename, indexname
        `);

        const [constraints] = await sequelize.query(`
          SELECT conname AS name, contype AS type, relname AS table
          FROM pg_constraint c
          JOIN pg_class r ON r.oid = c.conrelid
          WHERE r.relnamespace = 'public'::regnamespace
            AND conname LIKE 'chk_%'
          ORDER BY relname, conname
        `);

        const [triggers] = await sequelize.query(`
          SELECT tgname AS name, 'trigger' AS type, relname AS table
          FROM pg_trigger t
          JOIN pg_class r ON r.oid = t.tgrelid
          WHERE r.relnamespace = 'public'::regnamespace
            AND NOT tgisinternal
          ORDER BY relname, tgname
        `);

        emit(
          success(
            COMMAND,
            {
              indexes: indexes as ConstraintInfo[],
              constraints: constraints as ConstraintInfo[],
              triggers: triggers as ConstraintInfo[],
            },
            Math.round(performance.now() - start),
            [
              {
                command: "dbctl migrate:plan",
                description: "Preview migrations that would execute",
              },
              {
                command: "dbctl migrate:apply",
                description: "Apply pending migrations",
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
          "MIGRATE_STATUS_FAILED",
          Math.round(performance.now() - start),
          { fix: "Ensure DATABASE_URL is set and PostgreSQL is reachable" }
        )
      );
      process.exitCode = EXIT.ERROR;
    }
  },
});
