/**
 * Payment JSON:API Contract Tests
 *
 * Validates HTTP boundary: media types, status codes, response shape.
 * Uses standalone Fastify instance with fake use cases (no auth middleware).
 * Follows Testing Rules for AI: flat bodies, AAA, <=3 assertions.
 */

import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createPaymentJsonApiRoutes } from "../../adapters/inbound/payment.jsonapi-routes.js";
import type {
  CreatePaymentIntentInput,
  CreatePaymentIntentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  GetSupportEvidenceInput,
  GetSupportEvidenceOutput,
  GetUserReceiptInput,
  GetUserReceiptOutput,
  InitiateSettlementInput,
  InitiateSettlementOutput,
} from "../../application/use-cases/index.js";

const APPLICATION_VND_API_JSON = "application/vnd.api+json";

/**
 * Register application/vnd.api+json content-type parser so Fastify
 * accepts JSON:API requests (by default only application/json is parsed).
 */
const addJsonApiParser = (app: FastifyInstance): void => {
  app.addContentTypeParser(
    APPLICATION_VND_API_JSON,
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

/**
 * Stub use cases for contract testing
 */
const createStubUseCases = () => {
  const intentId = randomUUID();
  const rideId = randomUUID();
  const riderId = randomUUID();

  return {
    createPaymentIntent: {
      execute: async (
        _input: CreatePaymentIntentInput
      ): Promise<CreatePaymentIntentOutput> => ({
        paymentIntentId:
          intentId as unknown as CreatePaymentIntentOutput["paymentIntentId"],
        rideId: rideId as unknown as CreatePaymentIntentOutput["rideId"],
        riderId: riderId as unknown as CreatePaymentIntentOutput["riderId"],
        amountCOP: 25_000,
        currency: "COP",
        createdAtUTC: new Date().toISOString(),
      }),
    },
    initiateSettlement: {
      execute: async (
        _input: InitiateSettlementInput
      ): Promise<InitiateSettlementOutput> => ({
        paymentIntentId: intentId,
        rideId,
        outcome: "SUCCEEDED" as const,
        attemptNumber: 1,
        retryable: false,
      }),
    },
    getUserReceipt: {
      execute: async (
        input: GetUserReceiptInput
      ): Promise<GetUserReceiptOutput | null> => null,
    },
    getSupportEvidence: {
      execute: async (
        _input: GetSupportEvidenceInput
      ): Promise<GetSupportEvidenceOutput | null> => null,
    },
    getPaymentStatus: {
      execute: async (
        _input: GetPaymentStatusInput
      ): Promise<GetPaymentStatusOutput | null> => null,
    },
  };
};

describe("Payment JSON:API Contract", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const useCases = createStubUseCases();

    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    // Register JSON:API content-type parser
    addJsonApiParser(app);

    // Mock auth - add dummy user to all requests
    app.addHook("onRequest", async (request) => {
      (request as unknown as Record<string, unknown>).user = {
        id: "test-user-1",
        role: "rider",
        riderId: "test-rider-1",
        scopes: ["payment:read", "payment:initiate", "admin:read"],
      };
    });

    await app.register(
      createPaymentJsonApiRoutes(
        useCases as Parameters<typeof createPaymentJsonApiRoutes>[0]
      ),
      { prefix: "/api/v1" }
    );
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  test("When POST payment-intents with valid JSON:API body, then 201, Content-Type application/vnd.api+json, and JSON:API data shape", async () => {
    // Arrange
    const requestBody = {
      data: {
        type: "payment-intents",
        attributes: {
          rideId: randomUUID(),
          riderId: randomUUID(),
          amountCOP: 25_000,
          fareBreakdown: {
            baseFare: 5000,
            distanceComponent: 12_000,
            timeComponent: 8000,
            minimumFareApplied: false,
          },
          pricingVersion: "v1.0.0",
        },
      },
    };

    // Act
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/payment-intents",
      headers: {
        "content-type": APPLICATION_VND_API_JSON,
      },
      payload: requestBody,
    });

    // Assert
    expect(response.statusCode).toBe(201);
    expect(response.headers["content-type"]).toContain(
      APPLICATION_VND_API_JSON
    );
    const body = response.json();
    expect(body.data).toHaveProperty("type");
    expect(body.data).toHaveProperty("id");
    expect(body.data).toHaveProperty("attributes");
  });

  test("When GET receipt for unknown ride, then 404 and JSON:API error shape", async () => {
    // Arrange
    const unknownRideId = randomUUID();

    // Act
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/rides/${unknownRideId}/receipt`,
    });

    // Assert
    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain(
      APPLICATION_VND_API_JSON
    );
    const body = response.json();
    expect(body.errors).toBeInstanceOf(Array);
    expect(body.errors[0]).toHaveProperty("status");
    expect(body.errors[0]).toHaveProperty("title");
  });
});
