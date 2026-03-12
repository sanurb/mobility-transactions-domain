/**
 * JSON:API Routes for Drivers
 *
 * Hexagonal architecture inbound adapter.
 * Handles HTTP concerns: parsing, validation, auth, JSON:API formatting.
 * Delegates business logic to DriverService.
 *
 * Base path: /api/drivers
 * Media type: application/vnd.api+json
 * PRD: No TenantId in routes
 */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { NotFoundError } from "../../../../shared/errors/error-types.js";
import {
  AUTH_SCOPES,
  type AuthenticatedRequest,
} from "../../../../shared/infrastructure/auth/auth.types.js";
import { requireScopes } from "../../../../shared/infrastructure/auth/jwt.middleware.js";
import {
  assertJsonApiRequestHeaders,
  buildDocumentSingle,
  buildError,
  buildErrorDocument,
  buildResource,
  mapDomainErrorToJsonApi,
  mapValidationErrorToJsonApi,
  setJsonApiResponseHeaders,
} from "../../../../shared/infrastructure/http/jsonapi/index.js";
import type {
  DriverDTO,
  IDriverService,
} from "../../application/driver.service.js";
import {
  type DriverIdParam,
  DriverIdParamSchema,
  type RegisterDriverRequest,
  RegisterDriverSchema,
  type UpdateAvailabilityRequest,
  UpdateAvailabilitySchema,
  type UpdateLocationRequest,
  UpdateLocationSchema,
} from "./driver.jsonapi-schemas.js";

/**
 * Dependencies for driver routes
 */
export interface DriverRoutesDependencies {
  driverService: IDriverService;
}

/**
 * Map DriverDTO to JSON:API resource
 */
const mapDriverToResource = (driver: DriverDTO) => {
  return buildResource({
    type: "drivers",
    id: driver.id,
    attributes: {
      state: driver.state,
      currentLocation: driver.currentLocation
        ? {
            latitude: driver.currentLocation.latitude,
            longitude: driver.currentLocation.longitude,
            accuracy: driver.currentLocation.accuracy,
            bearing: driver.currentLocation.bearing,
            speed: driver.currentLocation.speed,
            recordedAt: driver.currentLocation.recordedAt,
          }
        : null,
      registeredAt: driver.registeredAt,
      updatedAt: driver.updatedAt,
    },
    meta: {
      version: driver.version,
    },
  });
};

/**
 * Create Drivers JSON:API routes
 */
export const createDriverRoutes = (
  deps: DriverRoutesDependencies
): FastifyPluginAsync => {
  return async (fastify) => {
    /**
     * POST /api/drivers
     * Register a new driver
     */
    fastify.post<{
      Body: RegisterDriverRequest;
    }>(
      "/",
      {
        preHandler: requireScopes([AUTH_SCOPES.DRIVER_WRITE]),
      },
      async (
        request: FastifyRequest<{ Body: RegisterDriverRequest }>,
        reply: FastifyReply
      ) => {
        const authRequest = request as AuthenticatedRequest;
        const requestId = request.id;

        try {
          // Enforce JSON:API headers
          assertJsonApiRequestHeaders(request);

          // Validate request body
          const parseResult = RegisterDriverSchema.safeParse(request.body);
          if (!parseResult.success) {
            const firstError = parseResult.error.issues[0];
            const errorDoc = buildErrorDocument([
              mapValidationErrorToJsonApi(
                firstError?.message ?? "Invalid request body",
                requestId,
                `/data/attributes/${firstError?.path.join("/")}`
              ),
            ]);
            setJsonApiResponseHeaders(reply);
            return reply.status(400).send(errorDoc);
          }

          const { data } = parseResult.data;
          const attrs = data.attributes;

          // Invoke service
          const result = await deps.driverService.registerDriver({
            driverId: attrs.driverId,
          });

          if (result.isErr()) {
            const error = result.error;
            const errorDoc = buildErrorDocument([
              mapDomainErrorToJsonApi(error, requestId),
            ]);
            setJsonApiResponseHeaders(reply);
            const httpStatus = error._tag === "CONFLICT" ? 409 : 500;
            return reply.status(httpStatus).send(errorDoc);
          }

          const resource = mapDriverToResource(result.value);
          const document = buildDocumentSingle(resource);

          setJsonApiResponseHeaders(reply);
          return reply.status(201).send(document);
        } catch (error) {
          const errorDoc = buildErrorDocument([
            buildError({
              status: "500",
              title: "internal server error",
              detail: error instanceof Error ? error.message : "Unknown error",
              meta: { requestId },
            }),
          ]);
          setJsonApiResponseHeaders(reply);
          return reply.status(500).send(errorDoc);
        }
      }
    );

    /**
     * PATCH /api/drivers/:id/availability
     * Update driver availability state
     */
    fastify.patch<{
      Params: DriverIdParam;
      Body: UpdateAvailabilityRequest;
    }>(
      "/:id/availability",
      {
        preHandler: requireScopes([AUTH_SCOPES.DRIVER_WRITE]),
      },
      async (
        request: FastifyRequest<{
          Params: DriverIdParam;
          Body: UpdateAvailabilityRequest;
        }>,
        reply: FastifyReply
      ) => {
        const authRequest = request as AuthenticatedRequest;
        const requestId = request.id;

        try {
          // Enforce JSON:API headers
          assertJsonApiRequestHeaders(request);

          // Validate params
          const paramsResult = DriverIdParamSchema.safeParse(request.params);
          if (!paramsResult.success) {
            const errorDoc = buildErrorDocument([
              mapValidationErrorToJsonApi(
                "Invalid driver ID",
                requestId,
                undefined,
                "id"
              ),
            ]);
            setJsonApiResponseHeaders(reply);
            return reply.status(400).send(errorDoc);
          }

          // Validate body
          const bodyResult = UpdateAvailabilitySchema.safeParse(request.body);
          if (!bodyResult.success) {
            const firstError = bodyResult.error.issues[0];
            const errorDoc = buildErrorDocument([
              mapValidationErrorToJsonApi(
                firstError?.message ?? "Invalid request body",
                requestId,
                `/data/attributes/${firstError?.path.join("/")}`
              ),
            ]);
            setJsonApiResponseHeaders(reply);
            return reply.status(400).send(errorDoc);
          }

          const driverId = paramsResult.data.id;
          const { state } = bodyResult.data.data.attributes;

          // Invoke service
          const result = await deps.driverService.updateAvailability({
            driverId,
            newState: state,
          });

          if (result.isErr()) {
            const error = result.error;
            const errorDoc = buildErrorDocument([
              mapDomainErrorToJsonApi(error, requestId),
            ]);
            setJsonApiResponseHeaders(reply);
            const httpStatus =
              error._tag === "NOT_FOUND"
                ? 404
                : error._tag === "CONFLICT"
                  ? 409
                  : 500;
            return reply.status(httpStatus).send(errorDoc);
          }

          const resource = mapDriverToResource(result.value);
          const document = buildDocumentSingle(resource);

          setJsonApiResponseHeaders(reply);
          return reply.status(200).send(document);
        } catch (error) {
          const errorDoc = buildErrorDocument([
            buildError({
              status: "500",
              title: "internal server error",
              detail: error instanceof Error ? error.message : "Unknown error",
              meta: { requestId },
            }),
          ]);
          setJsonApiResponseHeaders(reply);
          return reply.status(500).send(errorDoc);
        }
      }
    );

    /**
     * PATCH /api/drivers/:id/location
     * Update driver location
     */
    fastify.patch<{
      Params: DriverIdParam;
      Body: UpdateLocationRequest;
    }>(
      "/:id/location",
      {
        preHandler: requireScopes([AUTH_SCOPES.DRIVER_WRITE]),
      },
      async (
        request: FastifyRequest<{
          Params: DriverIdParam;
          Body: UpdateLocationRequest;
        }>,
        reply: FastifyReply
      ) => {
        const authRequest = request as AuthenticatedRequest;
        const requestId = request.id;

        try {
          // Enforce JSON:API headers
          assertJsonApiRequestHeaders(request);

          // Validate params
          const paramsResult = DriverIdParamSchema.safeParse(request.params);
          if (!paramsResult.success) {
            const errorDoc = buildErrorDocument([
              mapValidationErrorToJsonApi(
                "Invalid driver ID",
                requestId,
                undefined,
                "id"
              ),
            ]);
            setJsonApiResponseHeaders(reply);
            return reply.status(400).send(errorDoc);
          }

          // Validate body
          const bodyResult = UpdateLocationSchema.safeParse(request.body);
          if (!bodyResult.success) {
            const firstError = bodyResult.error.issues[0];
            const errorDoc = buildErrorDocument([
              mapValidationErrorToJsonApi(
                firstError?.message ?? "Invalid request body",
                requestId,
                `/data/attributes/${firstError?.path.join("/")}`
              ),
            ]);
            setJsonApiResponseHeaders(reply);
            return reply.status(400).send(errorDoc);
          }

          const driverId = paramsResult.data.id;
          const { latitude, longitude, accuracy, bearing, speed, recordedAt } =
            bodyResult.data.data.attributes;

          // Convert ISO string to Date after validation
          const recordedAtDate = new Date(recordedAt);

          // Invoke service
          const result = await deps.driverService.updateLocation({
            driverId,
            latitude,
            longitude,
            accuracy,
            bearing,
            speed,
            recordedAt: recordedAtDate,
          });

          if (result.isErr()) {
            const error = result.error;
            const errorDoc = buildErrorDocument([
              mapDomainErrorToJsonApi(error, requestId),
            ]);
            setJsonApiResponseHeaders(reply);
            const httpStatus =
              error._tag === "NOT_FOUND"
                ? 404
                : error._tag === "VALIDATION_ERROR"
                  ? 400
                  : 500;
            return reply.status(httpStatus).send(errorDoc);
          }

          const resource = mapDriverToResource(result.value);
          const document = buildDocumentSingle(resource);

          setJsonApiResponseHeaders(reply);
          return reply.status(200).send(document);
        } catch (error) {
          const errorDoc = buildErrorDocument([
            buildError({
              status: "500",
              title: "internal server error",
              detail: error instanceof Error ? error.message : "Unknown error",
              meta: { requestId },
            }),
          ]);
          setJsonApiResponseHeaders(reply);
          return reply.status(500).send(errorDoc);
        }
      }
    );

    /**
     * GET /api/drivers/:id
     * Get a single driver by ID
     */
    fastify.get<{
      Params: DriverIdParam;
    }>(
      "/:id",
      {
        preHandler: requireScopes([AUTH_SCOPES.DRIVER_READ]),
      },
      async (
        request: FastifyRequest<{ Params: DriverIdParam }>,
        reply: FastifyReply
      ) => {
        const authRequest = request as AuthenticatedRequest;
        const requestId = request.id;

        try {
          // Validate params
          const paramsResult = DriverIdParamSchema.safeParse(request.params);
          if (!paramsResult.success) {
            const errorDoc = buildErrorDocument([
              mapValidationErrorToJsonApi(
                "Invalid driver ID",
                requestId,
                undefined,
                "id"
              ),
            ]);
            setJsonApiResponseHeaders(reply);
            return reply.status(400).send(errorDoc);
          }

          const driverId = paramsResult.data.id;

          // Invoke service
          const result = await deps.driverService.getDriver({ driverId });

          if (result.isErr()) {
            const error = result.error;
            const errorDoc = buildErrorDocument([
              mapDomainErrorToJsonApi(error, requestId),
            ]);
            setJsonApiResponseHeaders(reply);
            const httpStatus = error._tag === "NOT_FOUND" ? 404 : 500;
            return reply.status(httpStatus).send(errorDoc);
          }

          if (!result.value) {
            const notFoundError = new NotFoundError(
              "Driver",
              "Driver not found"
            );
            const errorDoc = buildErrorDocument([
              mapDomainErrorToJsonApi(notFoundError, requestId),
            ]);
            setJsonApiResponseHeaders(reply);
            return reply.status(404).send(errorDoc);
          }

          const resource = mapDriverToResource(result.value);
          const document = buildDocumentSingle(resource);

          setJsonApiResponseHeaders(reply);
          return reply.status(200).send(document);
        } catch (error) {
          const errorDoc = buildErrorDocument([
            buildError({
              status: "500",
              title: "internal server error",
              detail: error instanceof Error ? error.message : "Unknown error",
              meta: { requestId },
            }),
          ]);
          setJsonApiResponseHeaders(reply);
          return reply.status(500).send(errorDoc);
        }
      }
    );
  };
};
