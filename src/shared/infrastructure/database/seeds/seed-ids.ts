/**
 * Fixed seed IDs for deterministic dev/test data.
 *
 * Convention: seed_<entity>_<name>_<nnn>
 * These are visually distinguishable from runtime CUID2 IDs and easy to query/clean.
 */

// ── Tenant ──────────────────────────────────────────────────────────
export const SEED_TENANT_ID = "seed_tenant_bogota_001";

// ── Riders (referenced by rides, not stored in our tables) ──────────
export const SEED_RIDER_CAMILA = "seed_rider_camila_001";
export const SEED_RIDER_JUAN = "seed_rider_juan_002";
export const SEED_RIDER_VALENTINA = "seed_rider_valentina_003";

// ── Drivers ─────────────────────────────────────────────────────────
export const SEED_DRIVER_ANDRES = "seed_driver_andres_001";
export const SEED_DRIVER_SOFIA = "seed_driver_sofia_002";
export const SEED_DRIVER_JORGE = "seed_driver_jorge_003";
export const SEED_DRIVER_DIANA = "seed_driver_diana_004";

// ── Driver Locations ────────────────────────────────────────────────
export const SEED_LOC_ANDRES_1 = "seed_loc_andres_001";
export const SEED_LOC_ANDRES_2 = "seed_loc_andres_002";
export const SEED_LOC_ANDRES_3 = "seed_loc_andres_003";
export const SEED_LOC_SOFIA_1 = "seed_loc_sofia_001";
export const SEED_LOC_SOFIA_2 = "seed_loc_sofia_002";
export const SEED_LOC_SOFIA_3 = "seed_loc_sofia_003";
export const SEED_LOC_DIANA_1 = "seed_loc_diana_001";
export const SEED_LOC_DIANA_2 = "seed_loc_diana_002";
export const SEED_LOC_DIANA_3 = "seed_loc_diana_003";

// ── Rides ───────────────────────────────────────────────────────────
export const SEED_RIDE_COMPLETED = "seed_ride_completed_001";
export const SEED_RIDE_STARTED = "seed_ride_started_002";
export const SEED_RIDE_DISPATCHING = "seed_ride_dispatching_003";
export const SEED_RIDE_CANCELED = "seed_ride_canceled_004";
export const SEED_RIDE_EXPIRED = "seed_ride_expired_005";

// ── Ride Transitions (completed ride audit trail) ───────────────────
export const SEED_TRANSITION_CREATED = "seed_trans_created_001";
export const SEED_TRANSITION_DISPATCHING = "seed_trans_dispatching_002";
export const SEED_TRANSITION_ASSIGNED = "seed_trans_assigned_003";
export const SEED_TRANSITION_STARTED = "seed_trans_started_004";
// ── Fare Calculation ────────────────────────────────────────────────
export const SEED_FARE_COMPLETED = "seed_fare_completed_001";

// ── Payment Intent ──────────────────────────────────────────────────
export const SEED_PAYMENT_COMPLETED = "seed_payment_completed_001";

// ── Settlement Attempt ──────────────────────────────────────────────
export const SEED_SETTLEMENT_COMPLETED = "seed_settlement_completed_001";

// ── Dispatch Audits ─────────────────────────────────────────────────
export const SEED_DISPATCH_COMPLETED = "seed_dispatch_completed_001";
export const SEED_DISPATCH_DISPATCHING = "seed_dispatch_dispatching_002";

// ── Correlation IDs ─────────────────────────────────────────────────
export const SEED_CORRELATION_COMPLETED = "seed_corr_completed_001";
export const SEED_CORRELATION_DISPATCHING = "seed_corr_dispatching_002";
