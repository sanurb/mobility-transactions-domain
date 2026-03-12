/**
 * @fileoverview
 * Health check endpoint for the Fastify server.
 * Provides system health status for monitoring and load balancers.
 */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { checkDatabaseHealth } from "../../shared/infrastructure/database/index.js";

const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  timestamp: z.iso.datetime(),
  version: z.string(),
  checks: z.object({
    database: z.object({
      connected: z.boolean(),
      latencyMs: z.number(),
    }),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

/**
 * Health routes plugin for Fastify.
 * Provides health check endpoint at /health.
 */
/**
 * Health routes plugin for Fastify.
 * Provides health check endpoint at /health.
 */
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/health",
    {
      schema: {
        description: "Health check endpoint with dependency status",
        tags: ["system"],
        response: {
          200: healthResponseSchema,
        },
      },
    },
    async (): Promise<HealthResponse> => {
      const dbHealth = await checkDatabaseHealth();

      return {
        status: dbHealth.connected ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        checks: {
          database: {
            connected: dbHealth.connected,
            latencyMs: dbHealth.latencyMs,
          },
        },
      };
    }
  );
};
