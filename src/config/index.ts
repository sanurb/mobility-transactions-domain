/**
 * @fileoverview
 * Configuration module: validates env and builds Config.
 * Does not load .env; the process entry (e.g. index.ts) must run `import 'dotenv/config'`
 * before any code that uses config. Env is injected so tests need not touch process.env.
 */

import { Singleton } from "../shared/core/singleton.js";
import type { EnvInput, EnvSchema } from "./env.schema.js";
import { ENV_TO_SCHEMA_MAP, envSchema } from "./env.schema.js";

// ─────────────────────────────────────────────────────────────────────────────
// Type
// ─────────────────────────────────────────────────────────────────────────────

/** Application configuration structure. */
export interface Config {
  readonly server: {
    readonly port: number;
  };
  readonly app: {
    readonly name: string;
  };
  readonly database: {
    readonly url: string;
    readonly pool: {
      readonly min: number;
      readonly max: number;
      readonly acquire: number;
      readonly idle: number;
    };
  };
  readonly logging: {
    readonly level: EnvSchema["logLevel"];
    readonly pretty: boolean;
  };
  readonly jwt: {
    readonly issuer: string;
    readonly audience: string;
  };
  readonly betterAuth: {
    readonly secret: string;
    readonly url: string;
  };
}

/**
 * Environment source: key-value map (e.g. process.env).
 * Caller is responsible for loading .env; this module only reads from the given source.
 */
export type EnvSource = Readonly<Record<string, string | undefined>>;

// ─────────────────────────────────────────────────────────────────────────────
// Env → schema input (single place that defines what we read from env)
// ─────────────────────────────────────────────────────────────────────────────

/** Builds schema-shaped input from an env source using ENV_TO_SCHEMA_MAP. */
function buildEnvInputFromSource(source: EnvSource): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [envKey, schemaKey] of Object.entries(ENV_TO_SCHEMA_MAP)) {
    result[schemaKey] = source[envKey];
  }
  return result;
}

/** Transforms validated env into Config structure. */
function transformToConfig(env: EnvSchema): Config {
  return Object.freeze({
    server: Object.freeze({
      port: env.port,
    }),
    app: Object.freeze({
      name: env.appName,
    }),
    database: Object.freeze({
      url: env.databaseUrl,
      pool: Object.freeze({
        min: env.databasePoolMin,
        max: env.databasePoolMax,
        acquire: env.databasePoolAcquire,
        idle: env.databasePoolIdle,
      }),
    }),
    logging: Object.freeze({
      level: env.logLevel,
      pretty: env.logPretty,
    }),
    jwt: Object.freeze({
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
    }),
    betterAuth: Object.freeze({
      secret: env.betterAuthSecret,
      url: env.betterAuthUrl,
    }),
  });
}

/** Parses and validates env input; throws with structured message on failure. */
function parseEnv(input: Record<string, unknown>): EnvSchema {
  const result = envSchema.safeParse(input);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${errors}`);
  }

  return result.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads and validates config from an env source. Pure function; no side effects.
 * Use this in tests with a fake env so tests need not mutate process.env (B.28).
 */
export function loadConfig(source: EnvSource): loadConfig {
  const input = buildEnvInputFromSource(source);
  const validated = parseEnv(input);
  return transformToConfig(validated);
}

const configSingleton = new Singleton<Config>(() => loadConfig(process.env));

/** Validated, frozen configuration. Reads process.env at first access; entry must load dotenv first. */
export const config: Config = configSingleton.get();

/**
 * Builds a Config for tests with overrides. Does not read process.env; uses defaults + overrides only.
 */
export function createTestConfig(overrides: Partial<EnvInput> = {}): Config {
  const defaults: EnvInput = {
    port: 3000,
    appName: "Test App",
    databaseUrl: "postgresql://test:test@localhost:5432/test",
    betterAuthSecret: "b".repeat(32),
    betterAuthUrl: "http://localhost:3000",
  };

  const validated = parseEnv({ ...defaults, ...overrides });
  return transformToConfig(validated);
}

export type { EnvInput, EnvSchema } from "./env.schema.js";
export { ENV_TO_SCHEMA_MAP, envSchema, LOG_LEVELS } from "./env.schema.js";
