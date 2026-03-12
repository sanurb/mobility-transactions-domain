/**
 * Payment constraints migration.
 *
 * Enforces core payment invariants at database level:
 * - One payment intent per ride (unique ride_id)
 * - At most one SUCCEEDED settlement per payment intent (partial unique index)
 * - Unique idempotency keys per payment intent (composite unique)
 * - Settlement attempt bounds (1-3 attempts per payment intent)
 *
 * All constraints use IF NOT EXISTS guards for idempotency.
 * All operations are additive-only (no drops/renames).
 */

import type { Sequelize } from "sequelize";

/**
 * Add payment-related database constraints.
 *
 * Idempotent: safe to run multiple times via IF NOT EXISTS guards.
 * Additive-only: never drops or renames existing structures.
 *
 * @param sequelize - Sequelize instance with active connection
 */
export const addPaymentConstraints = async (
  sequelize: Sequelize
): Promise<void> => {
  // Unique payment intent per ride
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_intents_ride_id
    ON payment_intents(ride_id);
  `);

  // At most one SUCCEEDED settlement per payment intent (partial unique index)
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_settlement_attempts_succeeded_per_intent
    ON settlement_attempts(payment_intent_id)
    WHERE outcome = 'SUCCEEDED';
  `);

  // Unique idempotency key per payment intent (composite)
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_settlement_attempts_idempotency_per_intent
    ON settlement_attempts(payment_intent_id, idempotency_key);
  `);

  // Attempt number bounds (1-3 inclusive)
  // Add constraint as NOT VALID first (doesn't scan existing rows), then validate
  await sequelize.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_settlement_attempt_number_range'
      ) THEN
        ALTER TABLE settlement_attempts
        ADD CONSTRAINT chk_settlement_attempt_number_range
        CHECK (attempt_number > 0 AND attempt_number <= 3)
        NOT VALID;
      END IF;
    END
    $$;
  `);

  // Validate constraint (scans existing rows, but low-lock operation)
  await sequelize.query(`
    ALTER TABLE settlement_attempts
    VALIDATE CONSTRAINT chk_settlement_attempt_number_range;
  `);
};
