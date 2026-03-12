import "dotenv/config";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Vitest config for pure unit tests (no database, no testcontainers)
 * Used for domain logic, pure functions, utilities
 */
export default defineConfig({
  test: {
    // Test file patterns
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: [
      "node_modules",
      "dist",
      "**/*.integration.test.ts",
      "src/tests/integration/**",
      "src/modules/health/health.controller.test.ts",
      "src/**/tests/adapters/*contract.test.ts",
    ],

    // Environment
    environment: "node",

    // No global setup for unit tests
    // globalSetup is omitted intentionally

    // Fast timeout for unit tests
    testTimeout: 5000,
    hookTimeout: 5000,

    // Can run in parallel for unit tests
    pool: "forks",
    sequence: {
      concurrent: true,
    },

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "src/test/**",
        "**/*.test.ts",
        "**/*.spec.ts",
      ],
    },
  },

  // Path resolution (match tsconfig)
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },

  // ESBuild for TypeScript
  esbuild: {
    target: "node20",
  },
});
