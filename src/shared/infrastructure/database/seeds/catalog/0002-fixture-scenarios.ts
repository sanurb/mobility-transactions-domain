/**
 * Fixture seed: Ride lifecycle scenarios with fares, payments, and dispatch.
 *
 * Category: fixture (ephemeral dev/test data, may evolve between versions).
 *
 * UPSERT strategies per table:
 * - rides:               mutable aggregate → DO UPDATE on (id)
 * - ride_transitions:    immutable audit trail (DB trigger) → DO NOTHING on (id)
 * - fare_calculations:   immutable (DB trigger), one per ride → DO NOTHING on (ride_id)
 * - payment_intents:     mutable, one per ride → DO UPDATE on (ride_id)
 * - settlement_attempts: mutable, keyed by idempotency → DO UPDATE on (payment_intent_id, idempotency_key)
 * - dispatch_audits:     immutable evidence, unique correlation → DO NOTHING on (tenant_id, correlation_id)
 */

import { upsertRows } from "../engine/seed-upsert.js";
import type { SeedMigration } from "../engine/types.js";
import {
  SEED_DISPATCH_AUDITS,
  SEED_FARE_CALCULATIONS,
  SEED_PAYMENT_INTENTS,
  SEED_RIDE_TRANSITIONS,
  SEED_RIDES,
  SEED_SETTLEMENT_ATTEMPTS,
} from "../seed-data.js";

export const fixtureSeed: SeedMigration = {
  name: "0002-fixture-scenarios",
  category: "fixture",

  data: () => ({
    rides: SEED_RIDES,
    rideTransitions: SEED_RIDE_TRANSITIONS,
    fareCalculations: SEED_FARE_CALCULATIONS,
    paymentIntents: SEED_PAYMENT_INTENTS,
    settlementAttempts: SEED_SETTLEMENT_ATTEMPTS,
    dispatchAudits: SEED_DISPATCH_AUDITS,
  }),

  async up(ctx) {
    let rows = 0;

    // Rides: mutable aggregate, PK-based upsert
    rows += await upsertRows(ctx, "rides", SEED_RIDES, "(id)", true);

    // Transitions: immutable (DB trigger blocks UPDATE/DELETE)
    rows += await upsertRows(
      ctx,
      "ride_transitions",
      SEED_RIDE_TRANSITIONS,
      "(id)",
      false
    );

    // Fares: immutable (DB trigger), domain invariant = one fare per ride
    rows += await upsertRows(
      ctx,
      "fare_calculations",
      SEED_FARE_CALCULATIONS,
      "(ride_id)",
      false
    );

    // Payment intents: mutable, domain invariant = one payment per ride
    rows += await upsertRows(
      ctx,
      "payment_intents",
      SEED_PAYMENT_INTENTS,
      "(ride_id)",
      true
    );

    // Settlement attempts: mutable, keyed by idempotency
    rows += await upsertRows(
      ctx,
      "settlement_attempts",
      SEED_SETTLEMENT_ATTEMPTS,
      "(payment_intent_id, idempotency_key)",
      true
    );

    // Dispatch audits: immutable evidence store, unique per correlation
    rows += await upsertRows(
      ctx,
      "dispatch_audits",
      SEED_DISPATCH_AUDITS,
      "(tenant_id, correlation_id)",
      false
    );

    return rows;
  },
};
