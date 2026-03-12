/**
 * CI gate: proves seed idempotency, referential integrity, and invariant safety.
 *
 * Provisions Postgres via Testcontainers, runs migrations + seeds twice,
 * and asserts:
 * 1. Strict idempotency: second run produces identical DB state
 * 2. Referential integrity: all FK references resolve
 * 3. Domain invariants: no duplicate economic effects, valid state transitions
 * 4. Ledger consistency: seed_meta and seed_integrity tables populated
 */

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { Sequelize } from "sequelize";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "../../run-migrations.js";
import { runSeedEngine } from "../engine/seed-engine.js";

// ── DDL: create all seed-relevant tables ────────────────────────────
const SEED_DDL = `
  CREATE TABLE IF NOT EXISTS drivers (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    state VARCHAR NOT NULL,
    version INTEGER NOT NULL,
    current_location_latitude DECIMAL(10,7),
    current_location_longitude DECIMAL(10,7),
    current_location_accuracy_meters DECIMAL(8,2),
    current_location_bearing_degrees DECIMAL(6,2),
    current_location_speed_mps DECIMAL(8,2),
    current_location_recorded_at TIMESTAMPTZ,
    registered_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  );

  CREATE TABLE IF NOT EXISTS driver_locations (
    id VARCHAR PRIMARY KEY,
    driver_id VARCHAR NOT NULL REFERENCES drivers(id),
    tenant_id VARCHAR NOT NULL,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    accuracy_meters DECIMAL(8,2) NOT NULL,
    bearing_degrees DECIMAL(6,2) NOT NULL,
    speed_mps DECIMAL(8,2) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rides (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    rider_id VARCHAR NOT NULL,
    driver_id VARCHAR,
    state VARCHAR NOT NULL,
    version INTEGER NOT NULL,
    pickup_lat DECIMAL(10,7) NOT NULL,
    pickup_lng DECIMAL(10,7) NOT NULL,
    dropoff_lat DECIMAL(10,7) NOT NULL,
    dropoff_lng DECIMAL(10,7) NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ride_transitions (
    id VARCHAR PRIMARY KEY,
    ride_id VARCHAR NOT NULL REFERENCES rides(id),
    from_state VARCHAR NOT NULL,
    to_state VARCHAR NOT NULL,
    changed_by VARCHAR NOT NULL,
    changed_by_role VARCHAR NOT NULL,
    reason VARCHAR,
    correlation_id VARCHAR,
    created_at TIMESTAMPTZ NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fare_calculations (
    id VARCHAR PRIMARY KEY,
    ride_id VARCHAR NOT NULL UNIQUE,
    tenant_id VARCHAR NOT NULL,
    base_fare_cop INTEGER NOT NULL,
    distance_km DECIMAL(10,4) NOT NULL,
    duration_minutes DECIMAL(10,4) NOT NULL,
    distance_component_cop INTEGER NOT NULL,
    time_component_cop INTEGER NOT NULL,
    total_fare_cop INTEGER NOT NULL,
    minimum_applied BOOLEAN NOT NULL,
    pricing_version VARCHAR NOT NULL,
    calculated_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payment_intents (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    ride_id VARCHAR NOT NULL UNIQUE,
    rider_id VARCHAR NOT NULL,
    amount_cop INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    fare_base INTEGER NOT NULL,
    fare_distance_component INTEGER NOT NULL,
    fare_time_component INTEGER NOT NULL,
    fare_minimum_applied BOOLEAN NOT NULL,
    created_at_utc TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settlement_attempts (
    id VARCHAR PRIMARY KEY,
    payment_intent_id VARCHAR NOT NULL,
    tenant_id VARCHAR NOT NULL,
    attempt_number INTEGER NOT NULL CHECK (attempt_number BETWEEN 1 AND 3),
    idempotency_key VARCHAR NOT NULL,
    outcome VARCHAR NOT NULL,
    provider_ref VARCHAR,
    reason_code VARCHAR,
    initiated_at_utc TIMESTAMPTZ NOT NULL,
    completed_at_utc TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE (payment_intent_id, idempotency_key)
  );

  CREATE TABLE IF NOT EXISTS dispatch_audits (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    correlation_id VARCHAR NOT NULL,
    ride_id VARCHAR NOT NULL,
    selected_driver_id VARCHAR,
    candidates_json TEXT NOT NULL,
    candidates_count INTEGER NOT NULL,
    selection_criteria VARCHAR NOT NULL,
    search_radius_meters INTEGER NOT NULL,
    search_center_latitude DECIMAL(10,7) NOT NULL,
    search_center_longitude DECIMAL(10,7) NOT NULL,
    outcome VARCHAR NOT NULL,
    failure_code VARCHAR,
    dispatched_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE (tenant_id, correlation_id)
  );
`;

// ── Test helpers ────────────────────────────────────────────────────

interface TableSnapshot {
  [table: string]: Array<Record<string, unknown>>;
}

const SEED_TABLES = [
  "drivers",
  "driver_locations",
  "rides",
  "ride_transitions",
  "fare_calculations",
  "payment_intents",
  "settlement_attempts",
  "dispatch_audits",
] as const;

const captureSnapshot = async (
  sequelize: Sequelize
): Promise<TableSnapshot> => {
  const snapshot: TableSnapshot = {};
  for (const table of SEED_TABLES) {
    const [rows] = await sequelize.query(
      `SELECT * FROM "${table}" ORDER BY id`
    );
    snapshot[table] = rows as Array<Record<string, unknown>>;
  }
  return snapshot;
};

const countRows = async (
  sequelize: Sequelize,
  table: string
): Promise<number> => {
  const [rows] = await sequelize.query(
    `SELECT count(*)::int AS cnt FROM "${table}"`
  );
  const result = (rows as Array<{ cnt: number }>)[0];
  return result?.cnt ?? 0;
};

// ── Test suite ──────────────────────────────────────────────────────

describe("Seed idempotency and invariant safety", () => {
  let container: StartedPostgreSqlContainer;
  let sequelize: Sequelize;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase("mobility_seed_test")
      .withUsername("test")
      .withPassword("test")
      .start();

    sequelize = new Sequelize(container.getConnectionUri(), {
      dialect: "postgres",
      logging: false,
    });

    // Create tables via raw DDL
    for (const stmt of SEED_DDL.split(";").filter((s) => s.trim())) {
      await sequelize.query(stmt);
    }

    // Run constraint migrations (triggers, indexes)
    await runMigrations(sequelize);
  }, 120_000);

  afterAll(async () => {
    await sequelize?.close();
    await container?.stop();
  });

  // ── 1. First run: seeds apply successfully ──────────────────────
  it("should apply all seeds on first run", async () => {
    await runSeedEngine({ sequelize });

    expect(await countRows(sequelize, "drivers")).toBe(4);
    expect(await countRows(sequelize, "driver_locations")).toBe(9);
    expect(await countRows(sequelize, "rides")).toBe(5);
    expect(await countRows(sequelize, "ride_transitions")).toBe(4);
    expect(await countRows(sequelize, "fare_calculations")).toBe(1);
    expect(await countRows(sequelize, "payment_intents")).toBe(1);
    expect(await countRows(sequelize, "settlement_attempts")).toBe(1);
    expect(await countRows(sequelize, "dispatch_audits")).toBe(2);
  }, 30_000);

  // ── 2. Second run (replay): proves strict idempotency ───────────
  it("should produce identical state on replay (strict idempotency)", async () => {
    const before = await captureSnapshot(sequelize);

    await runSeedEngine({ sequelize, replay: true });

    const after = await captureSnapshot(sequelize);
    expect(after).toEqual(before);
  }, 30_000);

  // ── 3. Ledger tables populated ──────────────────────────────────
  it("should populate seed_meta ledger with execution metadata", async () => {
    const [rows] = await sequelize.query(
      `SELECT name, category, hash, duration_ms, rows_affected
       FROM seed_meta ORDER BY name`
    );
    const meta = rows as Array<{
      name: string;
      category: string;
      hash: string;
      duration_ms: number;
      rows_affected: number;
    }>;

    expect(meta).toHaveLength(2);

    const ref = meta.find((m) => m.name === "0001-reference-drivers");
    const fix = meta.find((m) => m.name === "0002-fixture-scenarios");

    expect(ref).toBeDefined();
    expect(ref!.category).toBe("reference");
    expect(ref!.hash).toHaveLength(64);
    expect(ref!.duration_ms).toBeGreaterThanOrEqual(0);
    expect(ref!.rows_affected).toBeGreaterThan(0);

    expect(fix).toBeDefined();
    expect(fix!.category).toBe("fixture");
  }, 10_000);

  // ── 4. Integrity hashes stored ──────────────────────────────────
  it("should store integrity hashes for drift detection", async () => {
    const [rows] = await sequelize.query(
      "SELECT name, hash FROM seed_integrity ORDER BY name"
    );
    const hashes = rows as Array<{ name: string; hash: string }>;

    expect(hashes).toHaveLength(2);
    for (const h of hashes) {
      expect(h.hash).toMatch(/^[a-f0-9]{64}$/);
    }
  }, 10_000);

  // ── 5. Verify-only mode does not mutate ─────────────────────────
  it("should verify hashes without mutation in verifyOnly mode", async () => {
    const before = await captureSnapshot(sequelize);
    await runSeedEngine({ sequelize, verifyOnly: true });
    const after = await captureSnapshot(sequelize);
    expect(after).toEqual(before);
  }, 10_000);

  // ── 6. Referential integrity ────────────────────────────────────
  describe("Referential integrity", () => {
    it("all ride driver_ids reference existing drivers", async () => {
      const [orphans] = await sequelize.query(`
        SELECT r.id FROM rides r
        LEFT JOIN drivers d ON r.driver_id = d.id
        WHERE r.driver_id IS NOT NULL AND d.id IS NULL
      `);
      expect(orphans).toHaveLength(0);
    });

    it("all driver_locations reference existing drivers", async () => {
      const [orphans] = await sequelize.query(`
        SELECT dl.id FROM driver_locations dl
        LEFT JOIN drivers d ON dl.driver_id = d.id
        WHERE d.id IS NULL
      `);
      expect(orphans).toHaveLength(0);
    });

    it("all ride_transitions reference existing rides", async () => {
      const [orphans] = await sequelize.query(`
        SELECT rt.id FROM ride_transitions rt
        LEFT JOIN rides r ON rt.ride_id = r.id
        WHERE r.id IS NULL
      `);
      expect(orphans).toHaveLength(0);
    });

    it("all fare_calculations reference existing rides", async () => {
      const [orphans] = await sequelize.query(`
        SELECT fc.id FROM fare_calculations fc
        LEFT JOIN rides r ON fc.ride_id = r.id
        WHERE r.id IS NULL
      `);
      expect(orphans).toHaveLength(0);
    });

    it("all payment_intents reference existing rides", async () => {
      const [orphans] = await sequelize.query(`
        SELECT pi.id FROM payment_intents pi
        LEFT JOIN rides r ON pi.ride_id = r.id
        WHERE r.id IS NULL
      `);
      expect(orphans).toHaveLength(0);
    });
  });

  // ── 7. Domain invariant preservation ────────────────────────────
  describe("Domain invariants", () => {
    it("no duplicate fares per ride (one fare per ride)", async () => {
      const [dups] = await sequelize.query(`
        SELECT ride_id, count(*)::int AS cnt
        FROM fare_calculations
        GROUP BY ride_id
        HAVING count(*) > 1
      `);
      expect(dups).toHaveLength(0);
    });

    it("no duplicate payment intents per ride", async () => {
      const [dups] = await sequelize.query(`
        SELECT ride_id, count(*)::int AS cnt
        FROM payment_intents
        GROUP BY ride_id
        HAVING count(*) > 1
      `);
      expect(dups).toHaveLength(0);
    });

    it("at most one SUCCEEDED settlement per payment intent", async () => {
      const [dups] = await sequelize.query(`
        SELECT payment_intent_id, count(*)::int AS cnt
        FROM settlement_attempts
        WHERE outcome = 'SUCCEEDED'
        GROUP BY payment_intent_id
        HAVING count(*) > 1
      `);
      expect(dups).toHaveLength(0);
    });

    it("no duplicate dispatch correlation per tenant", async () => {
      const [dups] = await sequelize.query(`
        SELECT tenant_id, correlation_id, count(*)::int AS cnt
        FROM dispatch_audits
        GROUP BY tenant_id, correlation_id
        HAVING count(*) > 1
      `);
      expect(dups).toHaveLength(0);
    });

    it("ride transitions form valid state chains", async () => {
      // For each ride, transitions ordered by created_at should chain:
      // transition[n].to_state === transition[n+1].from_state
      const [transitions] = await sequelize.query(`
        SELECT ride_id, from_state, to_state
        FROM ride_transitions
        ORDER BY ride_id, created_at
      `);
      const grouped = new Map<
        string,
        Array<{ from_state: string; to_state: string }>
      >();
      for (const t of transitions as Array<{
        ride_id: string;
        from_state: string;
        to_state: string;
      }>) {
        const list = grouped.get(t.ride_id) ?? [];
        list.push({ from_state: t.from_state, to_state: t.to_state });
        grouped.set(t.ride_id, list);
      }

      for (const [rideId, chain] of grouped) {
        for (let i = 0; i < chain.length - 1; i++) {
          const current = chain[i]!;
          const next = chain[i + 1]!;
          expect(
            current.to_state,
            `Broken chain for ride ${rideId} at transition ${i}`
          ).toBe(next.from_state);
        }
      }
    });

    it("fare amount equals sum of components", async () => {
      const [rows] = await sequelize.query(`
        SELECT id, base_fare_cop, distance_component_cop, time_component_cop, total_fare_cop
        FROM fare_calculations
      `);
      for (const row of rows as Array<{
        id: string;
        base_fare_cop: number;
        distance_component_cop: number;
        time_component_cop: number;
        total_fare_cop: number;
      }>) {
        const sum =
          row.base_fare_cop +
          row.distance_component_cop +
          row.time_component_cop;
        expect(
          row.total_fare_cop,
          `Fare ${row.id}: ${row.total_fare_cop} !== ${sum}`
        ).toBe(sum);
      }
    });

    it("payment amount matches fare total", async () => {
      const [rows] = await sequelize.query(`
        SELECT pi.id, pi.amount_cop, fc.total_fare_cop
        FROM payment_intents pi
        JOIN fare_calculations fc ON pi.ride_id = fc.ride_id
      `);
      for (const row of rows as Array<{
        id: string;
        amount_cop: number;
        total_fare_cop: number;
      }>) {
        expect(row.amount_cop, `Payment ${row.id} amount mismatch`).toBe(
          row.total_fare_cop
        );
      }
    });
  });

  // ── 8. Production guard ─────────────────────────────────────────
  it("should block execution in production without override", async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    delete process.env.SEED_ALLOW_PRODUCTION;

    await expect(runSeedEngine({ sequelize })).rejects.toThrow(
      "Seed execution blocked in production"
    );

    process.env.NODE_ENV = original;
  });
});
