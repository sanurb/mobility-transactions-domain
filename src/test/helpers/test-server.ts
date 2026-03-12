/**
 * @fileoverview
 * Test server lifecycle and HTTP injection helpers.
 * Responsibility: single shared Fastify instance for integration/E2E tests; authenticated inject helpers.
 * Boundaries: does not contain assertions; used by test files only.
 */

import type { InjectOptions } from "fastify";
import { buildApp } from "../../app.js";
import { createAuthHeader, type TestUserType } from "./test-auth.js";
import { initTestDb } from "./test-db.js";

/** App type matches buildApp() so ZodTypeProvider and custom logger types are preserved. */
type TestApp = Awaited<ReturnType<typeof buildApp>>;

let testApp: TestApp | null = null;

/**
 * Get or create a test server instance.
 * Reuses the same instance across tests for efficiency.
 * Creates all tables via sync({ force: true }) once on first call.
 */
export const getTestServer = async (): Promise<TestApp> => {
  if (testApp) {
    return testApp;
  }
  const app = await buildApp();
  await app.ready();
  await initTestDb();
  testApp = app;
  return app;
};

/**
 * Close the test server
 * Call in afterAll() if needed
 */
export const closeTestServer = async (): Promise<void> => {
  if (testApp) {
    await testApp.close();
    testApp = null;
  }
  // Also close the shared sequelize instance to prevent hanging handles
  try {
    const { closeDatabase } = await import(
      "../../shared/infrastructure/database/index.js"
    );
    await closeDatabase();
  } catch {
    // Ignore if already closed
  }
};

/** Options for injectRequest. */
export type InjectRequestOptions = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  payload?: unknown;
  headers?: Record<string, string>;
  auth?: TestUserType | false;
};

/**
 * Make an authenticated request to the test server.
 */
export const injectRequest = async (
  options: InjectRequestOptions
): Promise<Awaited<ReturnType<TestApp["inject"]>>> => {
  const app = await getTestServer();
  const headers: Record<string, string> = {
    "content-type": "application/vnd.api+json",
    ...options.headers,
  };
  if (options.auth !== false && !headers.authorization) {
    headers.authorization = await createAuthHeader(options.auth ?? "rider");
  }
  return app.inject({
    method: options.method,
    url: options.url,
    payload: options.payload as InjectOptions["payload"],
    headers,
  });
};

/**
 * Shorthand for GET requests
 */
export const get = (url: string, options?: { auth?: TestUserType | false }) =>
  injectRequest({ method: "GET", url, ...options });

/**
 * Shorthand for POST requests
 */
export const post = (
  url: string,
  payload: unknown,
  options?: { auth?: TestUserType | false }
) => injectRequest({ method: "POST", url, payload, ...options });

/**
 * Shorthand for PUT requests
 */
export const put = (
  url: string,
  payload: unknown,
  options?: { auth?: TestUserType | false }
) => injectRequest({ method: "PUT", url, payload, ...options });

/**
 * Shorthand for DELETE requests
 */
export const del = (url: string, options?: { auth?: TestUserType | false }) =>
  injectRequest({ method: "DELETE", url, ...options });
