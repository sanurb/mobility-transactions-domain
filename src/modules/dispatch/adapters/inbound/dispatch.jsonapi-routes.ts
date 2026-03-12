/**
 * Dispatch JSON:API Routes - HTTP Inbound Adapter
 *
 * Exposes dispatch operations via JSON:API specification.
 * Enforces application/vnd.api+json media type and Idempotency-Key header.
 * Maps domain results to JSON:API documents.
 *
 * Base path: /api/dispatch
 * No /api/v2 prefix per plan requirements
 */

import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { AUTH_SCOPES } from "../../../../shared/infrastructure/auth/auth.types.js";
import {
  getAuthenticatedUser,
  requireScopes,
} from "../../../../shared/infrastructure/auth/jwt.middleware.js";
import {
  assertJsonApiRequestHeaders,
  buildDocumentSingle,
  buildError,
  buildErrorDocument,
  buildResource,
  mapDomainErrorToJsonApi,
  setJsonApiResponseHeaders,
} from "../../../../shared/infrastructure/http/jsonapi/index.js";
import type { DispatchProcessManager } from "../../application/dispatch.process-manager.js";
import {
  type DispatchRequestDocument,
  DispatchRequestDocumentSchema,
  validateIdempotencyKeyHeader,
} from "./dispatch.jsonapi-schemas.js";

/**
 * Create dispatch JSON:API routes plugin factory
 * Takes DispatchProcessManager instance and returns Fastify plugin
 */
export const createDispatchJsonApiRoutes = (
  processManager: DispatchProcessManager
): FastifyPluginAsync => {
  const routes: FastifyPluginAsync = async (app) => {
    /**
     * POST /requests - Create a dispatch request (dispatch a ride to nearest driver)
     *
     * JSON:API type: "dispatch-requests"
     * Requires: Idempotency-Key header
     * Requires: Accept and Content-Type application/vnd.api+json
     * Requires: DISPATCH_EXECUTE scope
     */
    app.post(
      "/requests",
      {
        schema: {
          description: "Dispatch a ride to the nearest available driver",
          tags: ["dispatch"],
          body: DispatchRequestDocumentSchema,
        },
        preHandler: requireScopes([AUTH_SCOPES.DISPATCH_EXECUTE]),
      },
      async (
        request: FastifyRequest<{ Body: DispatchRequestDocument }>,
        reply
      ) => {
        try {
          // Assert JSON:API headers
          assertJsonApiRequestHeaders(request);

          // Validate Idempotency-Key header
          const idempotencyKeyResult = validateIdempotencyKeyHeader(
            request.headers["idempotency-key"] as string | undefined
          );

          if (!idempotencyKeyResult.valid) {
            setJsonApiResponseHeaders(reply);
            const error = buildError({
              status: "400",
              title: "missing required header",
              detail: idempotencyKeyResult.error,
              source: { parameter: "Idempotency-Key" },
              meta: { requestId: request.id, retryable: false },
            });
            return reply.status(400).send(buildErrorDocument([error]));
          }

          const user = getAuthenticatedUser(request);
          const {
            rideId,
            correlationId,
            pickupLocation: requestPickup,
            searchRadiusMeters: requestRadius,
          } = request.body.data.attributes;

          // Use Idempotency-Key as correlationId if not provided
          const effectiveCorrelationId =
            correlationId ?? idempotencyKeyResult.key;

          // Use request-provided pickup or fall back to Bogota center default
          const pickupLocation = requestPickup ?? {
            lat: 4.6097,
            lng: -74.0817,
          };
          const searchRadiusMeters = requestRadius ?? 5000; // 5km radius

          const result = await processManager.dispatchRide({
            rideId,
            tenantId: user.tenantId,
            pickupLocation,
            searchRadiusMeters,
            correlationId: effectiveCorrelationId,
          });

          setJsonApiResponseHeaders(reply);

          if (result.isErr()) {
            const jsonApiError = mapDomainErrorToJsonApi(
              result.error,
              request.id
            );
            const status = Number.parseInt(jsonApiError.status, 10);
            return reply
              .status(status)
              .send(buildErrorDocument([jsonApiError]));
          }

          // Build JSON:API resource
          const dispatchResult = result.value;
          const resource = buildResource({
            type: "dispatch-requests",
            id: dispatchResult.correlationId,
            attributes: {
              rideId: dispatchResult.rideId,
              driverId: dispatchResult.driverId,
              candidatesEvaluated: dispatchResult.candidatesEvaluated,
              selectionCriteria: dispatchResult.selectionCriteria,
              dispatchedAt: dispatchResult.dispatchedAt,
              correlationId: dispatchResult.correlationId,
            },
          });

          return reply.status(201).send(buildDocumentSingle(resource));
        } catch (error) {
          setJsonApiResponseHeaders(reply);

          // Handle header validation errors
          if (
            error instanceof Error &&
            error.message.includes("Content-Type")
          ) {
            const jsonApiError = buildError({
              status: "415",
              title: "unsupported media type",
              detail: error.message,
              meta: { requestId: request.id, retryable: false },
            });
            return reply.status(415).send(buildErrorDocument([jsonApiError]));
          }

          // Unexpected error
          const jsonApiError = buildError({
            status: "500",
            title: "internal server error",
            detail: "An unexpected error occurred during dispatch",
            meta: { requestId: request.id, retryable: true },
          });
          return reply.status(500).send(buildErrorDocument([jsonApiError]));
        }
      }
    );
  };

  return routes;
};
