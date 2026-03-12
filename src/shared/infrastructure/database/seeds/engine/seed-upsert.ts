/**
 * Typed UPSERT helper for seed mutations.
 *
 * Generates parameterized INSERT ... ON CONFLICT SQL.
 * - Mutable tables: ON CONFLICT ... DO UPDATE SET (full overwrite = idempotent)
 * - Immutable tables: ON CONFLICT ... DO NOTHING (insert-once = idempotent)
 *
 * All values are explicit — no DEFAULT fallbacks, no non-deterministic generation.
 */

import type { SeedContext } from "./types.js";

/**
 * Insert rows with explicit ON CONFLICT handling.
 *
 * @param ctx           - Seed context (sequelize + transaction)
 * @param table         - Target table name
 * @param rows          - Array of row objects (all columns explicit)
 * @param conflictTarget - SQL conflict target, e.g. "(id)" or "(ride_id)"
 * @param mutable       - true: DO UPDATE SET all columns; false: DO NOTHING
 * @returns Number of rows processed
 */
export const upsertRows = async (
  ctx: SeedContext,
  table: string,
  rows: ReadonlyArray<Record<string, unknown>>,
  conflictTarget: string,
  mutable: boolean
): Promise<number> => {
  for (const row of rows) {
    const keys = Object.keys(row);
    const columns = keys.map((k) => `"${k}"`).join(", ");
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const values = keys.map((k) => row[k]);

    let sql: string;
    if (mutable) {
      const updates = keys.map((k) => `"${k}" = EXCLUDED."${k}"`).join(", ");
      sql =
        `INSERT INTO "${table}" (${columns}) VALUES (${placeholders}) ` +
        `ON CONFLICT ${conflictTarget} DO UPDATE SET ${updates}`;
    } else {
      sql =
        `INSERT INTO "${table}" (${columns}) VALUES (${placeholders}) ` +
        `ON CONFLICT ${conflictTarget} DO NOTHING`;
    }

    await ctx.sequelize.query(sql, {
      bind: values,
      transaction: ctx.transaction,
    });
  }

  return rows.length;
};
