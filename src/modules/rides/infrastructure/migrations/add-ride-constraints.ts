/**
 * Ride constraints migration.
 *
 * Enforces core ride invariants at database level:
 * - Valid ride state values (enum check constraint)
 * - Non-null ride version for optimistic locking
 * - Ride transitions are immutable (trigger rejects UPDATE/DELETE)
 *
 * All constraints use IF NOT EXISTS guards for idempotency.
 * All operations are additive-only (no drops/renames).
 */

import type { Sequelize } from "sequelize";

/**
 * Add ride-related database constraints.
 *
 * Idempotent: safe to run multiple times via IF NOT EXISTS guards.
 * Additive-only: never drops or renames existing structures.
 *
 * @param sequelize - Sequelize instance with active connection
 */
export const addRideConstraints = async (
  sequelize: Sequelize
): Promise<void> => {
  // State enum check constraint
  await sequelize.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_rides_state'
      ) THEN
        ALTER TABLE rides
        ADD CONSTRAINT chk_rides_state
        CHECK (state IN (
          'CREATED',
          'DISPATCHING',
          'ASSIGNED',
          'STARTED',
          'COMPLETED',
          'CANCELED',
          'EXPIRED',
          'FAILED'
        ))
        NOT VALID;
      END IF;
    END
    $$;
  `);

  // Validate constraint
  await sequelize.query(`
    ALTER TABLE rides
    VALIDATE CONSTRAINT chk_rides_state;
  `);

  // Ensure ride.version is NOT NULL (safe additive approach)
  await sequelize.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_rides_version_not_null'
      ) THEN
        ALTER TABLE rides
        ADD CONSTRAINT chk_rides_version_not_null
        CHECK (version IS NOT NULL)
        NOT VALID;
      END IF;
    END
    $$;
  `);

  // Validate version constraint
  await sequelize.query(`
    ALTER TABLE rides
    VALIDATE CONSTRAINT chk_rides_version_not_null;
  `);

  // Ride transitions immutability trigger function
  await sequelize.query(`
    CREATE OR REPLACE FUNCTION raise_ride_transitions_immutability_violation()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Ride transitions are immutable';
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Trigger for UPDATE operations on ride_transitions
  await sequelize.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_ride_transitions_prevent_update'
      ) THEN
        CREATE TRIGGER trg_ride_transitions_prevent_update
        BEFORE UPDATE ON ride_transitions
        FOR EACH ROW
        EXECUTE FUNCTION raise_ride_transitions_immutability_violation();
      END IF;
    END
    $$;
  `);

  // Trigger for DELETE operations on ride_transitions
  await sequelize.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_ride_transitions_prevent_delete'
      ) THEN
        CREATE TRIGGER trg_ride_transitions_prevent_delete
        BEFORE DELETE ON ride_transitions
        FOR EACH ROW
        EXECUTE FUNCTION raise_ride_transitions_immutability_violation();
      END IF;
    END
    $$;
  `);
};
