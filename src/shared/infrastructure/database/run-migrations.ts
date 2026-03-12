/**
 * Migration runner for database constraints and triggers.
 *
 * Executes migrations in a fixed order, ensuring idempotency via IF NOT EXISTS guards.
 * Callable from tests and CLI - no sync module coupling, zero side effects on import.
 *
 * Design principles:
 * - Idempotent: safe to run multiple times
 * - Additive-only: never drops/renames/repurposes
 * - Ordered: runs in dependency-aware sequence
 * - Testable: works with any Sequelize instance
 */

import type { Sequelize } from "sequelize";
import { addFareConstraints } from "../../../modules/fares/infrastructure/migrations/add-fare-constraints.js";
import { addPaymentConstraints } from "../../../modules/payments/infrastructure/migrations/add-payment-constraints.js";
import { addRideConstraints } from "../../../modules/rides/infrastructure/migrations/add-ride-constraints.js";

/**
 * Migration function signature.
 * Each migration receives a Sequelize instance and executes raw SQL.
 */
export type MigrationFn = (sequelize: Sequelize) => Promise<void>;

export interface NamedMigration {
  readonly name: string;
  readonly fn: MigrationFn;
}

export interface MigrationResult {
  readonly name: string;
  readonly duration_ms: number;
}

/**
 * Ordered migration registry with names.
 * Migrations run in array order - earlier entries must not depend on later ones.
 */
export const NAMED_MIGRATIONS: ReadonlyArray<NamedMigration> = [
  { name: "add-payment-constraints", fn: addPaymentConstraints },
  { name: "add-fare-constraints", fn: addFareConstraints },
  { name: "add-ride-constraints", fn: addRideConstraints },
];

/**
 * Run all database migrations in fixed order.
 *
 * Each migration is idempotent (IF NOT EXISTS guards), so safe to run repeatedly.
 * Runs all migrations in a single pass - does not track which have been applied.
 *
 * @param sequelize - Sequelize instance with active connection
 * @throws Error if any migration fails
 */
export const runMigrations = async (sequelize: Sequelize): Promise<void> => {
  for (const migration of NAMED_MIGRATIONS) {
    await migration.fn(sequelize);
  }
};

/**
 * Run all migrations and return timing results for each.
 */
export const runMigrationsWithResults = async (
  sequelize: Sequelize
): Promise<MigrationResult[]> => {
  const results: MigrationResult[] = [];
  for (const migration of NAMED_MIGRATIONS) {
    const start = performance.now();
    await migration.fn(sequelize);
    results.push({
      name: migration.name,
      duration_ms: Math.round(performance.now() - start),
    });
  }
  return results;
};
