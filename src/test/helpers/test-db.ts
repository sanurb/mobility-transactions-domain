import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { Sequelize } from "sequelize";
import { ensureSchema } from "../../shared/infrastructure/database/seeds/engine/ensure-schema.js";
import { runSeedEngine } from "../../shared/infrastructure/database/seeds/engine/seed-engine.js";

let container: StartedPostgreSqlContainer | null = null;
let testSequelize: Sequelize | null = null;

/**
 * Start PostgreSQL container and return connection URL
 * Called once per test run in global setup
 */
export const startTestDatabase = async (): Promise<string> => {
  console.log("[TestDB] Starting PostgreSQL container...");

  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("mobility_test")
    .withUsername("test")
    .withPassword("test")
    .withExposedPorts(5432)
    .start();

  const connectionUrl = container.getConnectionUri();
  console.log(`[TestDB] PostgreSQL started at ${connectionUrl}`);

  // Store connection URL for tests
  process.env.DATABASE_URL = connectionUrl;

  // Ensure Better Auth tables exist (E2E and integration tests use auth)
  await runBetterAuthSchema();

  return connectionUrl;
};

/**
 * Run Better Auth schema SQL so auth tables exist.
 * Idempotent: ignores errors if tables already exist (e.g. from migrations).
 */
export const runBetterAuthSchema = async (
  sequelizeOverride?: Sequelize
): Promise<void> => {
  const sequelize = sequelizeOverride ?? getTestSequelize();
  const schemaPath = join(
    process.cwd(),
    "migrations",
    "better-auth.schema.sql"
  );
  const sql = readFileSync(schemaPath, "utf-8");
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const statement of statements) {
    try {
      await sequelize.query(statement);
    } catch (err) {
      // Ignore "already exists" so we are idempotent
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("already exists")) {
        throw err;
      }
    }
  }
};

/**
 * Stop PostgreSQL container
 * Called once per test run in global teardown
 */
export const stopTestDatabase = async (): Promise<void> => {
  if (testSequelize) {
    console.log("[TestDB] Closing Sequelize connection...");
    await testSequelize.close();
    testSequelize = null;
  }

  if (container) {
    console.log("[TestDB] Stopping PostgreSQL container...");
    await container.stop();
    container = null;
  }
};

/**
 * Get Sequelize instance for test database
 */
export const getTestSequelize = (): Sequelize => {
  if (!testSequelize) {
    const connectionUrl = process.env.DATABASE_URL;
    if (!connectionUrl) {
      throw new Error("DATABASE_URL not set. Did you run startTestDatabase()?");
    }

    testSequelize = new Sequelize(connectionUrl, {
      dialect: "postgres",
      logging: false, // Quiet during tests
      pool: {
        min: 1,
        max: 5,
        acquire: 30_000,
        idle: 10_000,
      },
    });
  }

  return testSequelize;
};

/**
 * Required tables that must exist after initTestDb().
 * If any are missing, the bootstrap failed silently.
 */
const REQUIRED_TABLES = [
  "rides",
  "payment_intents",
  "settlement_attempts",
  "fare_calculations",
  "drivers",
  "dispatch_audits",
  "payment_outbox",
] as const;

/**
 * Assert that all required relations exist in the public schema.
 * Throws immediately if any table is missing, catching silent bootstrap failures.
 */
const assertRequiredRelations = async (sequelize: Sequelize): Promise<void> => {
  const [rows] = await sequelize.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
  );
  const existing = new Set(
    (rows as Array<{ tablename: string }>).map((r) => r.tablename)
  );
  const missing = REQUIRED_TABLES.filter((t) => !existing.has(t));
  if (missing.length > 0) {
    throw new Error(
      `[initTestDb] Missing required tables after bootstrap: ${missing.join(", ")}`
    );
  }
};

/**
 * Single bootstrap path for all integration tests that touch persistence.
 *
 * 1. Hard reset: DROP SCHEMA public CASCADE; CREATE SCHEMA public
 * 2. Better Auth tables (auth infra)
 * 3. All models + sync + constraint migrations via ensureSchema()
 * 4. Preflight: assert required relations exist
 */
export const initTestDb = async (): Promise<Sequelize> => {
  const sequelize = getTestSequelize();
  await sequelize.query("DROP SCHEMA public CASCADE");
  await sequelize.query("CREATE SCHEMA public");
  await runBetterAuthSchema(sequelize);
  await ensureSchema(sequelize);
  await assertRequiredRelations(sequelize);
  return sequelize;
};

/**
 * Clean all tables between tests
 * Uses TRUNCATE for speed, resets sequences
 */
export const cleanTestDatabase = async (): Promise<void> => {
  const sequelize = getTestSequelize();

  // Get all table names (excluding system tables)
  const [tables] = await sequelize.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT LIKE 'sequelize%'
    AND tablename NOT IN ('user', 'session', 'account', 'verification', 'jwks')
  `);

  if (tables.length === 0) {
    return;
  }

  const tableNames = (tables as Array<{ tablename: string }>)
    .map((t) => `"${t.tablename}"`)
    .join(", ");

  // Truncate all tables with CASCADE and restart identity.
  try {
    await sequelize.query(
      `TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("does not exist")) {
      // Table was dropped by sync({ force: true }) – nothing to truncate
      return;
    }
    throw err;
  }
};

/**
 * Seed test data for specific scenarios
 * Extend with domain-specific seed functions
 */
export const seedTestData = async (scenario: string): Promise<void> => {
  const sequelize = getTestSequelize();

  switch (scenario) {
    case "empty":
      // Already clean
      break;
    case "basic":
      await runSeedEngine({ sequelize, replay: true });
      break;
    default:
      throw new Error(`Unknown test scenario: ${scenario}`);
  }
};
