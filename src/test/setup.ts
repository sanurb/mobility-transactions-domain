import { startTestDatabase, stopTestDatabase } from "./helpers/test-db.js";

/**
 * Global setup - runs once before all tests
 * Starts Testcontainers PostgreSQL
 */
export const setup = async (): Promise<void> => {
  console.log("[Setup] Starting test environment...");

  // Set test environment
  process.env.NODE_ENV = "test";

  // Set required env vars for app
  process.env.JWT_SECRET =
    "test-jwt-secret-that-is-at-least-32-characters-long";
  process.env.JWT_ISSUER = "mobility-test";
  process.env.JWT_AUDIENCE = "mobility-test-api";
  process.env.LOG_LEVEL = "warn"; // Quiet during tests
  process.env.LOG_PRETTY = "false";
  process.env.BETTER_AUTH_SECRET = "e2e-better-auth-secret-at-least-32-chars!!";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";

  // Start database
  await startTestDatabase();

  console.log("[Setup] Test environment ready");
};

/**
 * Global teardown - runs once after all tests
 * Stops Testcontainers PostgreSQL
 */
export const teardown = async (): Promise<void> => {
  console.log("[Teardown] Cleaning up test environment...");
  // Close the test server first (app + shared sequelize)
  try {
    const { closeTestServer } = await import("./helpers/test-server.js");
    await closeTestServer();
  } catch {
    // Ignore if not initialized
  }
  await stopTestDatabase();
  console.log("[Teardown] Test environment cleaned up");
};

export default setup;
