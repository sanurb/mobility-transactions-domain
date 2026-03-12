/**
 * @fileoverview
 * Better Auth instance configuration.
 *
 * This is the single source of truth for authentication.
 * It configures Better Auth with:
 * - PostgreSQL via the shared pg.Pool (single pool rule)
 * - Email + password authentication
 * - Bearer plugin for API token authentication
 * - JWT plugin for asymmetric token issuance + JWKS
 * - Extended user model with `role` field
 *
 * IMPORTANT: This module lives in the infrastructure layer.
 * Domain and Application layers MUST NOT import from here directly.
 */

import { betterAuth } from "better-auth";
import { bearer, jwt } from "better-auth/plugins";
import { config } from "../../../config/index.js";
import { pool } from "../database/index.js";

/**
 * Supported user roles.
 * Used as a discriminant for the role-to-scope mapping.
 */
export const USER_ROLES = ["rider", "driver", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Better Auth instance.
 *
 * Uses the shared pg.Pool so no second connection pool is created.
 * Bearer plugin enables `Authorization: Bearer <session_token>` flows.
 * JWT plugin provides `/api/auth/token` and `/api/auth/jwks` endpoints.
 */
export const auth = betterAuth({
  baseURL: config.betterAuth.url,
  secret: config.betterAuth.secret,
  database: pool,

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh after 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "rider",
        input: false, // role is set server-side only, never from signup
      },
      authScopes: {
        type: "string",
        required: false,
        defaultValue: "",
        input: false, // only infrastructure/tests may override explicit scopes
      },
    },
  },
  advanced: {
    disableOriginCheck: true,
  },

  plugins: [
    bearer(),
    jwt({
      jwt: {
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
        expirationTime: "15m",
        definePayload: ({ user }) => ({
          id: user.id,
          email: user.email,
          name: user.name,
          role: ((user as Record<string, unknown>).role as string) ?? "rider",
        }),
      },
    }),
  ],

  trustedOrigins: [config.betterAuth.url],
});

/** Inferred Better Auth types for use in adapters. */
export type BetterAuthInstance = typeof auth;
