/**
 * Database invariant integration tests.
 *
 * Proves database enforces core invariants via constraints and triggers.
 * Tests run against real Postgres with all migrations applied.
 *
 * Design:
 * - Flat tests (<=10 statements, <=3 assertions)
 * - AAA pattern (Arrange, Act, Assert)
 * - Direct SQL for clarity (no ORM noise)
 */

import { beforeAll, describe, expect, it } from "vitest";
import { initFareCalculationModel } from "../../modules/fares/infrastructure/index.js";
import {
  initPaymentIntentModel,
  initSettlementAttemptModel,
} from "../../modules/payments/infrastructure/index.js";
import { initRideModels } from "../../modules/rides/infrastructure/index.js";
import { cleanTestDatabase } from "../../test/helpers/test-db.js";
import { applyMigrations, exec, getSequelize } from "./helpers/db.js";

describe("Database Invariants", () => {
  beforeAll(async () => {
    // Sync models first so tables exist before constraint migrations run
    const sequelize = getSequelize();
    const PaymentIntent = initPaymentIntentModel(sequelize);
    const SettlementAttempt = initSettlementAttemptModel(sequelize);
    const FareCalculation = initFareCalculationModel(sequelize);
    const rideModels = initRideModels(sequelize);

    await PaymentIntent.sync({ force: true });
    await SettlementAttempt.sync({ force: true });
    await FareCalculation.sync({ force: true });
    await rideModels.Ride.sync({ force: true });
    await rideModels.RideTransition.sync({ force: true });

    // Now apply constraint migrations (indexes, triggers, check constraints)
    await applyMigrations();
  });

  describe("Payment Intent Constraints", () => {
    it("rejects duplicate payment_intents.ride_id", async () => {
      // Arrange: insert first payment intent
      await cleanTestDatabase();
      await exec(`
        INSERT INTO payment_intents (
          id, tenant_id, ride_id, rider_id, amount_cop, currency,
          fare_base, fare_distance_component, fare_time_component,
          fare_minimum_applied, created_at_utc, created_at, updated_at
        ) VALUES (
          'pi-1', 'tenant-1', 'ride-1', 'rider-1', 10000, 'COP',
          5000, 3000, 2000, false, NOW(), NOW(), NOW()
        )
      `);

      // Act: attempt duplicate ride_id
      const act = () =>
        exec(`
        INSERT INTO payment_intents (
          id, tenant_id, ride_id, rider_id, amount_cop, currency,
          fare_base, fare_distance_component, fare_time_component,
          fare_minimum_applied, created_at_utc, created_at, updated_at
        ) VALUES (
          'pi-2', 'tenant-1', 'ride-1', 'rider-2', 12000, 'COP',
          5000, 4000, 3000, false, NOW(), NOW(), NOW()
        )
      `);

      // Assert: constraint violation
      await expect(act()).rejects.toThrow(/unique|duplicate|validation/i);
    });

    it("rejects second SUCCEEDED settlement for same payment_intent", async () => {
      // Arrange: insert payment intent + SUCCEEDED settlement
      await cleanTestDatabase();
      await exec(`
        INSERT INTO payment_intents (
          id, tenant_id, ride_id, rider_id, amount_cop, currency,
          fare_base, fare_distance_component, fare_time_component,
          fare_minimum_applied, created_at_utc, created_at, updated_at
        ) VALUES (
          'pi-1', 'tenant-1', 'ride-1', 'rider-1', 10000, 'COP',
          5000, 3000, 2000, false, NOW(), NOW(), NOW()
        )
      `);
      await exec(`
        INSERT INTO settlement_attempts (
          id, payment_intent_id, tenant_id, attempt_number,
          idempotency_key, outcome, initiated_at_utc, created_at, updated_at
        ) VALUES (
          'sa-1', 'pi-1', 'tenant-1', 1, 'idem-1', 'SUCCEEDED', NOW(), NOW(), NOW()
        )
      `);

      // Act: attempt second SUCCEEDED settlement
      const act = () =>
        exec(`
        INSERT INTO settlement_attempts (
          id, payment_intent_id, tenant_id, attempt_number,
          idempotency_key, outcome, initiated_at_utc, created_at, updated_at
        ) VALUES (
          'sa-2', 'pi-1', 'tenant-1', 2, 'idem-2', 'SUCCEEDED', NOW(), NOW(), NOW()
        )
      `);

      // Assert: partial unique index violation
      await expect(act()).rejects.toThrow(/unique|duplicate|validation/i);
    });

    it("allows multiple non-SUCCEEDED settlements for same payment_intent", async () => {
      // Arrange: insert payment intent
      await cleanTestDatabase();
      await exec(`
        INSERT INTO payment_intents (
          id, tenant_id, ride_id, rider_id, amount_cop, currency,
          fare_base, fare_distance_component, fare_time_component,
          fare_minimum_applied, created_at_utc, created_at, updated_at
        ) VALUES (
          'pi-1', 'tenant-1', 'ride-1', 'rider-1', 10000, 'COP',
          5000, 3000, 2000, false, NOW(), NOW(), NOW()
        )
      `);

      // Act: insert multiple FAILED settlements
      await exec(`
        INSERT INTO settlement_attempts (
          id, payment_intent_id, tenant_id, attempt_number,
          idempotency_key, outcome, initiated_at_utc, created_at, updated_at
        ) VALUES (
          'sa-1', 'pi-1', 'tenant-1', 1, 'idem-1', 'FAILED', NOW(), NOW(), NOW()
        )
      `);
      await exec(`
        INSERT INTO settlement_attempts (
          id, payment_intent_id, tenant_id, attempt_number,
          idempotency_key, outcome, initiated_at_utc, created_at, updated_at
        ) VALUES (
          'sa-2', 'pi-1', 'tenant-1', 2, 'idem-2', 'DECLINED', NOW(), NOW(), NOW()
        )
      `);

      // Assert: no constraint violation
      const rows = await exec<{ count: number }>(`
        SELECT COUNT(*) as count FROM settlement_attempts WHERE payment_intent_id = 'pi-1'
      `);
      expect(Number(rows?.[0]?.count)).toBe(2);
    });

    it("rejects attempt_number > 3", async () => {
      // Arrange: insert payment intent
      await cleanTestDatabase();
      await exec(`
        INSERT INTO payment_intents (
          id, tenant_id, ride_id, rider_id, amount_cop, currency,
          fare_base, fare_distance_component, fare_time_component,
          fare_minimum_applied, created_at_utc, created_at, updated_at
        ) VALUES (
          'pi-1', 'tenant-1', 'ride-1', 'rider-1', 10000, 'COP',
          5000, 3000, 2000, false, NOW(), NOW(), NOW()
        )
      `);

      // Act: attempt settlement with attempt_number = 4
      const act = () =>
        exec(`
        INSERT INTO settlement_attempts (
          id, payment_intent_id, tenant_id, attempt_number,
          idempotency_key, outcome, initiated_at_utc, created_at, updated_at
        ) VALUES (
          'sa-4', 'pi-1', 'tenant-1', 4, 'idem-4', 'FAILED', NOW(), NOW(), NOW()
        )
      `);

      // Assert: check constraint violation
      await expect(act()).rejects.toThrow(/check|constraint/i);
    });

    it("rejects attempt_number < 1", async () => {
      // Arrange: insert payment intent
      await cleanTestDatabase();
      await exec(`
        INSERT INTO payment_intents (
          id, tenant_id, ride_id, rider_id, amount_cop, currency,
          fare_base, fare_distance_component, fare_time_component,
          fare_minimum_applied, created_at_utc, created_at, updated_at
        ) VALUES (
          'pi-1', 'tenant-1', 'ride-1', 'rider-1', 10000, 'COP',
          5000, 3000, 2000, false, NOW(), NOW(), NOW()
        )
      `);

      // Act: attempt settlement with attempt_number = 0
      const act = () =>
        exec(`
        INSERT INTO settlement_attempts (
          id, payment_intent_id, tenant_id, attempt_number,
          idempotency_key, outcome, initiated_at_utc, created_at, updated_at
        ) VALUES (
          'sa-0', 'pi-1', 'tenant-1', 0, 'idem-0', 'FAILED', NOW(), NOW(), NOW()
        )
      `);

      // Assert: check constraint violation
      await expect(act()).rejects.toThrow(/check|constraint/i);
    });

    it("rejects duplicate (payment_intent_id, idempotency_key)", async () => {
      // Arrange: insert payment intent + settlement attempt
      await cleanTestDatabase();
      await exec(`
        INSERT INTO payment_intents (
          id, tenant_id, ride_id, rider_id, amount_cop, currency,
          fare_base, fare_distance_component, fare_time_component,
          fare_minimum_applied, created_at_utc, created_at, updated_at
        ) VALUES (
          'pi-1', 'tenant-1', 'ride-1', 'rider-1', 10000, 'COP',
          5000, 3000, 2000, false, NOW(), NOW(), NOW()
        )
      `);
      await exec(`
        INSERT INTO settlement_attempts (
          id, payment_intent_id, tenant_id, attempt_number,
          idempotency_key, outcome, initiated_at_utc, created_at, updated_at
        ) VALUES (
          'sa-1', 'pi-1', 'tenant-1', 1, 'idem-1', 'FAILED', NOW(), NOW(), NOW()
        )
      `);

      // Act: attempt duplicate idempotency key for same payment_intent
      const act = () =>
        exec(`
        INSERT INTO settlement_attempts (
          id, payment_intent_id, tenant_id, attempt_number,
          idempotency_key, outcome, initiated_at_utc, created_at, updated_at
        ) VALUES (
          'sa-2', 'pi-1', 'tenant-1', 2, 'idem-1', 'DECLINED', NOW(), NOW(), NOW()
        )
      `);

      // Assert: composite unique constraint violation
      await expect(act()).rejects.toThrow(/unique|duplicate|validation/i);
    });
  });

  describe("Fare Calculation Constraints", () => {
    it("rejects duplicate fare_calculations.ride_id", async () => {
      // Arrange: insert first fare calculation
      await cleanTestDatabase();
      await exec(`
        INSERT INTO fare_calculations (
          id, ride_id, tenant_id, base_fare_cop, distance_km, duration_minutes,
          distance_component_cop, time_component_cop, total_fare_cop,
          minimum_applied, pricing_version, calculated_at, created_at, updated_at
        ) VALUES (
          'fc-1', 'ride-1', 'tenant-1', 3500, 5.0, 10.0,
          6000, 2000, 8500, false, 'v1.0.0', NOW(), NOW(), NOW()
        )
      `);

      // Act: attempt duplicate ride_id
      const act = () =>
        exec(`
        INSERT INTO fare_calculations (
          id, ride_id, tenant_id, base_fare_cop, distance_km, duration_minutes,
          distance_component_cop, time_component_cop, total_fare_cop,
          minimum_applied, pricing_version, calculated_at, created_at, updated_at
        ) VALUES (
          'fc-2', 'ride-1', 'tenant-1', 3500, 5.0, 10.0,
          6000, 2000, 8500, false, 'v1.0.0', NOW(), NOW(), NOW()
        )
      `);

      // Assert: unique constraint violation
      await expect(act()).rejects.toThrow(/unique|duplicate|validation/i);
    });

    it("rejects UPDATE on fare_calculations", async () => {
      // Arrange: insert fare calculation
      await cleanTestDatabase();
      await exec(`
        INSERT INTO fare_calculations (
          id, ride_id, tenant_id, base_fare_cop, distance_km, duration_minutes,
          distance_component_cop, time_component_cop, total_fare_cop,
          minimum_applied, pricing_version, calculated_at, created_at, updated_at
        ) VALUES (
          'fc-1', 'ride-1', 'tenant-1', 3500, 5.0, 10.0,
          6000, 2000, 8500, false, 'v1.0.0', NOW(), NOW(), NOW()
        )
      `);

      // Act: attempt update
      const act = () =>
        exec(`
        UPDATE fare_calculations SET total_fare_cop = 9000 WHERE id = 'fc-1'
      `);

      // Assert: immutability trigger fires
      await expect(act()).rejects.toThrow(/immutable/i);
    });

    it("rejects DELETE on fare_calculations", async () => {
      // Arrange: insert fare calculation
      await cleanTestDatabase();
      await exec(`
        INSERT INTO fare_calculations (
          id, ride_id, tenant_id, base_fare_cop, distance_km, duration_minutes,
          distance_component_cop, time_component_cop, total_fare_cop,
          minimum_applied, pricing_version, calculated_at, created_at, updated_at
        ) VALUES (
          'fc-1', 'ride-1', 'tenant-1', 3500, 5.0, 10.0,
          6000, 2000, 8500, false, 'v1.0.0', NOW(), NOW(), NOW()
        )
      `);

      // Act: attempt delete
      const act = () => exec(`DELETE FROM fare_calculations WHERE id = 'fc-1'`);

      // Assert: immutability trigger fires
      await expect(act()).rejects.toThrow(/immutable/i);
    });
  });

  describe("Ride Constraints", () => {
    it("rejects invalid rides.state", async () => {
      // Arrange: clean database
      await cleanTestDatabase();

      // Act: attempt invalid state
      const act = () =>
        exec(`
        INSERT INTO rides (
          id, tenant_id, rider_id, state, version,
          pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, requested_at,
          created_at, updated_at
        ) VALUES (
          'ride-1', 'tenant-1', 'rider-1', 'INVALID_STATE', 1,
          4.6097, -74.0817, 4.6198, -74.0721, NOW(),
          NOW(), NOW()
        )
      `);

      // Assert: check constraint violation
      await expect(act()).rejects.toThrow(/check|constraint/i);
    });

    it("allows all valid ride states", async () => {
      // Arrange: clean database
      await cleanTestDatabase();
      const validStates = [
        "CREATED",
        "DISPATCHING",
        "ASSIGNED",
        "STARTED",
        "COMPLETED",
        "CANCELED",
        "EXPIRED",
        "FAILED",
      ];

      // Act: insert ride for each valid state
      for (let idx = 0; idx < validStates.length; idx++) {
        const state = validStates[idx];
        await exec(`
          INSERT INTO rides (
            id, tenant_id, rider_id, state, version,
            pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, requested_at,
            created_at, updated_at
          ) VALUES (
            'ride-${idx}', 'tenant-1', 'rider-1', '${state}', 1,
            4.6097, -74.0817, 4.6198, -74.0721, NOW(),
            NOW(), NOW()
          )
        `);
      }

      // Assert: all inserts succeeded
      const rows = await exec<{ count: number }>(`
        SELECT COUNT(*) as count FROM rides
      `);
      expect(Number(rows?.[0]?.count)).toBe(validStates.length);
    });

    it("rejects NULL rides.version", async () => {
      // Arrange: clean database
      await cleanTestDatabase();

      // Act: attempt NULL version
      const act = () =>
        exec(`
        INSERT INTO rides (
          id, tenant_id, rider_id, state, version,
          pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, requested_at,
          created_at, updated_at
        ) VALUES (
          'ride-1', 'tenant-1', 'rider-1', 'CREATED', NULL,
          4.6097, -74.0817, 4.6198, -74.0721, NOW(),
          NOW(), NOW()
        )
      `);

      // Assert: NOT NULL constraint violation
      await expect(act()).rejects.toThrow(/null|not null|check|constraint/i);
    });

    it("rejects UPDATE on ride_transitions", async () => {
      // Arrange: insert ride + transition
      await cleanTestDatabase();
      await exec(`
        INSERT INTO rides (
          id, tenant_id, rider_id, state, version,
          pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, requested_at,
          created_at, updated_at
        ) VALUES (
          'ride-1', 'tenant-1', 'rider-1', 'CREATED', 1,
          4.6097, -74.0817, 4.6198, -74.0721, NOW(),
          NOW(), NOW()
        )
      `);
      await exec(`
        INSERT INTO ride_transitions (
          id, ride_id, from_state, to_state,
          changed_by, changed_by_role, created_at
        ) VALUES (
          'rt-1', 'ride-1', 'CREATED', 'DISPATCHING',
          'system', 'system', NOW()
        )
      `);

      // Act: attempt update
      const act = () =>
        exec(`
        UPDATE ride_transitions SET to_state = 'ASSIGNED' WHERE id = 'rt-1'
      `);

      // Assert: immutability trigger fires
      await expect(act()).rejects.toThrow(/immutable/i);
    });

    it("rejects DELETE on ride_transitions", async () => {
      // Arrange: insert ride + transition
      await cleanTestDatabase();
      await exec(`
        INSERT INTO rides (
          id, tenant_id, rider_id, state, version,
          pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, requested_at,
          created_at, updated_at
        ) VALUES (
          'ride-1', 'tenant-1', 'rider-1', 'CREATED', 1,
          4.6097, -74.0817, 4.6198, -74.0721, NOW(),
          NOW(), NOW()
        )
      `);
      await exec(`
        INSERT INTO ride_transitions (
          id, ride_id, from_state, to_state,
          changed_by, changed_by_role, created_at
        ) VALUES (
          'rt-1', 'ride-1', 'CREATED', 'DISPATCHING',
          'system', 'system', NOW()
        )
      `);

      // Act: attempt delete
      const act = () => exec(`DELETE FROM ride_transitions WHERE id = 'rt-1'`);

      // Assert: immutability trigger fires
      await expect(act()).rejects.toThrow(/immutable/i);
    });
  });
});
