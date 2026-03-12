/**
 * @fileoverview Process composition root.
 * Responsible only for:
 * - loading environment
 * - bootstrapping server
 * - handling fatal errors
 */

import "dotenv/config";
import { startServer } from "./server.js";

startServer().catch(() => {
  process.exit(1);
});
