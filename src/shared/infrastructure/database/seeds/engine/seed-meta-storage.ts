/**
 * Custom Umzug storage backed by a seed_meta ledger table.
 *
 * Records richer metadata than standard Umzug storage: category, integrity
 * hash, duration, and affected row count alongside the seed name.
 *
 * Metadata is staged via setPendingMeta() during seed execution, then
 * persisted atomically when Umzug calls logMigration().
 */

import type { Sequelize } from "sequelize";
import type { UmzugStorage } from "umzug";
import type { SeedMetaRecord } from "./types.js";

export class SeedMetaStorage implements UmzugStorage {
  private readonly sequelize: Sequelize;
  private readonly pendingMeta = new Map<
    string,
    Omit<SeedMetaRecord, "name">
  >();

  constructor(sequelize: Sequelize) {
    this.sequelize = sequelize;
  }

  /** Create the seed_meta ledger table if it does not exist. */
  async ensureTable(): Promise<void> {
    await this.sequelize.query(`
      CREATE TABLE IF NOT EXISTS seed_meta (
        name          VARCHAR(255) PRIMARY KEY,
        category      VARCHAR(32)  NOT NULL,
        hash          VARCHAR(64)  NOT NULL,
        duration_ms   INTEGER      NOT NULL,
        rows_affected INTEGER      NOT NULL,
        applied_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
  }

  /** Stage metadata to be persisted on next logMigration call. */
  setPendingMeta(name: string, meta: Omit<SeedMetaRecord, "name">): void {
    this.pendingMeta.set(name, meta);
  }

  async logMigration({ name }: { name: string }): Promise<void> {
    const meta = this.pendingMeta.get(name);
    if (meta) {
      await this.sequelize.query(
        `INSERT INTO seed_meta (name, category, hash, duration_ms, rows_affected, applied_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (name) DO UPDATE SET
           category = EXCLUDED.category,
           hash = EXCLUDED.hash,
           duration_ms = EXCLUDED.duration_ms,
           rows_affected = EXCLUDED.rows_affected,
           applied_at = NOW()`,
        {
          bind: [
            name,
            meta.category,
            meta.hash,
            meta.duration_ms,
            meta.rows_affected,
          ],
        }
      );
      this.pendingMeta.delete(name);
    } else {
      await this.sequelize.query(
        `INSERT INTO seed_meta (name, category, hash, duration_ms, rows_affected)
         VALUES ($1, 'unknown', '', 0, 0)
         ON CONFLICT (name) DO NOTHING`,
        { bind: [name] }
      );
    }
  }

  async unlogMigration({ name }: { name: string }): Promise<void> {
    await this.sequelize.query("DELETE FROM seed_meta WHERE name = $1", {
      bind: [name],
    });
  }

  async executed(): Promise<string[]> {
    const [rows] = await this.sequelize.query(
      "SELECT name FROM seed_meta ORDER BY applied_at"
    );
    return (rows as Array<{ name: string }>).map((r) => r.name);
  }
}
