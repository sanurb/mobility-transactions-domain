/**
 * @fileoverview
 * Environment schema as the single source of truth.
 * All types and the env→schema map are derived from the schema; removing a key
 * causes compile errors (map, Config) and runtime validation failure when missing.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PORT_MIN = 1;
const PORT_MAX = 65_535;
const DEFAULT_PORT = 3000;
const APP_NAME_MAX_LENGTH = 100;
/** Minimum length for any secret (JWT, Better Auth, etc.). */
const SECRET_MIN_LENGTH = 32;

const POOL_DEFAULT_MIN = 2;
const POOL_DEFAULT_MAX = 10;
const POOL_DEFAULT_ACQUIRE_MS = 30_000;
const POOL_DEFAULT_IDLE_MS = 10_000;
const POOL_MIN_TIMEOUT_MS = 1000;

/** Supported log levels. */
export const LOG_LEVELS = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
] as const;

const coerceInt = () => z.coerce.number().int();

// ─────────────────────────────────────────────────────────────────────────────
// Schema (single source of truth)
// ─────────────────────────────────────────────────────────────────────────────

export const envSchema = z
  .object({
    port: coerceInt().min(PORT_MIN).max(PORT_MAX).default(DEFAULT_PORT),

    appName: z
      .string()
      .min(1)
      .max(APP_NAME_MAX_LENGTH)
      .default("Mobility Transactions API"),

    databaseUrl: z.string().url(),

    databasePoolMin: coerceInt().min(0).default(POOL_DEFAULT_MIN),

    databasePoolMax: coerceInt().min(1).default(POOL_DEFAULT_MAX),

    databasePoolAcquire: coerceInt()
      .min(POOL_MIN_TIMEOUT_MS)
      .default(POOL_DEFAULT_ACQUIRE_MS),

    databasePoolIdle: coerceInt()
      .min(POOL_MIN_TIMEOUT_MS)
      .default(POOL_DEFAULT_IDLE_MS),

    jwtIssuer: z.string().default("mobility-transactions"),

    jwtAudience: z.string().default("mobility-api"),

    betterAuthSecret: z.string().min(SECRET_MIN_LENGTH),

    betterAuthUrl: z.url().default("http://localhost:3000"),

    logLevel: z.enum(LOG_LEVELS).default("info"),

    logPretty: z.coerce.boolean().default(false),
  })
  .readonly();

/** Validated environment type (after parsing). Derived only from schema. */
export type EnvSchema = z.infer<typeof envSchema>;

/** Raw environment input type (before validation). Derived only from schema. */
export type EnvInput = z.input<typeof envSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Env → schema map (values must be schema keys; removing a schema key errors here)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps process.env keys to schema keys. Values are constrained to keyof EnvSchema;
 * if you remove a key from the schema, any map entry pointing at it fails type-check.
 */
export const ENV_TO_SCHEMA_MAP = {
  PORT: "port",
  APP_NAME: "appName",
  DATABASE_URL: "databaseUrl",
  DATABASE_POOL_MIN: "databasePoolMin",
  DATABASE_POOL_MAX: "databasePoolMax",
  DATABASE_POOL_ACQUIRE: "databasePoolAcquire",
  DATABASE_POOL_IDLE: "databasePoolIdle",
  JWT_ISSUER: "jwtIssuer",
  JWT_AUDIENCE: "jwtAudience",
  BETTER_AUTH_SECRET: "betterAuthSecret",
  BETTER_AUTH_URL: "betterAuthUrl",
  LOG_LEVEL: "logLevel",
  LOG_PRETTY: "logPretty",
} as const satisfies Record<string, keyof EnvSchema>;

export type EnvVarName = keyof typeof ENV_TO_SCHEMA_MAP;
