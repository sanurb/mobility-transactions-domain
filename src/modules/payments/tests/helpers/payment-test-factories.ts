/**
 * Payment Test Factories
 *
 * Provides typed factories with meaningful domain defaults and override support.
 * Follows Testing Rules for AI, Section C.
 */

import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import { IdempotencyKey } from "../../../../shared/domain/value-objects/idempotency-key.js";
import { MoneyCOP } from "../../../../shared/domain/value-objects/money-cop.js";
import {
  unsafePaymentIntentId,
  unsafeRideId,
  unsafeRiderId,
} from "../../../../shared/types/ids/index.js";
import type { ChargeResult } from "../../application/ports/payment-provider.port.js";
import type { CreatePaymentIntentInput } from "../../application/use-cases/create-payment-intent.js";
import type { FareBreakdownRef } from "../../domain/payment-types.js";

/**
 * Build valid input for CreatePaymentIntentUseCase
 */
export const buildPaymentIntentCreateInput = (
  overrides: Partial<CreatePaymentIntentInput> = {}
): CreatePaymentIntentInput => {
  const defaultAmount = MoneyCOP.fromTrusted(25_000);

  return {
    id: unsafePaymentIntentId(randomUUID()),
    rideId: unsafeRideId(randomUUID()),
    riderId: unsafeRiderId(randomUUID()),
    amountCOP: defaultAmount,
    fareBreakdown: {
      baseFare: 5000,
      distanceComponent: 12_000,
      timeComponent: 8000,
      minimumFareApplied: false,
    },
    correlationId: randomUUID(),
    causationId: randomUUID(),
    ...overrides,
  };
};

/**
 * Build canonical provider result for InitiateSettlement use case
 */
export const buildSettlementProviderResult = (
  overrides: Partial<ChargeResult> = {}
): ChargeResult => {
  return {
    outcome: "SUCCEEDED",
    providerRef: faker.string.alphanumeric(16),
    reasonCode: null,
    completedAtUTC: new Date().toISOString(),
    ...overrides,
  };
};

/**
 * Build IdempotencyKey for tests (unwrapped ok value)
 */
export const buildIdempotencyKey = (
  overrides: { value?: string } = {}
): IdempotencyKey => {
  const rawValue = overrides.value ?? `test-${faker.string.alphanumeric(8)}`;
  const result = IdempotencyKey.create(rawValue);
  if (result.isErr()) {
    throw new Error(`buildIdempotencyKey failed: ${result.error.message}`);
  }
  return result.value;
};

/**
 * Build MoneyCOP for tests (safe integer defaults)
 */
export const buildMoneyCOP = (
  overrides: { amount?: number } = {}
): MoneyCOP => {
  const amount =
    overrides.amount ?? faker.number.int({ min: 5000, max: 100_000 });
  return MoneyCOP.fromTrusted(amount);
};

/**
 * Build FareBreakdownRef for tests
 */
export const buildFareBreakdown = (
  overrides: Partial<FareBreakdownRef> = {}
): FareBreakdownRef => {
  return {
    baseFare: 5000,
    distanceComponent: 12_000,
    timeComponent: 8000,
    minimumFareApplied: false,
    ...overrides,
  };
};
