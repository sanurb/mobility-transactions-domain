/**
 * CLI entry point for the seed engine.
 *
 * Usage:
 *   pnpm with-env node --enable-source-maps dist/shared/infrastructure/database/seeds/run-seeds.js [flags]
 *
 * Flags (via environment variables):
 *   SEED_REPLAY=true          Re-run all seeds (prove idempotency)
 *   SEED_CATEGORY=reference   Only reference seeds (or "fixture", default "all")
 *   SEED_VERIFY_ONLY=true     Check integrity hashes without mutating
 *
 * Production guard:
 *   Blocked when NODE_ENV=production unless SEED_ALLOW_PRODUCTION=true.
 *
 * Exit code 1 on any failure.
 */

import { Sequelize } from "sequelize";
import { ensureSchema } from "./engine/ensure-schema.js";
import { runSeedEngine } from "./engine/seed-engine.js";
import type { SeedCategory } from "./engine/types.js";

const parseCategory = (raw: string | undefined): SeedCategory | "all" => {
  if (raw === "reference" || raw === "fixture") {
    return raw;
  }
  return "all";
};

const main = async (): Promise<void> => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("[seed] DATABASE_URL is not set. Aborting.");
    process.exit(1);
  }

  const sequelize = new Sequelize(databaseUrl, {
    dialect: "postgres",
    logging: false,
  });

  try {
    await sequelize.authenticate();
    console.log("[seed] Connected to database.");

    console.log("[seed] Ensuring schema exists...");
    await ensureSchema(sequelize);

    const result = await runSeedEngine({
      sequelize,
      replay: process.env.SEED_REPLAY === "true",
      category: parseCategory(process.env.SEED_CATEGORY),
      verifyOnly: process.env.SEED_VERIFY_ONLY === "true",
    });

    if (
      result.mode === "verify" &&
      result.verifications.some((v) => v.status === "DRIFTED")
    ) {
      process.exit(2);
    }
  } finally {
    await sequelize.close();
    console.log("[seed] Connection closed.");
  }
};

main().catch((err: unknown) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
