/**
 * Payment JSON:API Routes - Inbound HTTP Adapter
 *
 * JSON:API compliant HTTP adapter for Payments bounded context.
 * Enforces strict JSON:API document structure, content-type rules, and PRD authorization.
 *
 * DESIGN PRINCIPLES:
 * - Each handler invokes exactly ONE use case
 * - Zero business logic (only parse/authorize/map/invoke/translate)
 * - Authorization enforced at boundary (ownership/role/geographic scope)
 * - Deterministic idempotency via Idempotency-Key header
 * - No tenantId (PRD: isolation via ownership/role/geo at inbound boundary)
 */

import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { IdempotencyKey } from "../../../../shared/domain/value-objects/idempotency-key.js";
import { MoneyCOP } from "../../../../shared/domain/value-objects/money-cop.js";
import {
  AuthorizationError,
  ValidationError,
} from "../../../../shared/errors/error-types.js";
import {
  isDomainError,
  mapDomainErrorToHttpStatus,
} from "../../../../shared/errors/http-error-mapper.js";
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
  type JsonApiResource,
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
import {
  unsafePaymentIntentId,
  unsafeRideId,
  unsafeRiderId,
} from "../../../../shared/types/ids/index.js";
import type {
  CreatePaymentIntentInput,
  CreatePaymentIntentUseCase,
  GetPaymentStatusInput,
  GetPaymentStatusUseCase,
  GetSupportEvidenceInput,
  GetSupportEvidenceUseCase,
  GetUserReceiptInput,
  GetUserReceiptUseCase,
  InitiateSettlementInput,
  InitiateSettlementUseCase,
} from "../../application/use-cases/index.js";

// ============================================
// Request Helpers
// ============================================

const buildCorrelationCtx = (request: FastifyRequest): CorrelationContext => {
  const correlationId =
    (request.headers["x-correlation-id"] as string | undefined) || request.id;
  return {
    correlationId,
    requestId: request.id,
    userId: (request as { user?: { id?: string } }).user?.id,
    role: (
      request as {
        user?: { role?: "rider" | "driver" | "admin" | "system" };
      }
    ).user?.role,
  };
};

import {
  type CreatePaymentIntentRequest,
  createPaymentIntentRequestSchema,
  type GetPaymentEvidenceParams,
  type GetPaymentStatusParams,
  type GetReceiptParams,
  getPaymentEvidenceParamsSchema,
  getPaymentStatusParamsSchema,
  getReceiptParamsSchema,
  type InitiateSettlementRequest,
  initiateSettlementRequestSchema,
} from "./payment.jsonapi-schemas.js";

// ============================================
// Use Case Dependencies
// ============================================

interface PaymentUseCases {
  createPaymentIntent: CreatePaymentIntentUseCase;
  initiateSettlement: InitiateSettlementUseCase;
  getUserReceipt: GetUserReceiptUseCase;
  getSupportEvidence: GetSupportEvidenceUseCase;
  getPaymentStatus: GetPaymentStatusUseCase;
}

// ============================================
// Error Handler
// ============================================

/**
 * Send JSON:API error response
 */
const sendJsonApiError = (
  reply: FastifyReply,
  error: Error,
  requestId: string
): void => {
  setJsonApiResponseHeaders(reply);

  if (isDomainError(error)) {
    const httpStatus = mapDomainErrorToHttpStatus(error);
    const jsonApiError = mapDomainErrorToJsonApi(error, requestId);
    reply.status(httpStatus).send(buildErrorDocument([jsonApiError]));
    return;
  }

  // Unexpected error
  const unexpectedError = buildError({
    status: "500",
    title: "internal server error",
    detail: "An unexpected error occurred",
    meta: { requestId, retryable: false },
  });
  reply.status(500).send(buildErrorDocument([unexpectedError]));
};

// ============================================
// Route Factory
// ============================================

/**
 * Create Payment JSON:API routes plugin
 */
export const createPaymentJsonApiRoutes = (
  useCases: PaymentUseCases
): FastifyPluginAsync => {
  const routes: FastifyPluginAsync = async (app) => {
    /**
     * POST /api/payment-intents - Create payment intent
     *
     * JSON:API envelope: { data: { type: 'payment-intents', attributes: {...} } }
     */
    app.post(
      "/payment-intents",
      {
        schema: {
          description: "Create a payment intent for a ride",
          tags: ["payments"],
          body: createPaymentIntentRequestSchema,
        },
        preHandler: requireScopes([AUTH_SCOPES.PAYMENT_INITIATE]),
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        // Establish correlation context for entire request
        const correlationCtx = buildCorrelationCtx(request);

        return runWithCorrelation(correlationCtx, async () => {
          try {
            // Enforce JSON:API headers
            assertJsonApiRequestHeaders(request);

            // Validate request body (Zod safeParse)
            const parseResult = createPaymentIntentRequestSchema.safeParse(
              request.body
            );
            if (!parseResult.success) {
              const error = mapValidationErrorToJsonApi(
                parseResult.error.message,
                request.id,
                "/data/attributes"
              );
              setJsonApiResponseHeaders(reply);
              return reply.status(400).send(buildErrorDocument([error]));
            }

            const reqBody = parseResult.data as CreatePaymentIntentRequest;
            const attrs = reqBody.data.attributes;

            // Map to use case input
            const input: CreatePaymentIntentInput = {
              id: unsafePaymentIntentId(randomUUID()),
              rideId: unsafeRideId(attrs.rideId),
              riderId: unsafeRiderId(attrs.riderId),
              amountCOP: MoneyCOP.fromTrusted(attrs.amountCOP),
              fareBreakdown: attrs.fareBreakdown,
              correlationId: request.id,
            };

            // Wrap use case invocation with observability
            const tracer = getTracer();
            const wrapper = withUseCaseObservability({
              useCase: "Payments.CreatePaymentIntent",
              tracer,
              logger: request.log,
            });

            const output = await wrapper(() =>
              useCases.createPaymentIntent.execute(input)
            );

            // Build JSON:API resource
            const resource: JsonApiResource = buildResource({
              type: "payment-intents",
              id: String(output.paymentIntentId),
              attributes: {
                rideId: String(output.rideId),
                riderId: String(output.riderId),
                amountCOP: output.amountCOP,
                currency: output.currency,
                createdAtUTC: output.createdAtUTC,
              },
            });

            setJsonApiResponseHeaders(reply);
            return reply.status(201).send(buildDocumentSingle(resource));
          } catch (error) {
            sendJsonApiError(reply, error as Error, request.id);
          }
        });
      }
    );

    /**
     * POST /api/settlement-actions - Initiate settlement
     *
     * Requires Idempotency-Key header for deterministic idempotency.
     */
    app.post(
      "/settlement-actions",
      {
        schema: {
          description: "Initiate payment settlement for a ride",
          tags: ["payments"],
          body: initiateSettlementRequestSchema,
        },
        preHandler: requireScopes([AUTH_SCOPES.PAYMENT_INITIATE]),
        config: {
          rateLimit: {
            max: 100, // Max 100 settlement attempts per minute
            timeWindow: "1 minute",
          },
        },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        // Establish correlation context
        const correlationCtx = buildCorrelationCtx(request);

        return runWithCorrelation(correlationCtx, async () => {
          try {
            // Enforce JSON:API headers
            assertJsonApiRequestHeaders(request);

            // Validate request body (Zod safeParse)
            const parseResult = initiateSettlementRequestSchema.safeParse(
              request.body
            );
            if (!parseResult.success) {
              const error = mapValidationErrorToJsonApi(
                parseResult.error.message,
                request.id,
                "/data/attributes"
              );
              setJsonApiResponseHeaders(reply);
              return reply.status(400).send(buildErrorDocument([error]));
            }

            const reqBody = parseResult.data as InitiateSettlementRequest;
            const attrs = reqBody.data.attributes;

            // Require Idempotency-Key header
            const idempotencyKeyHeader =
              (request.headers["idempotency-key"] as string | undefined) ||
              (request.headers["x-correlation-id"] as string | undefined);

            if (!idempotencyKeyHeader) {
              throw new ValidationError(
                "Idempotency-Key or x-correlation-id header is required"
              );
            }

            // Idempotency key from header MUST match body (deterministic)
            if (idempotencyKeyHeader !== attrs.idempotencyKey) {
              throw new ValidationError(
                "Idempotency-Key header must match request body idempotencyKey"
              );
            }

            // Validate idempotency key value object
            const idempotencyKeyResult = IdempotencyKey.create(
              attrs.idempotencyKey
            );
            if (idempotencyKeyResult.isErr()) {
              setJsonApiResponseHeaders(reply);
              return reply.status(400).send({
                errors: [
                  buildError({
                    status: "400",
                    title: "validation error",
                    detail: `Invalid idempotency key: ${idempotencyKeyResult.error.message}`,
                    source: { pointer: "/data/attributes/idempotencyKey" },
                    meta: { requestId: request.id, retryable: false },
                  }),
                ],
              });
            }
            const idempotencyKey = idempotencyKeyResult.value;

            // Map to use case input
            const input: InitiateSettlementInput = {
              rideId: unsafeRideId(attrs.rideId),
              idempotencyKey,
              providerTokenRef: attrs.providerTokenRef,
              riderAcknowledgedDecline: attrs.riderAcknowledgedDecline,
              correlationId: request.id,
            };

            // Wrap use case invocation with observability
            const tracer = getTracer();
            const wrapper = withUseCaseObservability({
              useCase: "Payments.InitiateSettlement",
              tracer,
              logger: request.log,
            });

            const output = await wrapper(() =>
              useCases.initiateSettlement.execute(input)
            );

            // Build JSON:API resource
            const resource: JsonApiResource = buildResource({
              type: "settlement-actions",
              id: `${String(output.paymentIntentId)}_${String(output.attemptNumber)}`,
              attributes: {
                paymentIntentId: output.paymentIntentId,
                rideId: output.rideId,
                outcome: output.outcome,
                attemptNumber: output.attemptNumber,
                isRetryable: output.retryable,
              },
            });

            setJsonApiResponseHeaders(reply);
            return reply.status(201).send(buildDocumentSingle(resource));
          } catch (error) {
            sendJsonApiError(reply, error as Error, request.id);
          }
        });
      }
    );

    /**
     * GET /api/rides/:rideId/receipt - Get user receipt
     */
    app.get(
      "/rides/:rideId/receipt",
      {
        schema: {
          description: "Get payment receipt for a ride (user-facing)",
          tags: ["payments"],
          params: getReceiptParamsSchema,
        },
        preHandler: requireScopes([AUTH_SCOPES.PAYMENT_READ]),
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          // Validate params
          const parseResult = getReceiptParamsSchema.safeParse(request.params);
          if (!parseResult.success) {
            const error = mapValidationErrorToJsonApi(
              parseResult.error.message,
              request.id,
              undefined,
              "rideId"
            );
            setJsonApiResponseHeaders(reply);
            return reply.status(400).send(buildErrorDocument([error]));
          }

          const params = parseResult.data as GetReceiptParams;
          const user = getAuthenticatedUser(request);

          // Authorization: Only the rider can access their receipt
          if (!user.riderId) {
            throw new AuthorizationError("Only riders can access receipts");
          }

          // Map to use case input
          const input: GetUserReceiptInput = {
            rideId: unsafeRideId(params.rideId),
            riderId: unsafeRiderId(user.riderId),
          };

          // Invoke use case
          const output = await useCases.getUserReceipt.execute(input);

          if (!output) {
            const error = buildError({
              status: "404",
              title: "not found",
              detail: `Receipt not found for ride ${params.rideId}`,
              meta: { requestId: request.id, retryable: false },
            });
            setJsonApiResponseHeaders(reply);
            return reply.status(404).send(buildErrorDocument([error]));
          }

          // Build JSON:API resource
          const resource: JsonApiResource = buildResource({
            type: "payment-receipts",
            id: output.rideId,
            attributes: {
              rideId: output.rideId,
              amountCOP: output.amountCOP,
              currency: output.currency,
              fareBreakdown: output.fareBreakdown,
              paymentStatus: output.paymentStatus,
              createdAt: output.createdAt,
            },
          });

          setJsonApiResponseHeaders(reply);
          return reply.status(200).send(buildDocumentSingle(resource));
        } catch (error) {
          sendJsonApiError(reply, error as Error, request.id);
        }
      }
    );

    /**
     * GET /api/rides/:rideId/payment-evidence - Get support evidence (admin only)
     */
    app.get(
      "/rides/:rideId/payment-evidence",
      {
        schema: {
          description: "Get payment evidence for support (admin/ops only)",
          tags: ["payments"],
          params: getPaymentEvidenceParamsSchema,
        },
        preHandler: requireScopes([AUTH_SCOPES.ADMIN_READ]),
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          // Validate params
          const parseResult = getPaymentEvidenceParamsSchema.safeParse(
            request.params
          );
          if (!parseResult.success) {
            const error = mapValidationErrorToJsonApi(
              parseResult.error.message,
              request.id,
              undefined,
              "rideId"
            );
            setJsonApiResponseHeaders(reply);
            return reply.status(400).send(buildErrorDocument([error]));
          }

          const params = parseResult.data as GetPaymentEvidenceParams;

          // Map to use case input
          const input: GetSupportEvidenceInput = {
            rideId: unsafeRideId(params.rideId),
          };

          // Invoke use case
          const output = await useCases.getSupportEvidence.execute(input);

          if (!output) {
            const error = buildError({
              status: "404",
              title: "not found",
              detail: `Payment evidence not found for ride ${params.rideId}`,
              meta: { requestId: request.id, retryable: false },
            });
            setJsonApiResponseHeaders(reply);
            return reply.status(404).send(buildErrorDocument([error]));
          }

          // Build JSON:API resource
          const resource: JsonApiResource = buildResource({
            type: "payment-evidence",
            id: output.paymentIntentId,
            attributes: {
              paymentIntentId: output.paymentIntentId,
              rideId: output.rideId,
              riderId: output.riderId,
              amountCOP: output.amountCOP,
              paymentStatus: output.paymentStatus,
              attemptCount: output.attemptCount,
              attempts: output.attempts,
              createdAt: output.createdAt,
            },
          });

          setJsonApiResponseHeaders(reply);
          return reply.status(200).send(buildDocumentSingle(resource));
        } catch (error) {
          sendJsonApiError(reply, error as Error, request.id);
        }
      }
    );

    /**
     * GET /api/rides/:rideId/payment-status - Get payment status
     */
    app.get(
      "/rides/:rideId/payment-status",
      {
        schema: {
          description: "Get payment status for a ride",
          tags: ["payments"],
          params: getPaymentStatusParamsSchema,
        },
        preHandler: requireScopes([AUTH_SCOPES.PAYMENT_READ]),
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          // Validate params
          const parseResult = getPaymentStatusParamsSchema.safeParse(
            request.params
          );
          if (!parseResult.success) {
            const error = mapValidationErrorToJsonApi(
              parseResult.error.message,
              request.id,
              undefined,
              "rideId"
            );
            setJsonApiResponseHeaders(reply);
            return reply.status(400).send(buildErrorDocument([error]));
          }

          const params = parseResult.data as GetPaymentStatusParams;

          // Map to use case input
          const input: GetPaymentStatusInput = {
            rideId: unsafeRideId(params.rideId),
          };

          // Invoke use case
          const output = await useCases.getPaymentStatus.execute(input);

          if (!output) {
            const error = buildError({
              status: "404",
              title: "not found",
              detail: `Payment status not found for ride ${params.rideId}`,
              meta: { requestId: request.id, retryable: false },
            });
            setJsonApiResponseHeaders(reply);
            return reply.status(404).send(buildErrorDocument([error]));
          }

          // Build JSON:API resource
          const resource: JsonApiResource = buildResource({
            type: "payment-status",
            id: params.rideId,
            attributes: {
              rideId: params.rideId,
              status: output.status,
              attemptCount: output.attemptCount,
            },
          });

          setJsonApiResponseHeaders(reply);
          return reply.status(200).send(buildDocumentSingle(resource));
        } catch (error) {
          sendJsonApiError(reply, error as Error, request.id);
        }
      }
    );
  };

  return routes;
};
