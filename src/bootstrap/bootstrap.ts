import { buildApp } from "../app.js";
import {
  closeDatabase,
  connectDatabase,
} from "../shared/infrastructure/database/index.js";
import { getLogger } from "../shared/infrastructure/logging/index.js";
import {
  initOtel,
  shutdownOtel,
} from "../shared/infrastructure/observability/otel.js";

export const bootstrap = async () => {
  // 1. Global cross-cutting (must be first)
  initOtel();

  const logger = getLogger();

  // 2. Build inbound adapter (no side effects beyond plugin reg)
  const app = await buildApp();

  // 3. Start infra dependencies
  await connectDatabase();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutdown signal received");
    await app.close();
    await closeDatabase();
    await shutdownOtel();
    logger.info("Graceful shutdown complete");
  };

  return { app, logger, shutdown };
};
