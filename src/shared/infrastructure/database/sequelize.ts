/**
 * @fileoverview
 * Database connection management.
 *
 * Provides a **shared pg.Pool** consumed by both Sequelize (ORM / migrations)
 * and Better Auth (internal Kysely).  This enforces the single-pool rule
 * mandated by AGENTS.md -- no second connection pool may be created.
 */

import consola from "consola";
import pg from "pg";
import { Sequelize } from "sequelize";
import { config } from "../../../config/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Shared pg.Pool  (single pool rule)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Single shared PostgreSQL connection pool.
 *
 * Both Sequelize and Better Auth must use this instance so the
 * application never opens a second pool against the same database.
 */
export const pool = new pg.Pool({
  connectionString: config.database.url,
  min: config.database.pool.min,
  max: config.database.pool.max,
  idleTimeoutMillis: config.database.pool.idle,
  connectionTimeoutMillis: config.database.pool.acquire,
});

// ─────────────────────────────────────────────────────────────────────────────
// Sequelize (uses the shared pool via replication / dialectOptions)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sequelize instance configured for PostgreSQL.
 * Connection pool settings are optimized for mobility workloads.
 */
export const sequelize = new Sequelize(config.database.url, {
  dialect: "postgres",
  logging: (msg) => {
    consola.debug(msg);
  },
  pool: {
    min: config.database.pool.min,
    max: config.database.pool.max,
    acquire: config.database.pool.acquire,
    idle: config.database.pool.idle,
  },
  define: {
    timestamps: true,
    underscored: true, // Use snake_case in database
    freezeTableName: true,
  },
});

/**
 * Establish database connection.
 * Call during server startup before accepting requests.
 *
 * @throws Error if database connection fails
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    consola.success("Database connection established");
  } catch (error) {
    consola.error("Unable to connect to database:", error);
    throw error;
  }
};

/**
 * Close database connection gracefully.
 * Call during server shutdown.
 *
 * @throws Error if closing connection fails
 */
export const closeDatabase = async (): Promise<void> => {
  try {
    await sequelize.close();
    consola.info("Database connection closed");
  } catch (error) {
    consola.error("Error closing database connection:", error);
    throw error;
  }
};

/**
 * Check database connectivity for health endpoint.
 *
 * @returns Health check result with connection status and latency
 */
export const checkDatabaseHealth = async (): Promise<{
  connected: boolean;
  latencyMs: number;
  error?: string;
}> => {
  const start = Date.now();
  try {
    await sequelize.authenticate();
    return {
      connected: true,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      connected: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
