import { define } from "gunshi";
import { runSeedEngine } from "../../seeds/engine/seed-engine.js";
import { withConnection } from "../connection.js";
import { emit, failure, success } from "../envelope.js";
import { EXIT } from "../types.js";

const COMMAND = "dbctl seed:verify";

export const seedVerifyCommand = define({
  name: "seed:verify",
  description: "Check integrity hashes (read-only)",
  run: async () => {
    const start = performance.now();
    try {
      await withConnection(async (sequelize) => {
        const result = await runSeedEngine({
          sequelize,
          verifyOnly: true,
          silent: true,
        });

        const hasDrift = result.verifications.some(
          (v) => v.status === "DRIFTED"
        );

        const envelope = success(
          COMMAND,
          {
            verifications: result.verifications,
            all_valid: !hasDrift,
            drift_count: result.verifications.filter(
              (v) => v.status === "DRIFTED"
            ).length,
          },
          Math.round(performance.now() - start),
          hasDrift
            ? [
                {
                  command: "dbctl seed:apply --replay",
                  description: "Re-apply seeds to fix drift",
                },
              ]
            : [
                {
                  command: "dbctl seed:status",
                  description: "View seed metadata",
                },
              ]
        );

        emit(envelope);

        if (hasDrift) {
          process.exitCode = EXIT.DRIFT;
        }
      });
    } catch (err) {
      emit(
        failure(
          COMMAND,
          err instanceof Error ? err.message : String(err),
          "SEED_VERIFY_FAILED",
          Math.round(performance.now() - start),
          {
            fix: "Ensure seeds have been applied. Run 'dbctl seed:apply' first.",
            next_actions: [
              {
                command: "dbctl seed:apply",
                description: "Apply seeds",
              },
            ],
          }
        )
      );
      process.exitCode = EXIT.ERROR;
    }
  },
});
