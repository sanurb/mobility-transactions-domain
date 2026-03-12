import { define } from "gunshi";
import { Umzug } from "umzug";
// Static import of seed catalog for Umzug
import { referenceSeed } from "../../seeds/catalog/0001-reference-drivers.js";
import { fixtureSeed } from "../../seeds/catalog/0002-fixture-scenarios.js";
import { ensureIntegrityTable } from "../../seeds/engine/seed-integrity.js";
import { SeedMetaStorage } from "../../seeds/engine/seed-meta-storage.js";
import type { SeedMigration } from "../../seeds/engine/types.js";
import { withConnection } from "../connection.js";
import { emit, failure, success } from "../envelope.js";
import { EXIT } from "../types.js";

const ALL_SEEDS: ReadonlyArray<SeedMigration> = [referenceSeed, fixtureSeed];
const COMMAND = "dbctl seed:plan";

export const seedPlanCommand = define({
  name: "seed:plan",
  description: "Dry-run: show pending seeds",
  run: async () => {
    const start = performance.now();
    try {
      await withConnection(async (sequelize) => {
        const storage = new SeedMetaStorage(sequelize);
        await storage.ensureTable();
        await ensureIntegrityTable(sequelize);

        const umzug = new Umzug({
          migrations: ALL_SEEDS.map((seed) => ({
            name: seed.name,
            up: async () => {},
            down: async () => {},
          })),
          storage,
          logger: undefined,
        });

        const pending = await umzug.pending();
        const executed = await umzug.executed();

        emit(
          success(
            COMMAND,
            {
              pending: pending.map((m) => m.name),
              executed: executed.map((m) => m.name),
              pending_count: pending.length,
              executed_count: executed.length,
            },
            Math.round(performance.now() - start),
            pending.length > 0
              ? [
                  {
                    command: "dbctl seed:apply",
                    description: "Apply pending seeds",
                  },
                ]
              : [
                  {
                    command: "dbctl seed:verify",
                    description: "Check integrity hashes",
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
          "SEED_PLAN_FAILED",
          Math.round(performance.now() - start),
          {
            fix: "Ensure schema exists. Run 'dbctl schema:ensure' first.",
            next_actions: [
              {
                command: "dbctl schema:ensure",
                description: "Bootstrap schema",
              },
            ],
          }
        )
      );
      process.exitCode = EXIT.ERROR;
    }
  },
});
