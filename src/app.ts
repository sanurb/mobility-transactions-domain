/**
 * @fileoverview
 * Fastify application factory.
 * Configures the Fastify instance with plugins and routes.
 */

import { randomUUID } from "node:crypto";
import compress from "@fastify/compress";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyError, type FastifyPluginAsync } from "fastify";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";
import { config } from "./config/index.js";
import { initDispatchModule } from "./modules/dispatch/index.js";
import { initDriverModule } from "./modules/drivers/index.js";
import { initFareModule } from "./modules/fares/index.js";
import { healthRoutes } from "./modules/health/health.controller.js";
import {
  type GetRiderIdFn,
  initPaymentModule,
} from "./modules/payments/index.js";
import { initRideModule } from "./modules/rides/index.js";
import {
  createErrorResponse,
  createNotFoundRouteResponse,
  createUnexpectedErrorResponse,
  createZodErrorResponse,
  isDomainError,
  mapDomainErrorToHttpStatus,
} from "./shared/errors/http-error-mapper.js";
import {
  authMiddleware,
  betterAuthPlugin,
} from "./shared/infrastructure/auth/index.js";
import { sequelize } from "./shared/infrastructure/database/index.js";
import { getEventBus } from "./shared/infrastructure/events/index.js";
import { createLogger } from "./shared/infrastructure/logging/index.js";
import { recordHttpRequestMetrics } from "./shared/infrastructure/observability/http-metrics.js";

const apiInfoResponseSchema = z.object({
  name: z.string(),
  version: z.string(),
  docs: z.string(),
});

const API_NAME = "Mobility Transactions API";
const API_DESCRIPTION = "System of record for ride-hailing operations";
const API_VERSION = "1.0.0";
const API_DOCS_PATH = "/docs";
const API_PREFIX = "/api/v1";
const RIDES_PREFIX = "/api/v1/rides";
const DRIVERS_PREFIX = "/api/v1/drivers";
const DISPATCH_PREFIX = "/api/v1/dispatch";
const REQUEST_ID_HEADER = "request-id";
const JSON_API_CONTENT_TYPE_WITH_PARAMETERS_PATTERN =
  /^application\/vnd\.api\+json(?:;.*)?$/i;

const UNKNOWN_ROUTE = "unknown";
const HTTP_OK_MAX_STATUS = 399;
const HTTP_INTERNAL_ERROR_MIN_STATUS = 500;

const ERROR_TYPE_BY_STATUS_CODE: Readonly<Record<number, string>> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "POLICY_VIOLATION",
  429: "RATE_LIMITED",
};

const OPENAPI_TAGS = [
  { name: "system", description: "System health and information" },
  { name: "rides", description: "Ride lifecycle management" },
  {
    name: "drivers",
    description: "Driver availability and location tracking",
  },
  { name: "dispatch", description: "Ride-to-driver assignment" },
  { name: "fares", description: "Fare calculation and retrieval" },
  { name: "payments", description: "Payment orchestration" },
] as const;

const createApp = () => {
  // Custom Pino instance: Fastify v5 requires loggerInstance, not logger.
  const loggerInstance = createLogger();
  return Fastify({
    loggerInstance,
    bodyLimit: 1_048_576, // 1 MiB -- OWASP recommendation for API bodies
    genReqId: (req) => {
      const header = req.headers[REQUEST_ID_HEADER];
      if (typeof header === "string" && header.length > 0) {
        return header;
      }

      return randomUUID();
    },
  }).withTypeProvider<ZodTypeProvider>();
};

type AppInstance = ReturnType<typeof createApp>;

const registerJsonApiParser = (app: AppInstance): void => {
  // Parse application/vnd.api+json as JSON (JSON:API media type)
  app.addContentTypeParser(
    JSON_API_CONTENT_TYPE_WITH_PARAMETERS_PATTERN,
    { parseAs: "string" },
    (_req, body, done) => {
      try {
        done(null, JSON.parse(body as string));
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );
};

const registerCorePlugins = async (app: AppInstance): Promise<void> => {
  // Register plugins
  await app.register(cors, { origin: true });
  await app.register(compress);

  // Register rate limit plugin (global: false -- only specific routes)
  // Note: RATE_LIMITED (429) is handled by @fastify/rate-limit plugin directly.
  // The plugin uses errorResponseBuilder to match the ApiErrorResponse shape.
  await app.register(rateLimit, {
    global: false, // Don't rate limit globally -- only specific routes
    max: 100, // Fallback: 100 requests per window (if global were true)
    timeWindow: "1 minute",
    errorResponseBuilder: (request, context) => ({
      errorType: "RATE_LIMITED",
      message: `Rate limit exceeded. Retry after ${context.ttl} ms`,
      retryable: true,
      requestId: request.id,
    }),
  });

  // Register Better Auth catch-all handler (/api/auth/*)
  // Must be before auth middleware so auth endpoints are accessible.
  await app.register(betterAuthPlugin);

  // Register authentication middleware (validates session on non-public routes)
  await app.register(authMiddleware);
};

const registerDocumentation = async (app: AppInstance): Promise<void> => {
  // Register Swagger/OpenAPI documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: API_NAME,
        description: API_DESCRIPTION,
        version: API_VERSION,
      },
      servers: [{ url: `http://localhost:${config.server.port}` }],
      tags: OPENAPI_TAGS.map((tag) => ({ ...tag })),
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: API_DOCS_PATH,
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });
};

const registerRequestLifecycleHooks = (app: AppInstance): void => {
  app.addHook("onRequest", (request) => {
    request.log.info(
      {
        method: request.method,
        url: request.url,
        correlationId: request.id,
      },
      "Request received"
    );
  });

  app.addHook("onResponse", (request, reply) => {
    const route =
      request.routeOptions.url ?? normalizeRoute(request.url) ?? UNKNOWN_ROUTE;
    const errorType = classifyErrorTypeFromStatus(reply.statusCode);

    request.log.info(
      {
        statusCode: reply.statusCode,
        error_type: errorType,
        route,
        method: request.method,
        requestId: request.id,
        latency_ms: reply.elapsedTime,
      },
      "request.summary"
    );

    recordHttpRequestMetrics(request, reply);

    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        correlationId: request.id,
        responseTimeMs: reply.elapsedTime,
      },
      "Request completed"
    );
  });

  app.addHook("onError", (request, _reply, error) => {
    request.log.error(
      {
        method: request.method,
        url: request.url,
        correlationId: request.id,
        errorType: error.name,
        errorMessage: error.message,
        // Stack trace only in non-production
        ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
      },
      "Request error"
    );
  });
};

const registerErrorHandlers = (app: AppInstance): void => {
  const isValidationFastifyError = (
    error: unknown
  ): error is FastifyError & { validation: unknown } => {
    return typeof error === "object" && error !== null && "validation" in error;
  };

  // Global error handler - ensures all errors return deterministic shape
  app.setErrorHandler((error, request, reply) => {
    // Check for Zod/validation errors (Fastify sets error.validation)
    if (isValidationFastifyError(error)) {
      return reply.status(400).send(createZodErrorResponse(error, request.id));
    }
    // Check for domain errors
    if (isDomainError(error)) {
      const status = mapDomainErrorToHttpStatus(error);
      return reply.status(status).send(createErrorResponse(error, request.id));
    }
    // Unhandled error -- log and return safe response
    request.log.error(
      { err: error, correlationId: request.id },
      "Unhandled error"
    );
    return reply.status(500).send(createUnexpectedErrorResponse(request.id));
  });

  // 404 handler for unknown routes
  app.setNotFoundHandler((request, reply) => {
    return reply
      .status(404)
      .send(createNotFoundRouteResponse(request.id, request.url));
  });
};

const registerSystemRoutes = (app: AppInstance): void => {
  // Root endpoint for API info
  app.get(
    "/",
    {
      schema: {
        description: "API information",
        tags: ["system"],
        response: {
          200: apiInfoResponseSchema,
        },
      },
    },
    async () => ({
      name: API_NAME,
      version: API_VERSION,
      docs: API_DOCS_PATH,
    })
  );
};

interface ModuleRoutes {
  readonly healthRoutes: FastifyPluginAsync;
  readonly fareRoutes: FastifyPluginAsync;
  readonly paymentRoutes: FastifyPluginAsync;
  readonly rideRoutes: FastifyPluginAsync;
  readonly driverRoutes: FastifyPluginAsync;
  readonly dispatchRoutes: FastifyPluginAsync;
}

const passthroughRiderLookup: GetRiderIdFn = (rideId, _tenantId) => {
  return Promise.resolve(rideId);
};

const initializeModuleRoutes = (): ModuleRoutes => {
  // Initialize event bus (shared across modules)
  const eventBus = getEventBus();

  // Initialize ride module (first - provides rideAssignmentPort for dispatch)
  const { rideRoutes, rideAssignmentPort } = initRideModule(
    sequelize,
    eventBus
  );

  // Initialize driver module
  const { driverRoutes, geoIndex } = initDriverModule(sequelize, eventBus);

  // Initialize dispatch module (depends on rideAssignmentPort + shared geo index)
  const { dispatchRoutes } = initDispatchModule(
    sequelize,
    eventBus,
    rideAssignmentPort,
    geoIndex
  );

  // Initialize fare module
  const { fareRoutes } = initFareModule(sequelize, eventBus);

  // Initialize payment module (depends on rides for riderId lookup)
  const { paymentRoutes } = initPaymentModule(
    sequelize,
    eventBus,
    passthroughRiderLookup
  );

  return {
    healthRoutes,
    fareRoutes,
    paymentRoutes,
    rideRoutes,
    driverRoutes,
    dispatchRoutes,
  };
};

const registerModuleRoutes = async (
  app: AppInstance,
  moduleRoutes: ModuleRoutes
): Promise<void> => {
  const legacyRoutes = [
    { plugin: moduleRoutes.healthRoutes, prefix: API_PREFIX },
    { plugin: moduleRoutes.fareRoutes, prefix: API_PREFIX },
    { plugin: moduleRoutes.paymentRoutes, prefix: API_PREFIX },
  ] as const;

  const jsonApiRoutes = [
    { plugin: moduleRoutes.rideRoutes, prefix: RIDES_PREFIX },
    { plugin: moduleRoutes.driverRoutes, prefix: DRIVERS_PREFIX },
    { plugin: moduleRoutes.dispatchRoutes, prefix: DISPATCH_PREFIX },
  ] as const;

  for (const routeRegistration of legacyRoutes) {
    await app.register(routeRegistration.plugin, {
      prefix: routeRegistration.prefix,
    });
  }

  for (const routeRegistration of jsonApiRoutes) {
    await app.register(routeRegistration.plugin, {
      prefix: routeRegistration.prefix,
    });
  }
};

const normalizeRoute = (url: string): string => {
  const queryStart = url.indexOf("?");
  return queryStart === -1 ? url : url.slice(0, queryStart);
};

const classifyErrorTypeFromStatus = (statusCode: number): string => {
  if (statusCode <= HTTP_OK_MAX_STATUS) {
    return "OK";
  }

  const errorType = ERROR_TYPE_BY_STATUS_CODE[statusCode];
  if (errorType !== undefined) {
    return errorType;
  }

  if (statusCode >= HTTP_INTERNAL_ERROR_MIN_STATUS) {
    return "INTERNAL_ERROR";
  }

  return `HTTP_${statusCode}`;
};

/**
 * Builds and configures a Fastify application instance.
 * Registers plugins, middleware, and routes.
 *
 * @returns Configured Fastify instance ready for use
 */
export const buildApp = async () => {
  const app = createApp();

  // Configure Zod as the validation provider
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerJsonApiParser(app);

  await registerCorePlugins(app);
  await registerDocumentation(app);
  registerRequestLifecycleHooks(app);
  registerErrorHandlers(app);
  registerSystemRoutes(app);

  const moduleRoutes = initializeModuleRoutes();
  await registerModuleRoutes(app, moduleRoutes);

  return app;
};
