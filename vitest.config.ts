import "dotenv/config";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Test file patterns
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["node_modules", "dist"],

    // Environment
    environment: "node",

    // Global setup/teardown for Testcontainers
    globalSetup: "./src/test/setup.ts",

    // Timeout for integration tests (Testcontainers needs time to start)
    testTimeout: 30_000,
    hookTimeout: 60_000,

    // Run tests sequentially for database isolation
    // Can be changed to parallel with proper isolation
    pool: "forks",
    sequence: {
      concurrent: false, // Run tests sequentially
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
