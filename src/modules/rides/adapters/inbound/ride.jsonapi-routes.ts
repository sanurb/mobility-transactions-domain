/**
 * JSON:API Routes for Rides
 *
 * Hexagonal architecture inbound adapter.
 * Handles HTTP concerns: parsing, validation, auth, JSON:API formatting.
 * Delegates business logic to use cases.
 *
 * Base path: /api/rides
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
  buildDocumentCollection,
  buildDocumentSingle,
  buildError,
  buildErrorDocument,
  buildResource,
  mapDomainErrorToJsonApi,
  mapValidationErrorToJsonApi,
  setJsonApiResponseHeaders,
} from "../../../../shared/infrastructure/http/jsonapi/index.js";
import {
  type CorrelationContext,
  getTracer,
  runWithCorrelation,
  withUseCaseObservability,
} from "../../../../shared/infrastructure/observability/index.js";
import type { DriverId } from "../../../../shared/types/ids/driver-id.js";
import {
  createMarketId,
  createRideId,
  createRiderId,
  unsafeDriverId,
  unsafeRideId,
  unsafeRiderId,
} from "../../../../shared/types/ids/index.js";
import type { MarketId } from "../../../../shared/types/ids/market-id.js";
import type { RiderId } from "../../../../shared/types/ids/rider-id.js";
import type {
  CreateRideUseCase,
  GetRideUseCase,
  ListRidesUseCase,
  TransitionRideUseCase,
} from "../../application/use-cases/index.js";
import type { Ride } from "../../domain/ride.aggregate.js";
import {
  type CreateRideRequest,
  CreateRideRequestSchema,
  type ListRidesQuery,
  ListRidesQuerySchema,
  type RideIdParam,
  RideIdParamSchema,
  type TransitionRideRequest,
  TransitionRideRequestSchema,
} from "./ride.jsonapi-schemas.js";

/**
 * Dependencies for ride routes
 */
export interface RideRoutesDepencies {
  createRideUseCase: CreateRideUseCase;
  transitionRideUseCase: TransitionRideUseCase;
  getRideUseCase: GetRideUseCase;
  listRidesUseCase: ListRidesUseCase;
}

/**
 * Map Ride aggregate to JSON:API resource
 */
const mapRideToResource = (ride: Ride) => {
  return buildResource({
    type: "rides",
    id: ride.id,
    attributes: {
      riderId: ride.riderId,
      driverId: ride.driverId,
      marketId: ride.marketId,
      state: ride.state,
      pickup: {
        lat: ride.pickup.latitude,
        lng: ride.pickup.longitude,
      },
      dropoff: {
        lat: ride.dropoff.latitude,
        lng: ride.dropoff.longitude,
      },
      requestedAtUTC: ride.requestedAtUTC,
      startedAtUTC: ride.startedAtUTC,
      completedAtUTC: ride.completedAtUTC,
      expiresAtUTC: ride.expiresAtUTC,
    },
    meta: {
      version: ride.getVersion(),
    },
  });
};

/**
 * Create Rides JSON:API routes
 */
export const createRideRoutes = (
  deps: RideRoutesDepencies
): FastifyPluginAsync => {
  return async (fastify) => {
    /**
     * POST /api/rides
     * Create a new ride request
     */
    fastify.post<{
      Body: CreateRideRequest;
    }>(
      "/",
      {
        preHandler: requireScopes([AUTH_SCOPES.RIDE_CREATE]),
      },
      async (
        request: FastifyRequest<{ Body: CreateRideRequest }>,
        reply: FastifyReply
      ) => {
        const authRequest = request as AuthenticatedRequest;
        const requestId = request.id;

        // Establish correlation context
        const correlationId =
          (request.headers["x-correlation-id"] as string | undefined) ||
          request.id;

        const correlationCtx: CorrelationContext = {
          correlationId,
          requestId: request.id,
          userId: authRequest.user?.id,
          role: authRequest.user?.role as
            | "rider"
            | "driver"
            | "admin"
            | "system"
            | undefined,
        };

        return runWithCorrelation(correlationCtx, async () => {
          try {
            // Enforce JSON:API headers
            assertJsonApiRequestHeaders(request);

            // Validate request body
            const parseResult = CreateRideRequestSchema.safeParse(request.body);
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

            // Generate ride ID (using cuid2)
            const { createId } = await import("@paralleldrive/cuid2");
            const rideId = createRideId(createId());

            // Parse branded IDs (validation will throw if invalid)
            let riderId: RiderId;
            try {
              riderId = createRiderId(attrs.riderId);
            } catch (error) {
              const errorDoc = buildErrorDocument([
                mapValidationErrorToJsonApi(
                  error instanceof Error
                    ? error.message
                    : "Invalid riderId format",
                  requestId,
                  "/data/attributes/riderId"
                ),
              ]);
              setJsonApiResponseHeaders(reply);
              return reply.status(400).send(errorDoc);
            }

            let marketId: MarketId | undefined;
            if (attrs.marketId) {
              try {
                marketId = createMarketId(attrs.marketId);
              } catch (error) {
                const errorDoc = buildErrorDocument([
                  mapValidationErrorToJsonApi(
                    error instanceof Error
                      ? error.message
                      : "Invalid marketId format",
                    requestId,
                    "/data/attributes/marketId"
                  ),
                ]);
                setJsonApiResponseHeaders(reply);
                return reply.status(400).send(errorDoc);
              }
            }

            // Wrap use case invocation with observability
            const tracer = getTracer();
            const wrapper = withUseCaseObservability({
              useCase: "Rides.CreateRide",
              tracer,
              logger: request.log,
            });

            const result = await wrapper(() =>
              deps.createRideUseCase.execute({
                id: rideId,
                riderId,
                pickup: attrs.pickup,
                dropoff: attrs.dropoff,
                marketId,
              })
            );

            if (result.isErr()) {
              const error = result.error;
              const errorDoc = buildErrorDocument([
                mapDomainErrorToJsonApi(error, requestId),
              ]);
              setJsonApiResponseHeaders(reply);
              const httpStatus = error._tag === "CONFLICT" ? 409 : 500;
              return reply.status(httpStatus).send(errorDoc);
            }

            // Fetch created ride for response
            const getRideResult = await deps.getRideUseCase.execute({ rideId });

            if (getRideResult.isErr() || !getRideResult.value) {
              const errorDoc = buildErrorDocument([
                buildError({
                  status: "500",
                  title: "internal server error",
                  detail: "Failed to retrieve created ride",
                  meta: { requestId },
                }),
              ]);
              setJsonApiResponseHeaders(reply);
              return reply.status(500).send(errorDoc);
            }

            const resource = mapRideToResource(getRideResult.value);
            const document = buildDocumentSingle(resource);

            setJsonApiResponseHeaders(reply);
            return reply.status(201).send(document);
          } catch (error) {
            const errorDoc = buildErrorDocument([
              buildError({
                status: "500",
                title: "internal server error",
                detail:
                  error instanceof Error ? error.message : "Unknown error",
                meta: { requestId },
              }),
            ]);
            setJsonApiResponseHeaders(reply);
            return reply.status(500).send(errorDoc);
          }
        });
      }
    );

    /**
     * POST /api/rides/:id/transitions
     * Transition a ride to a new state
     */
    fastify.post<{
      Params: RideIdParam;
      Body: TransitionRideRequest;
    }>(
      "/:id/transitions",
      {
        preHandler: requireScopes([AUTH_SCOPES.RIDE_UPDATE]),
      },
      async (
        request: FastifyRequest<{
          Params: RideIdParam;
          Body: TransitionRideRequest;
        }>,
        reply: FastifyReply
      ) => {
        const authRequest = request as AuthenticatedRequest;
        const requestId = request.id;

        // Establish correlation context
        const correlationId =
          (request.headers["x-correlation-id"] as string | undefined) ||
          request.id;

        const correlationCtx: CorrelationContext = {
          correlationId,
          requestId: request.id,
          userId: authRequest.user?.id,
          role: authRequest.user?.role as
            | "rider"
            | "driver"
            | "admin"
            | "system"
            | undefined,
        };

        return runWithCorrelation(correlationCtx, async () => {
          try {
            // Enforce JSON:API headers
            assertJsonApiRequestHeaders(request);

            // Validate params
            const paramsResult = RideIdParamSchema.safeParse(request.params);
            if (!paramsResult.success) {
              const errorDoc = buildErrorDocument([
                mapValidationErrorToJsonApi(
                  "Invalid ride ID",
                  requestId,
                  undefined,
                  "id"
                ),
              ]);
              setJsonApiResponseHeaders(reply);
              return reply.status(400).send(errorDoc);
            }

            // Validate body
            const bodyResult = TransitionRideRequestSchema.safeParse(
              request.body
            );
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

            const rideId = unsafeRideId(paramsResult.data.id);
            const {
              toState,
              reason,
              driverId: rawDriverId,
            } = bodyResult.data.data.attributes;

            // Determine changedBy and changedByRole from auth context
            const changedBy = authRequest.user.id;
            const changedByRole =
              authRequest.user.role === "driver"
                ? "driver"
                : authRequest.user.role === "rider"
                  ? "rider"
                  : "system";

            // Wrap use case invocation with observability
            const tracer = getTracer();
            const wrapper = withUseCaseObservability({
              useCase: "Rides.TransitionRide",
              tracer,
              logger: request.log,
            });

            const result = await wrapper(() =>
              deps.transitionRideUseCase.execute({
                rideId,
                toState,
                changedBy,
                changedByRole: changedByRole as "rider" | "driver" | "system",
                reason,
                driverId: rawDriverId ? unsafeDriverId(rawDriverId) : undefined,
              })
            );

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

            // Fetch updated ride for response
            const getRideResult = await deps.getRideUseCase.execute({ rideId });

            if (getRideResult.isErr() || !getRideResult.value) {
              const errorDoc = buildErrorDocument([
                buildError({
                  status: "500",
                  title: "internal server error",
                  detail: "Failed to retrieve updated ride",
                  meta: { requestId },
                }),
              ]);
              setJsonApiResponseHeaders(reply);
              return reply.status(500).send(errorDoc);
            }

            const resource = mapRideToResource(getRideResult.value);
            const document = buildDocumentSingle(resource);

            setJsonApiResponseHeaders(reply);
            return reply.status(200).send(document);
          } catch (error) {
            const errorDoc = buildErrorDocument([
              buildError({
                status: "500",
                title: "internal server error",
                detail:
                  error instanceof Error ? error.message : "Unknown error",
                meta: { requestId },
              }),
            ]);
            setJsonApiResponseHeaders(reply);
            return reply.status(500).send(errorDoc);
          }
        });
      }
    );

    /**
     * GET /api/rides/:id
     * Get a single ride by ID
     */
    fastify.get<{
      Params: RideIdParam;
    }>(
      "/:id",
      {
        preHandler: requireScopes([AUTH_SCOPES.RIDE_READ]),
      },
      async (
        request: FastifyRequest<{ Params: RideIdParam }>,
        reply: FastifyReply
      ) => {
        const authRequest = request as AuthenticatedRequest;
        const requestId = request.id;

        try {
          // Validate params
          const paramsResult = RideIdParamSchema.safeParse(request.params);
          if (!paramsResult.success) {
            const errorDoc = buildErrorDocument([
              mapValidationErrorToJsonApi(
                "Invalid ride ID",
                requestId,
                undefined,
                "id"
              ),
            ]);
            setJsonApiResponseHeaders(reply);
            return reply.status(400).send(errorDoc);
          }

          const rideId = unsafeRideId(paramsResult.data.id);

          // Invoke use case
          const result = await deps.getRideUseCase.execute({ rideId });

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
            const notFoundError = new NotFoundError("Ride", "Ride not found");
            const errorDoc = buildErrorDocument([
              mapDomainErrorToJsonApi(notFoundError, requestId),
            ]);
            setJsonApiResponseHeaders(reply);
            return reply.status(404).send(errorDoc);
          }

          const resource = mapRideToResource(result.value);
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
     * GET /api/rides
     * List rides with filtering and pagination
     */
    fastify.get<{
      Querystring: ListRidesQuery;
    }>(
      "/",
      {
        preHandler: requireScopes([AUTH_SCOPES.RIDE_READ]),
      },
      async (
        request: FastifyRequest<{ Querystring: ListRidesQuery }>,
        reply: FastifyReply
      ) => {
        const authRequest = request as AuthenticatedRequest;
        const requestId = request.id;

        try {
          // Validate query params
          const queryResult = ListRidesQuerySchema.safeParse(request.query);
          if (!queryResult.success) {
            const firstError = queryResult.error.issues[0];
            const errorDoc = buildErrorDocument([
              mapValidationErrorToJsonApi(
                firstError?.message ?? "Invalid query parameters",
                requestId,
                undefined,
                firstError?.path.join(".")
              ),
            ]);
            setJsonApiResponseHeaders(reply);
            return reply.status(400).send(errorDoc);
          }

          const query = queryResult.data;

          // Auto-filter by riderId or driverId based on role
          let riderId: RiderId | undefined;
          let driverId: DriverId | undefined;

          if (authRequest.user.role === "rider" && authRequest.user.riderId) {
            riderId = unsafeRiderId(authRequest.user.riderId);
          } else if (
            authRequest.user.role === "driver" &&
            authRequest.user.driverId
          ) {
            driverId = unsafeDriverId(authRequest.user.driverId);
          }

          // Invoke use case
          const result = await deps.listRidesUseCase.execute({
            riderId,
            driverId,
            state: query["filter[state]"],
            limit: query["page[limit]"],
            offset: query["page[offset]"],
          });

          if (result.isErr()) {
            const error = result.error;
            const errorDoc = buildErrorDocument([
              mapDomainErrorToJsonApi(error, requestId),
            ]);
            setJsonApiResponseHeaders(reply);
            return reply.status(500).send(errorDoc);
          }

          const { rides, total } = result.value;
          const resources = rides.map(mapRideToResource);

          // Build pagination links
          const limit = query["page[limit]"] ?? 50;
          const offset = query["page[offset]"] ?? 0;
          const baseUrl = `${request.protocol}://${request.hostname}/api/rides`;

          const links: Record<string, string> = {
            self: `${baseUrl}?page[limit]=${limit}&page[offset]=${offset}`,
          };

          if (offset + limit < total) {
            links.next = `${baseUrl}?page[limit]=${limit}&page[offset]=${offset + limit}`;
          }

          if (offset > 0) {
            const prevOffset = Math.max(0, offset - limit);
            links.prev = `${baseUrl}?page[limit]=${limit}&page[offset]=${prevOffset}`;
          }

          const document = buildDocumentCollection(resources, { total }, links);

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
