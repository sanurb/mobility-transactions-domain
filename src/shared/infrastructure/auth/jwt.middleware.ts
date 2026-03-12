/**
 * @fileoverview
 * Authentication and authorization middleware.
 *
 * Validates every non-public request by resolving the Better Auth
 * session (cookie or Bearer token via the bearer plugin).
 * Maps the authenticated user's role to authorization scopes and
 * attaches a `UserContext` to the request.
 *
 * Public paths and routes marked `{ config: { public: true } }`
 * bypass authentication entirely.
 */

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import fp from "fastify-plugin";
import {
  AuthenticationError,
  AuthorizationError,
} from "../../../shared/errors/error-types.js";
import {
  createErrorResponse,
  mapDomainErrorToHttpStatus,
} from "../../../shared/errors/http-error-mapper.js";
import type { AuthScope, UserContext } from "./auth.types.js";
import { AUTH_SCOPES, DEFAULT_TENANT_ID } from "./auth.types.js";
import { auth } from "./better-auth.js";
import { getScopesForRole } from "./role-scopes.js";

// ─────────────────────────────────────────────────────────────────────────────
// Extend Fastify types so `request.user` is available everywhere
// ─────────────────────────────────────────────────────────────────────────────

declare module "fastify" {
  interface FastifyRequest {
    user?: UserContext;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Paths that are accessible without authentication.
 *
 * SECURITY: Adding a path here means it is publicly accessible.
 * Review security requirements before modifying this list.
 */
const PUBLIC_PATHS = [
  "/health",
  "/docs",
  "/",
  "/api/v1/health",
  "/api/auth/", // Better Auth endpoints are self-authenticating
] as const;

const ROOT_PATH = "/";
const VALID_SCOPES = new Set<AuthScope>(Object.values(AUTH_SCOPES));

const isPublicPath = (urlPath: string): boolean => {
  return PUBLIC_PATHS.some((path) => {
    if (path === ROOT_PATH) {
      return urlPath === ROOT_PATH;
    }
    return urlPath === path || urlPath.startsWith(`${path}/`);
  });
};

const parseExplicitScopes = (rawScopes: string): readonly AuthScope[] => {
  if (rawScopes.length === 0) {
    return [];
  }
  return rawScopes
    .split(",")
    .map((scope) => scope.trim())
    .filter((scope): scope is AuthScope =>
      VALID_SCOPES.has(scope as AuthScope)
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Plugin
// ─────────────────────────────────────────────────────────────────────────────

const authMiddlewarePlugin: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  fastify.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Skip authentication for routes marked as public in route config
      const routeConfig = request.routeOptions?.config as
        | { public?: boolean }
        | undefined;
      if (routeConfig?.public === true) {
        return;
      }

      // Skip authentication for known public paths
      const urlPath = request.url.split("?").at(0) ?? "";
      if (isPublicPath(urlPath)) {
        return;
      }

      // ── Resolve session via Better Auth ──────────────────────────────
      // The bearer plugin allows `Authorization: Bearer <session_token>`
      // alongside cookie-based sessions. `getSession` handles both.
      const session = await auth.api.getSession({ headers: request.headers });

      if (!session) {
        const error = new AuthenticationError(
          "Missing or invalid authentication"
        );
        const requestId = request.id || "unknown";
        reply
          .status(mapDomainErrorToHttpStatus(error))
          .send(createErrorResponse(error, requestId));
        return;
      }

      // ── Build UserContext ─────────────────────────────────────────────
      const user = session.user;
      const userRecord = user as Record<string, unknown>;
      const role = (userRecord.role as string | undefined) ?? "rider";
      const explicitScopesRaw =
        typeof userRecord.authScopes === "string"
          ? userRecord.authScopes
          : undefined;
      const scopes =
        explicitScopesRaw !== undefined
          ? parseExplicitScopes(explicitScopesRaw)
          : getScopesForRole(role);

      const userContext: UserContext = {
        id: user.id,
        sub: user.id,
        email: user.email,
        name: user.name,
        role,
        riderId: role === "rider" ? user.id : undefined,
        driverId: role === "driver" ? user.id : undefined,
        scopes,
        tenantId: DEFAULT_TENANT_ID,
      };

      request.user = userContext;
    }
  );
};

export const authMiddleware = fp(authMiddlewarePlugin, {
  name: "auth-middleware",
});

// ─────────────────────────────────────────────────────────────────────────────
// Scope validation decorator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scope validation decorator for route handlers.
 * Use in route options: `{ preHandler: requireScopes(['ride:create']) }`
 */
export const requireScopes = (requiredScopes: AuthScope[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      const error = new AuthenticationError("Authentication required");
      const requestId = request.id || "unknown";
      reply
        .status(mapDomainErrorToHttpStatus(error))
        .send(createErrorResponse(error, requestId));
      return;
    }

    const userScopes = new Set(request.user.scopes);
    const missingScopes = requiredScopes.filter(
      (scope) => !userScopes.has(scope)
    );

    if (missingScopes.length > 0) {
      const error = new AuthorizationError(
        `Missing required scopes: ${missingScopes.join(", ")}`,
        missingScopes.at(0)
      );
      const requestId = request.id || "unknown";
      reply
        .status(mapDomainErrorToHttpStatus(error))
        .send(createErrorResponse(error, requestId));
    }
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get authenticated user from request.
 * Throws if user is not authenticated (use after auth middleware).
 */
export const getAuthenticatedUser = (request: FastifyRequest): UserContext => {
  if (!request.user) {
    throw new AuthenticationError("User not authenticated");
  }
  return request.user;
};
