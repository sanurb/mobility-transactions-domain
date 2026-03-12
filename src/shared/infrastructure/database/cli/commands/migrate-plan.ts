import { define } from "gunshi";
import { NAMED_MIGRATIONS } from "../../run-migrations.js";
import { emit, success } from "../envelope.js";

const COMMAND = "dbctl migrate:plan";

export const migratePlanCommand = define({
  name: "migrate:plan",
  description: "Dry-run: list migrations that would execute",
  run: () => {
    const start = performance.now();
    const migrations = NAMED_MIGRATIONS.map((m, i) => ({
      order: i + 1,
      name: m.name,
      idempotent: true,
    }));

    emit(
      success(
        COMMAND,
        { migrations, count: migrations.length },
        Math.round(performance.now() - start),
        [
          {
            command: "dbctl migrate:apply",
            description: "Apply these migrations",
          },
          {
            command: "dbctl migrate:status",
            description: "Check current constraint state",
          },
        ]
      )
    );
  },
});
