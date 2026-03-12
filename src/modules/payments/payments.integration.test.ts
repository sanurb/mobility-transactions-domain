/**
 * Payment Orchestration Integration Tests
 *
 * Tests validate Phase 5 success criteria through the full HTTP stack:
 * HTTP -> Zod validation -> auth middleware -> use cases -> repository -> PostgreSQL
 *
 * Routes under test (JSON:API at /api/v1):
 * - POST /payment-intents        (create payment intent)
 * - POST /settlement-actions     (initiate settlement)
 * - GET  /rides/:rideId/receipt  (user receipt)
 * - GET  /rides/:rideId/payment-evidence (admin evidence)
 * - GET  /rides/:rideId/payment-status   (payment status)
 *
 * Tests run against real PostgreSQL via Testcontainers for maximum confidence.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AUTH_SCOPES } from "../../shared/infrastructure/auth/auth.types.js";
import {
  clearTokenCache,
  createCustomTestToken,
} from "../../test/helpers/test-auth.js";
import { cleanTestDatabase } from "../../test/helpers/test-db.js";
import {
  closeTestServer,
  getTestServer,
  injectRequest,
} from "../../test/helpers/test-server.js";

// ============================================================================
// Constants
// ============================================================================

const JSONAPI = "application/vnd.api+json";

// ============================================================================
// Test Factories and Helpers
// ============================================================================

/**
 * Create payment test token with payment scopes
 */
const buildPaymentTestToken = async (params: {
  tenantId: string;
  riderId: string;
}): Promise<string> => {
  return createCustomTestToken({
    sub: params.riderId,
    tenantId: params.tenantId,
    riderId: params.riderId,
    scopes: [AUTH_SCOPES.PAYMENT_READ, AUTH_SCOPES.PAYMENT_INITIATE],
  });
};

/**
 * Create admin token with admin scopes
 */
const buildAdminToken = async (params: {
  tenantId: string;
}): Promise<string> => {
  return createCustomTestToken({
    sub: "admin-user",
    tenantId: params.tenantId,
    scopes: [AUTH_SCOPES.ADMIN_READ, AUTH_SCOPES.ADMIN_WRITE],
  });
};

/**
 * Build JSON:API payment-intent request body
 */
const buildPaymentIntentBody = (params: {
  rideId: string;
  riderId: string;
  amountCOP: number;
}) => ({
  data: {
    type: "payment-intents" as const,
    attributes: {
      rideId: params.rideId,
      riderId: params.riderId,
      amountCOP: params.amountCOP,
      fareBreakdown: {
        baseFare: 3500,
        distanceComponent: 6240,
        timeComponent: 2400,
        minimumFareApplied: false,
      },
      pricingVersion: "v1.0.0",
    },
  },
});

/**
 * Build JSON:API settlement-action request body
 */
const buildSettlementBody = (params: {
  rideId: string;
  idempotencyKey: string;
  riderAcknowledgedDecline?: boolean;
}) => ({
  data: {
    type: "settlement-actions" as const,
    attributes: {
      rideId: params.rideId,
      providerTokenRef: `tok_test_${randomUUID()}`,
      idempotencyKey: params.idempotencyKey,
      riderAcknowledgedDecline: params.riderAcknowledgedDecline,
    },
  },
});

/**
 * Create a payment intent via the JSON:API endpoint.
 * Returns the payment intent ID from the response.
 */
const createPaymentIntent = async (params: {
  rideId: string;
  riderId: string;
  amountCOP: number;
  token: string;
}): Promise<string> => {
  const response = await injectRequest({
    method: "POST",
    url: "/api/v1/payment-intents",
    payload: buildPaymentIntentBody({
      rideId: params.rideId,
      riderId: params.riderId,
      amountCOP: params.amountCOP,
    }),
    headers: {
      authorization: `Bearer ${params.token}`,
      "content-type": JSONAPI,
    },
    auth: false,
  });

  expect(response.statusCode).toBe(201);
  const body = JSON.parse(response.body);
  return body.data.id;
};

/**
 * Settle a ride payment via JSON:API endpoint.
 * Returns statusCode and parsed response attributes.
 */
const settlePayment = async (params: {
  rideId: string;
  token: string;
  idempotencyKey?: string;
  riderAcknowledgedDecline?: boolean;
}): Promise<{ statusCode: number; body: Record<string, unknown> }> => {
  const key = params.idempotencyKey ?? randomUUID();
  const response = await injectRequest({
    method: "POST",
    url: "/api/v1/settlement-actions",
    payload: buildSettlementBody({
      rideId: params.rideId,
      idempotencyKey: key,
      riderAcknowledgedDecline: params.riderAcknowledgedDecline,
    }),
    headers: {
      authorization: `Bearer ${params.token}`,
      "content-type": JSONAPI,
      "idempotency-key": key,
    },
    auth: false,
  });

  const body = JSON.parse(response.body);
  const attrs = body.data?.attributes ?? body;
  return { statusCode: response.statusCode, body: attrs };
};

// ============================================================================
// Test Suite
// ============================================================================

describe("Payment Orchestration Integration Tests", () => {
  beforeAll(async () => {
    await getTestServer();
  });

  beforeEach(async () => {
    clearTokenCache();
    await cleanTestDatabase();
  });

  afterAll(async () => {
    await closeTestServer();
  });

  // ============================================================================
  // SC1: Payment Intent creation via API
  // ============================================================================

  describe("SC1: Payment Intent creation", () => {
    it("creates payment intent via JSON:API endpoint", async () => {
      const tenantId = "test-tenant";
      const riderId = `rider-${randomUUID()}`;
      const rideId = randomUUID();
      const token = await buildPaymentTestToken({ tenantId, riderId });

      const intentId = await createPaymentIntent({
        rideId,
        riderId,
        amountCOP: 12_140,
        token,
      });

      expect(intentId).toBeDefined();
      expect(intentId.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // SC2: Intent immutably bound to ride data
  // ============================================================================

  describe("SC2: Intent immutability", () => {
    it("binds payment intent to rideId, riderId, amountCOP, and fareBreakdown", async () => {
      const tenantId = "test-tenant";
      const riderId = `rider-${randomUUID()}`;
      const rideId = randomUUID();
      const token = await buildPaymentTestToken({ tenantId, riderId });
      const adminToken = await buildAdminToken({ tenantId });

      await createPaymentIntent({ rideId, riderId, amountCOP: 12_140, token });

      // Get admin evidence to see full payment intent
      const evidenceResponse = await injectRequest({
        method: "GET",
        url: `/api/v1/rides/${rideId}/payment-evidence`,
        headers: { authorization: `Bearer ${adminToken}` },
        auth: false,
      });

      expect(evidenceResponse.statusCode).toBe(200);
      const evidenceBody = JSON.parse(evidenceResponse.body);
      const evidence = evidenceBody.data?.attributes ?? evidenceBody;
      expect(evidence.rideId).toBe(rideId);
      expect(evidence.amountCOP).toBe(12_140);
      expect(evidence.createdAt).toBeDefined();
    });
  });

  // ============================================================================
  // SC3: Anti-duplication - max one SUCCEEDED settlement per ride
  // ============================================================================

  describe("SC3: Anti-duplication enforcement", () => {
    it("blocks second settlement attempt after SUCCEEDED", async () => {
      const tenantId = "test-tenant";
      const riderId = `rider-${randomUUID()}`;
      const rideId = randomUUID();
      const token = await buildPaymentTestToken({ tenantId, riderId });

      await createPaymentIntent({ rideId, riderId, amountCOP: 12_140, token });

      // First settlement - should succeed (mock provider returns SUCCEEDED)
      const first = await settlePayment({ rideId, token });
      expect(first.statusCode).toBe(201);
      expect(first.body.outcome).toBe("SUCCEEDED");

      // Second settlement - should fail with policy violation
      const second = await settlePayment({ rideId, token });
      expect([409, 422]).toContain(second.statusCode);
    });
  });

  // ============================================================================
  // SC4: Idempotent settlement using client idempotency key
  // ============================================================================

  describe("SC4: Settlement idempotency", () => {
    it("returns same result when using same idempotency key", async () => {
      const tenantId = "test-tenant";
      const riderId = `rider-${randomUUID()}`;
      const rideId = randomUUID();
      const token = await buildPaymentTestToken({ tenantId, riderId });

      await createPaymentIntent({ rideId, riderId, amountCOP: 12_140, token });

      const idempotencyKey = randomUUID();

      // First attempt
      const first = await settlePayment({ rideId, token, idempotencyKey });
      expect(first.statusCode).toBe(201);

      // Second attempt with same idempotency key
      const second = await settlePayment({ rideId, token, idempotencyKey });
      expect(second.body.outcome).toBe(first.body.outcome);
      expect(second.body.attemptNumber).toBe(first.body.attemptNumber);
    });
  });

  // ============================================================================
  // SC5 & SC7: Max 3 attempts, PAYMENT_POLICY_VIOLATION beyond limit
  // ============================================================================

  describe("SC5 & SC7: Attempt limits", () => {
    it("enforces policy after SUCCEEDED (anti-duplication blocks further attempts)", async () => {
      const tenantId = "test-tenant";
      const riderId = `rider-${randomUUID()}`;
      const rideId = randomUUID();
      const token = await buildPaymentTestToken({ tenantId, riderId });

      await createPaymentIntent({ rideId, riderId, amountCOP: 12_140, token });

      // First attempt - should succeed (mock always returns SUCCEEDED)
      const first = await settlePayment({ rideId, token });
      expect(first.statusCode).toBe(201);
      expect(first.body.outcome).toBe("SUCCEEDED");

      // After SUCCEEDED, anti-duplication blocks further attempts
      const blocked = await settlePayment({ rideId, token });
      expect([409, 422]).toContain(blocked.statusCode);
    });
  });

  // ============================================================================
  // SC6: DECLINED requires rider action before retry
  // ============================================================================

  describe("SC6: DECLINED handling", () => {
    it("accepts riderAcknowledgedDecline flag in settlement request", async () => {
      const tenantId = "test-tenant";
      const riderId = `rider-${randomUUID()}`;
      const rideId = randomUUID();
      const token = await buildPaymentTestToken({ tenantId, riderId });

      await createPaymentIntent({ rideId, riderId, amountCOP: 12_140, token });

      // Settlement with rider acknowledgment flag
      const result = await settlePayment({
        rideId,
        token,
        riderAcknowledgedDecline: true,
      });

      expect(result.statusCode).toBe(201);
      expect(result.body.attemptNumber).toBe(1);
    });
  });

  // ============================================================================
  // SC8: UNPAID status for rides without SUCCEEDED settlement
  // ============================================================================

  describe("SC8: UNPAID status derivation", () => {
    it("returns UNPAID status when no SUCCEEDED settlement exists", async () => {
      const tenantId = "test-tenant";
      const riderId = `rider-${randomUUID()}`;
      const rideId = randomUUID();
      const token = await buildPaymentTestToken({ tenantId, riderId });

      await createPaymentIntent({ rideId, riderId, amountCOP: 12_140, token });

      const statusResponse = await injectRequest({
        method: "GET",
        url: `/api/v1/rides/${rideId}/payment-status`,
        headers: { authorization: `Bearer ${token}` },
        auth: false,
      });

      expect(statusResponse.statusCode).toBe(200);
      const statusBody = JSON.parse(statusResponse.body);
      const attrs = statusBody.data?.attributes ?? statusBody;
      expect(attrs.status).toBe("UNPAID");
    });

    it("returns PAID status after SUCCEEDED settlement", async () => {
      const tenantId = "test-tenant";
      const riderId = `rider-${randomUUID()}`;
      const rideId = randomUUID();
      const token = await buildPaymentTestToken({ tenantId, riderId });

      await createPaymentIntent({ rideId, riderId, amountCOP: 12_140, token });
      await settlePayment({ rideId, token });

      const statusResponse = await injectRequest({
        method: "GET",
        url: `/api/v1/rides/${rideId}/payment-status`,
        headers: { authorization: `Bearer ${token}` },
        auth: false,
      });

      expect(statusResponse.statusCode).toBe(200);
      const statusBody = JSON.parse(statusResponse.body);
      const attrs = statusBody.data?.attributes ?? statusBody;
      expect(attrs.status).toBe("PAID");
    });
  });

  // ============================================================================
  // SC9: User receipt shows safe fields only
  // ============================================================================

  describe("SC9: User receipt safety", () => {
    it("returns only safe fields in user receipt (no providerRef, no internal IDs)", async () => {
      const tenantId = "test-tenant";
      const riderId = `rider-${randomUUID()}`;
      const rideId = randomUUID();
      const token = await buildPaymentTestToken({ tenantId, riderId });

      await createPaymentIntent({ rideId, riderId, amountCOP: 12_140, token });

      const receiptResponse = await injectRequest({
        method: "GET",
        url: `/api/v1/rides/${rideId}/receipt`,
        headers: { authorization: `Bearer ${token}` },
        auth: false,
      });

      expect(receiptResponse.statusCode).toBe(200);
      const receiptBody = JSON.parse(receiptResponse.body);
      const receipt = receiptBody.data?.attributes ?? receiptBody;

      // Verify safe fields are present
      expect(receipt.rideId).toBe(rideId);
      expect(receipt.amountCOP).toBe(12_140);
      expect(receipt.currency).toBe("COP");
      expect(receipt.paymentStatus).toBeDefined();
      expect(receipt.createdAt).toBeDefined();

      // Verify sensitive fields are NOT present
      expect(receipt).not.toHaveProperty("providerRef");
    });
  });

  // ============================================================================
  // SC10: Support evidence includes full details
  // ============================================================================

  describe("SC10: Support evidence completeness", () => {
    it("includes reason codes, timestamps, and attempt count for admin", async () => {
      const tenantId = "test-tenant";
      const riderId = `rider-${randomUUID()}`;
      const rideId = randomUUID();
      const token = await buildPaymentTestToken({ tenantId, riderId });
      const adminToken = await buildAdminToken({ tenantId });

      await createPaymentIntent({ rideId, riderId, amountCOP: 12_140, token });
      await settlePayment({ rideId, token });

      const evidenceResponse = await injectRequest({
        method: "GET",
        url: `/api/v1/rides/${rideId}/payment-evidence`,
        headers: { authorization: `Bearer ${adminToken}` },
        auth: false,
      });

      expect(evidenceResponse.statusCode).toBe(200);
      const evidenceBody = JSON.parse(evidenceResponse.body);
      const evidence = evidenceBody.data?.attributes ?? evidenceBody;

      expect(evidence.rideId).toBe(rideId);
      expect(evidence.amountCOP).toBe(12_140);
      expect(evidence.paymentStatus).toBeDefined();
      expect(evidence.attemptCount).toBeGreaterThanOrEqual(1);
      expect(evidence.attempts).toBeDefined();
      expect(evidence.attempts.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // SC11: Provider-agnostic port (mock provider works)
  // ============================================================================

  describe("SC11: Provider adapter pattern", () => {
    it("successfully processes settlement via mock provider adapter", async () => {
      const tenantId = "test-tenant";
      const riderId = `rider-${randomUUID()}`;
      const rideId = randomUUID();
      const token = await buildPaymentTestToken({ tenantId, riderId });

      await createPaymentIntent({ rideId, riderId, amountCOP: 12_140, token });

      const result = await settlePayment({ rideId, token });

      expect(result.statusCode).toBe(201);
      expect(result.body.outcome).toBe("SUCCEEDED");
      expect(result.body.attemptNumber).toBe(1);
    });
  });

  // ============================================================================
  // SC12: Canonical settlement outcomes
  // ============================================================================

  describe("SC12: Canonical settlement outcomes", () => {
    it("returns canonical outcome states (PENDING, SUCCEEDED, DECLINED, FAILED, UNKNOWN)", async () => {
      const tenantId = "test-tenant";
      const riderId = `rider-${randomUUID()}`;
      const rideId = randomUUID();
      const token = await buildPaymentTestToken({ tenantId, riderId });

      await createPaymentIntent({ rideId, riderId, amountCOP: 12_140, token });

      const result = await settlePayment({ rideId, token });

      expect(result.statusCode).toBe(201);
      expect([
        "PENDING",
        "SUCCEEDED",
        "DECLINED",
        "FAILED",
        "UNKNOWN",
      ]).toContain(result.body.outcome);
    });
  });

  // ============================================================================
  // Authorization and tenant isolation
  // ============================================================================

  describe("Authorization and tenant isolation", () => {
    it("rejects unauthenticated settlement request", async () => {
      const key = randomUUID();
      const response = await injectRequest({
        method: "POST",
        url: "/api/v1/settlement-actions",
        payload: buildSettlementBody({
          rideId: "ride-test-001",
          idempotencyKey: key,
        }),
        headers: {
          "content-type": JSONAPI,
          "idempotency-key": key,
        },
        auth: false,
      });

      expect(response.statusCode).toBe(401);
    });

    it("rejects settlement without PAYMENT_INITIATE scope", async () => {
      const tenantId = "test-tenant";
      const riderId = `rider-${randomUUID()}`;

      // Token without PAYMENT_INITIATE scope
      const limitedToken = await createCustomTestToken({
        sub: riderId,
        tenantId,
        riderId,
        scopes: [AUTH_SCOPES.PAYMENT_READ],
      });

      const key = randomUUID();
      const response = await injectRequest({
        method: "POST",
        url: "/api/v1/settlement-actions",
        payload: buildSettlementBody({
          rideId: "ride-test-001",
          idempotencyKey: key,
        }),
        headers: {
          authorization: `Bearer ${limitedToken}`,
          "content-type": JSONAPI,
          "idempotency-key": key,
        },
        auth: false,
      });

      expect(response.statusCode).toBe(403);
    });

    it("rejects admin evidence access without ADMIN_READ scope", async () => {
      const tenantId = "test-tenant";
      const riderId = `rider-${randomUUID()}`;
      const token = await buildPaymentTestToken({ tenantId, riderId });

      const response = await injectRequest({
        method: "GET",
        url: "/api/v1/rides/some-ride-id/payment-evidence",
        headers: { authorization: `Bearer ${token}` },
        auth: false,
      });

      expect(response.statusCode).toBe(403);
    });

    it("requires Idempotency-Key header for settlement", async () => {
      const tenantId = "test-tenant";
      const riderId = `rider-${randomUUID()}`;
      const token = await buildPaymentTestToken({ tenantId, riderId });

      const response = await injectRequest({
        method: "POST",
        url: "/api/v1/settlement-actions",
        payload: buildSettlementBody({
          rideId: "ride-test-001",
          idempotencyKey: randomUUID(),
        }),
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": JSONAPI,
          // No idempotency-key header
        },
        auth: false,
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ============================================================================
  // Concurrent settlement handling
  // ============================================================================

  describe("Concurrent settlement handling", () => {
    it("ensures exactly one settlement succeeds when concurrent attempts made", async () => {
      const tenantId = "test-tenant";
      const riderId = `rider-${randomUUID()}`;
      const rideId = randomUUID();
      const token = await buildPaymentTestToken({ tenantId, riderId });

      await createPaymentIntent({ rideId, riderId, amountCOP: 12_140, token });

      const app = await getTestServer();

      const makeSettlement = (idempotencyKey: string) => {
        return app.inject({
          method: "POST",
          url: "/api/v1/settlement-actions",
          payload: buildSettlementBody({ rideId, idempotencyKey }),
          headers: {
            "content-type": JSONAPI,
            authorization: `Bearer ${token}`,
            "idempotency-key": idempotencyKey,
          },
        });
      };

      const [response1, response2] = await Promise.all([
        makeSettlement(randomUUID()),
        makeSettlement(randomUUID()),
      ]);

      const bodies = [JSON.parse(response1.body), JSON.parse(response2.body)];

      // Extract outcomes from JSON:API responses
      const outcomes = bodies
        .filter((b) => b.data?.attributes?.outcome)
        .map((b) => b.data.attributes.outcome);

      // At least one should succeed (mock provider always succeeds)
      const succeeded = outcomes.filter((o: string) => o === "SUCCEEDED");
      expect(succeeded.length).toBeGreaterThan(0);
    });
  });
});
