/**
 * Data factory for environment configuration testing.
 * Provides default values with override capability per testing rules C.3–C.7.
 * All required EnvInput fields are set; schema defaults apply when omitted.
 */

import type { EnvInput } from "../../config/env.schema.js";

const DEFAULT_PORT = 3000;
const DEFAULT_APP_NAME = "Test App";
const DEFAULT_DATABASE_URL =
  "postgresql://testuser:testpass@localhost:5432/testdb";
const BETTER_AUTH_SECRET_MIN_LENGTH = 32;

/** Builds env input with sensible defaults; override specific fields as needed. */
export function buildEnv(overrides: Partial<EnvInput> = {}): EnvInput {
  return {
    port: DEFAULT_PORT,
    appName: DEFAULT_APP_NAME,
    databaseUrl: DEFAULT_DATABASE_URL,
    betterAuthSecret: "y".repeat(BETTER_AUTH_SECRET_MIN_LENGTH),
    betterAuthUrl: "http://localhost:3000",
    ...overrides,
  };
}
