import { define } from "gunshi";
import { withConnection } from "../connection.js";
import { emit, failure, success } from "../envelope.js";
import { EXIT } from "../types.js";

const COMMAND = "dbctl seed:status";

export const seedStatusCommand = define({
  name: "seed:status",
  description: "Query seed_meta + seed_integrity tables",
  run: async () => {
    const start = performance.now();
    try {
      await withConnection(async (sequelize) => {
        // Check if tables exist before querying
        const [metaExists] = await sequelize.query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'seed_meta'
          ) AS exists
        `);

        const [integrityExists] = await sequelize.query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'seed_integrity'
          ) AS exists
        `);

        const hasMeta = (metaExists as Array<{ exists: boolean }>)[0]?.exists;
        const hasIntegrity = (integrityExists as Array<{ exists: boolean }>)[0]
          ?.exists;

        const seeds = hasMeta
          ? (
              await sequelize.query(
                `SELECT name, category, hash, duration_ms, rows_affected, applied_at::text
               FROM seed_meta ORDER BY applied_at`
              )
            )[0]
          : [];

        const integrity = hasIntegrity
          ? (
              await sequelize.query(
                "SELECT name, hash, verified_at::text FROM seed_integrity ORDER BY name"
              )
            )[0]
          : [];

        emit(
          success(
            COMMAND,
            {
              tables: {
                seed_meta: hasMeta,
                seed_integrity: hasIntegrity,
              },
              seeds,
              integrity,
            },
            Math.round(performance.now() - start),
            [
              {
                command: "dbctl seed:verify",
                description: "Check integrity hashes for drift",
              },
              {
                command: "dbctl seed:plan",
                description: "Preview pending seeds",
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
          "SEED_STATUS_FAILED",
          Math.round(performance.now() - start),
          { fix: "Ensure DATABASE_URL is set and PostgreSQL is reachable" }
        )
      );
      process.exitCode = EXIT.ERROR;
    }
  },
});
