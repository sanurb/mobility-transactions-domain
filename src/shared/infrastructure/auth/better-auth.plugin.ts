/**
 * @fileoverview
 * Fastify plugin that mounts Better Auth endpoints.
 *
 * Registers a catch-all route at `/api/auth/*` that bridges
 * Fastify requests to Better Auth's Fetch-API handler.
 *
 * This plugin MUST be registered before domain routes so that
 * auth endpoints are available for sign-up / sign-in flows.
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { auth } from "./better-auth.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert Fastify IncomingHttpHeaders to a standard Headers object.
 */
const toFetchHeaders = (
  raw: Record<string, string | string[] | undefined>
): Headers => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const v of value) {
        headers.append(key, v);
      }
    } else {
      headers.append(key, value);
    }
  }
  return headers;
};

// ─────────────────────────────────────────────────────────────────────────────
// Plugin
// ─────────────────────────────────────────────────────────────────────────────

const betterAuthPluginFn: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  /**
   * Catch-all route for Better Auth endpoints.
   *
   * Converts the Fastify request into a Fetch-API Request,
   * delegates to `auth.handler`, and forwards the Response back.
   *
   * Better Auth handles:
   *   POST /api/auth/sign-up/email
   *   POST /api/auth/sign-in/email
   *   POST /api/auth/sign-out
   *   GET  /api/auth/get-session
   *   GET  /api/auth/token   (JWT plugin)
   *   GET  /api/auth/jwks    (JWT plugin)
   *   ... and all other auth endpoints
   */
  fastify.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    config: { public: true },
    async handler(request, reply) {
      const url = new URL(
        request.url,
        `${request.protocol}://${request.hostname}`
      );

      const headers = toFetchHeaders(
        request.headers as Record<string, string | string[] | undefined>
      );

      const fetchRequest = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      });

      const response = await auth.handler(fetchRequest);

      reply.status(response.status);
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });

      const body = response.body ? await response.text() : null;
      reply.send(body);
    },
  });
};

export const betterAuthPlugin = fp(betterAuthPluginFn, {
  name: "better-auth-plugin",
});
