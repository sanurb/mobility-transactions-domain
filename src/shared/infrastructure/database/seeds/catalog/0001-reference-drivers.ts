/**
 * Reference seed: Drivers and their location history.
 *
 * Category: reference (stable master data, rarely changes).
 *
 * Drivers are mutable aggregates → full UPSERT on (id).
 * Driver locations are append-only → INSERT ... ON CONFLICT (id) DO NOTHING.
 */

import { upsertRows } from "../engine/seed-upsert.js";
import type { SeedMigration } from "../engine/types.js";
import { SEED_DRIVER_LOCATIONS, SEED_DRIVERS } from "../seed-data.js";

export const referenceSeed: SeedMigration = {
  name: "0001-reference-drivers",
  category: "reference",

  data: () => ({
    drivers: SEED_DRIVERS,
    driverLocations: SEED_DRIVER_LOCATIONS,
  }),

  async up(ctx) {
    let rows = 0;
    rows += await upsertRows(ctx, "drivers", SEED_DRIVERS, "(id)", true);
    rows += await upsertRows(
      ctx,
      "driver_locations",
      SEED_DRIVER_LOCATIONS,
      "(id)",
      false
    );
    return rows;
  },
};
