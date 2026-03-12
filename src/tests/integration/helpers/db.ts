/**
 * Database test helpers for integration tests.
 *
 * Provides utilities for running SQL against test database with type safety.
 * Wraps existing testcontainers setup with ergonomic query helpers.
 */

import type { Sequelize, Transaction } from "sequelize";
import { runMigrations } from "../../../shared/infrastructure/database/run-migrations.js";
import { getTestSequelize } from "../../../test/helpers/test-db.js";

/**
 * Execute raw SQL query with parameters.
 * Returns query result for SELECT queries, undefined for mutations.
 *
 * @param sql - Raw SQL query (use $1, $2 for params)
 * @param params - Query parameters (optional)
 * @returns Query result rows or undefined
 */
export const exec = async <T = unknown>(
  sql: string,
  params?: unknown[]
): Promise<T[] | undefined> => {
  const sequelize = getTestSequelize();
  const [results] = await sequelize.query(sql, {
    replacements: params,
    type: "RAW",
  });
  return results as T[] | undefined;
};

/**
 * Execute SQL within a transaction.
 * Transaction auto-commits on success, auto-rolls back on error.
 *
 * @param fn - Async function to execute within transaction
 * @returns Result of the function
 */
export const withTx = async <T>(
  fn: (tx: Transaction) => Promise<T>
): Promise<T> => {
  const sequelize = getTestSequelize();
  return sequelize.transaction(fn);
};

/**
 * Apply all database migrations.
 * Idempotent - safe to call multiple times.
 * Call once per test suite in beforeAll.
 *
 * @returns Promise that resolves when migrations complete
 */
export const applyMigrations = async (): Promise<void> => {
  const sequelize = getTestSequelize();
  await runMigrations(sequelize);
};

/**
 * Get Sequelize instance for advanced operations.
 * Prefer exec() and withTx() for most test scenarios.
 *
 * @returns Sequelize instance connected to test database
 */
export const getSequelize = (): Sequelize => {
  return getTestSequelize();
};
