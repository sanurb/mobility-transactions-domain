/**
 * Schema bootstrapper for standalone seed execution.
 *
 * When the seed CLI runs outside the app process, tables don't exist yet.
 * This module initializes all Sequelize models and calls sync() to create
 * tables with IF NOT EXISTS semantics. Then runs constraint migrations.
 *
 * Safe to call multiple times (idempotent DDL).
 */

import type { Sequelize } from "sequelize";
import { initDispatchAuditModel } from "../../../../../modules/dispatch/infrastructure/persistence/dispatch-audit.model.js";
import { initDriverModels } from "../../../../../modules/drivers/adapters/outbound/index.js";
import { initFareCalculationModel } from "../../../../../modules/fares/infrastructure/index.js";
import {
  initOutboxModel,
  initPaymentIntentModel,
  initSettlementAttemptModel,
} from "../../../../../modules/payments/infrastructure/index.js";
import { initRideModels } from "../../../../../modules/rides/infrastructure/index.js";
import { runMigrations } from "../../run-migrations.js";

/**
 * Ensure all seed-relevant tables exist.
 *
 * 1. Register all Sequelize models (Model.init)
 * 2. Sync schema (CREATE TABLE IF NOT EXISTS)
 * 3. Run constraint migrations (indexes, triggers, CHECK constraints)
 */
export const ensureSchema = async (sequelize: Sequelize): Promise<void> => {
  // 1. Initialize all models (registers them with the Sequelize instance)
  initRideModels(sequelize);
  initDriverModels(sequelize);
  initDispatchAuditModel(sequelize);
  initFareCalculationModel(sequelize);
  initPaymentIntentModel(sequelize);
  initSettlementAttemptModel(sequelize);
  initOutboxModel(sequelize);

  // 2. Create tables that don't exist yet (idempotent)
  await sequelize.sync();

  // 3. Apply constraint migrations (IF NOT EXISTS guards)
  await runMigrations(sequelize);
};
