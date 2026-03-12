/**
 * Fare constraints migration.
 *
 * Enforces core fare invariants at database level:
 * - One fare calculation per ride (unique ride_id)
 * - Fare calculations are immutable (trigger rejects UPDATE/DELETE)
 *
 * All constraints use IF NOT EXISTS guards for idempotency.
 * All operations are additive-only (no drops/renames).
 */

import type { Sequelize } from "sequelize";

/**
 * Add fare-related database constraints.
 *
 * Idempotent: safe to run multiple times via IF NOT EXISTS guards.
 * Additive-only: never drops or renames existing structures.
 *
 * @param sequelize - Sequelize instance with active connection
 */
export const addFareConstraints = async (
  sequelize: Sequelize
): Promise<void> => {
  // Unique fare calculation per ride
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_fare_calculations_ride_id
    ON fare_calculations(ride_id);
  `);

  // Immutability trigger function
  await sequelize.query(`
    CREATE OR REPLACE FUNCTION raise_fare_immutability_violation()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Fare calculations are immutable';
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Trigger for UPDATE operations
  await sequelize.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_fare_calculations_prevent_update'
      ) THEN
        CREATE TRIGGER trg_fare_calculations_prevent_update
        BEFORE UPDATE ON fare_calculations
        FOR EACH ROW
        EXECUTE FUNCTION raise_fare_immutability_violation();
      END IF;
    END
    $$;
  `);

  // Trigger for DELETE operations
  await sequelize.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_fare_calculations_prevent_delete'
      ) THEN
        CREATE TRIGGER trg_fare_calculations_prevent_delete
        BEFORE DELETE ON fare_calculations
        FOR EACH ROW
        EXECUTE FUNCTION raise_fare_immutability_violation();
      END IF;
    END
    $$;
  `);
};
