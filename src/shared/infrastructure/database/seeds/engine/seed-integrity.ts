/**
 * Integrity hash computation and drift detection.
 *
 * Computes SHA-256 of canonical seed data and persists it in a seed_integrity
 * table. On re-runs, detects when seed definitions have changed (drift).
 */

import { createHash } from "node:crypto";
import type { Sequelize, Transaction } from "sequelize";

/** Compute deterministic SHA-256 hash of canonical seed data. */
export const computeHash = (data: unknown): string => {
  const json = JSON.stringify(data, null, 0);
  return createHash("sha256").update(json).digest("hex");
};

/** Create seed_integrity table if it does not exist. */
export const ensureIntegrityTable = async (
  sequelize: Sequelize
): Promise<void> => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS seed_integrity (
      name       VARCHAR(255) PRIMARY KEY,
      hash       VARCHAR(64)  NOT NULL,
      verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

/** Persist hash inside the current SERIALIZABLE transaction. */
export const storeHash = async (
  sequelize: Sequelize,
  transaction: Transaction,
  name: string,
  hash: string
): Promise<void> => {
  await sequelize.query(
    `INSERT INTO seed_integrity (name, hash, verified_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (name)
     DO UPDATE SET hash = EXCLUDED.hash, verified_at = NOW()`,
    { bind: [name, hash], transaction }
  );
};

/** Check whether the stored hash matches the current seed data hash. */
export const checkDrift = async (
  sequelize: Sequelize,
  name: string,
  currentHash: string
): Promise<{ drifted: boolean; previousHash: string | null }> => {
  const [rows] = await sequelize.query(
    "SELECT hash FROM seed_integrity WHERE name = $1",
    { bind: [name] }
  );
  const row = (rows as Array<{ hash: string }>)[0];
  if (!row) {
    return { drifted: false, previousHash: null };
  }
  return { drifted: row.hash !== currentHash, previousHash: row.hash };
};
