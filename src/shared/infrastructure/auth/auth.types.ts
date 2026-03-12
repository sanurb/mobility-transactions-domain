import type { FastifyRequest } from "fastify";

/**
 * Available authorization scopes.
 * Follows principle of least privilege.
 */
export const AUTH_SCOPES = {
  // Rider scopes
  RIDER_READ: "rider:read",
  RIDER_WRITE: "rider:write",

  // Ride scopes
  RIDE_CREATE: "ride:create",
  RIDE_READ: "ride:read",
  RIDE_UPDATE: "ride:update",
  RIDE_CANCEL: "ride:cancel",

  // Driver scopes
  DRIVER_READ: "driver:read",
  DRIVER_WRITE: "driver:write",

  // Dispatch scopes
  DISPATCH_EXECUTE: "dispatch:execute",

  // Payment scopes
  PAYMENT_READ: "payment:read",
  PAYMENT_INITIATE: "payment:initiate",

  // Admin scopes
  ADMIN_READ: "admin:read",
  ADMIN_WRITE: "admin:write",
} as const;

export type AuthScope = (typeof AUTH_SCOPES)[keyof typeof AUTH_SCOPES];

/**
 * Default tenant identifier.
 *
 * Multi-tenancy is not enabled in v1.
 * A constant is used so existing service signatures that accept
 * `tenantId` continue to compile without modification.
 */
export const DEFAULT_TENANT_ID = "default" as const;

/**
 * Authenticated user context attached to every request
 * after session validation by the auth middleware.
 *
 * Replaces the previous jose-based TokenPayload.
 * Domain/Application layers consume this shape only -- they never
 * depend on Better Auth types directly.
 */
export interface UserContext {
  /** Better Auth user id (primary identity) */
  readonly id: string;
  /** Backward-compatible subject alias (same as id) */
  readonly sub: string;
  /** User email */
  readonly email: string;
  /** Display name */
  readonly name: string;
  /** Role: rider | driver | admin */
  readonly role: string;
  /** Rider identifier (present for rider role) */
  readonly riderId: string | undefined;
  /** Driver identifier (present for driver role) */
  readonly driverId: string | undefined;
  /** Authorization scopes derived from role */
  readonly scopes: readonly AuthScope[];
  /** Tenant identifier (constant "default" in v1) */
  readonly tenantId: string;
}

/**
 * Fastify request with authenticated user context.
 */
export interface AuthenticatedRequest extends FastifyRequest {
  user: UserContext;
}

/**
 * Type guard to check if request is authenticated.
 */
export const isAuthenticated = (
  request: FastifyRequest
): request is AuthenticatedRequest =>
  "user" in request && request.user !== undefined;
