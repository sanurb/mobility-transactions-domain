/**
 * Fare JSON:API Routes - Inbound HTTP adapter
 *
 * Endpoints:
 * - POST /api/fares - Calculate fare for a ride
 * - GET /api/fares/by-ride/:rideId - Get fare by ride ID
 *
 * Enforces JSON:API content-type and error format.
 */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import {
  assertJsonApiRequestHeaders,
  buildDocumentSingle,
  buildErrorDocument,
  buildResource,
  type JsonApiError,
  mapDomainErrorToJsonApi,
  mapValidationErrorToJsonApi,
  setJsonApiResponseHeaders,
} from "../../../../shared/infrastructure/http/jsonapi/index.js";
import { createRideId } from "../../../../shared/types/ids/index.js";
import type { FareRecord } from "../../application/ports/index.js";
import type {
  CalculateFareUseCase,
  GetFareUseCase,
} from "../../application/use-cases/index.js";
import {
  CalculateFareRequestSchema,
  GetFareByRideParamsSchema,
} from "./fare.jsonapi-schemas.js";

/**
 * Map FareRecord to JSON:API resource.
 */
const mapFareRecordToResource = (record: FareRecord) => {
  return buildResource({
    type: "fares",
    id: record.id,
    attributes: {
      rideId: record.rideId,
      baseFareCOP: record.baseFare.amount,
      distanceKm: record.distanceKm,
      durationMinutes: record.durationMinutes,
      distanceComponentCOP: record.distanceComponent.amount,
      timeComponentCOP: record.timeComponent.amount,
      totalFareCOP: record.totalFare.amount,
      minimumApplied: record.totalFare.minimumApplied,
      pricingVersion: record.pricingVersion.value,
      calculatedAtUTC: record.calculatedAtUTC,
      createdAtUTC: record.createdAtUTC,
    },
  });
};

/**
 * Create Fare JSON:API routes.
 */
export const createFareRoutes = (
  calculateFareUseCase: CalculateFareUseCase,
  getFareUseCase: GetFareUseCase
): FastifyPluginAsync => {
  return async (fastify) => {
    /**
     * POST /api/fares - Calculate fare for a ride
     */
    fastify.post<{
      Body: unknown;
    }>("/api/fares", async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Enforce JSON:API headers
        assertJsonApiRequestHeaders(request);

        // Validate request body
        const parseResult = CalculateFareRequestSchema.safeParse(request.body);
        if (!parseResult.success) {
          const errors: JsonApiError[] = parseResult.error.issues.map((err) =>
            mapValidationErrorToJsonApi(
              err.message,
              request.id,
              `/data/attributes/${err.path.join("/")}`
            )
          );

          setJsonApiResponseHeaders(reply);
          return reply.status(400).send(buildErrorDocument(errors));
        }

        const requestData = parseResult.data;
        const attrs = requestData.data.attributes;

        // Parse rideId to branded type
        const rideIdResult = createRideId(attrs.rideId);

        // Execute use case
        const result = await calculateFareUseCase.execute({
          rideId: rideIdResult,
          baseFareCOP: attrs.baseFareCOP,
          distanceKm: attrs.distanceKm,
          durationMinutes: attrs.durationMinutes,
          minimumFareCOP: attrs.minimumFareCOP,
          pricingVersionString: attrs.pricingVersion,
        });

        if (result.isErr()) {
          const error = mapDomainErrorToJsonApi(result.error, request.id);
          setJsonApiResponseHeaders(reply);
          return reply
            .status(Number.parseInt(error.status, 10))
            .send(buildErrorDocument([error]));
        }

        // Success: return fare resource
        const resource = mapFareRecordToResource(result.value);
        const document = buildDocumentSingle(resource);

        setJsonApiResponseHeaders(reply);
        return reply.status(201).send(document);
      } catch (error) {
        const jsonApiError = mapValidationErrorToJsonApi(
          "Unexpected error processing request",
          request.id
        );
        setJsonApiResponseHeaders(reply);
        return reply.status(500).send(buildErrorDocument([jsonApiError]));
      }
    });

    /**
     * GET /api/fares/by-ride/:rideId - Get fare by ride ID
     */
    fastify.get<{
      Params: unknown;
    }>(
      "/api/fares/by-ride/:rideId",
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          // Validate params
          const parseResult = GetFareByRideParamsSchema.safeParse(
            request.params
          );
          if (!parseResult.success) {
            const errors: JsonApiError[] = parseResult.error.issues.map((err) =>
              mapValidationErrorToJsonApi(
                err.message,
                request.id,
                undefined,
                err.path.join("/")
              )
            );

            setJsonApiResponseHeaders(reply);
            return reply.status(400).send(buildErrorDocument(errors));
          }

          const { rideId } = parseResult.data;

          // Parse rideId to branded type
          const rideIdBranded = createRideId(rideId);

          // Execute use case
          const result = await getFareUseCase.execute(rideIdBranded);

          if (result.isErr()) {
            const error = mapDomainErrorToJsonApi(result.error, request.id);
            setJsonApiResponseHeaders(reply);
            return reply
              .status(Number.parseInt(error.status, 10))
              .send(buildErrorDocument([error]));
          }

          if (result.value === null) {
            const error = mapValidationErrorToJsonApi(
              "Fare not found for ride",
              request.id
            );
            setJsonApiResponseHeaders(reply);
            return reply.status(404).send(buildErrorDocument([error]));
          }

          // Success: return fare resource
          const resource = mapFareRecordToResource(result.value);
          const document = buildDocumentSingle(resource);

          setJsonApiResponseHeaders(reply);
          return reply.status(200).send(document);
        } catch (error) {
          const jsonApiError = mapValidationErrorToJsonApi(
            "Unexpected error processing request",
            request.id
          );
          setJsonApiResponseHeaders(reply);
          return reply.status(500).send(buildErrorDocument([jsonApiError]));
        }
      }
    );
  };
};
