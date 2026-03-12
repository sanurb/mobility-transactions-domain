/**
 * Production execution guard.
 *
 * Blocks seed execution in production unless SEED_ALLOW_PRODUCTION=true is
 * explicitly set. Logs an auditable warning when the override is active.
 */

export const assertNotProduction = (): void => {
  const env = process.env.NODE_ENV ?? "development";
  const allow = process.env.SEED_ALLOW_PRODUCTION;

  if (env === "production" && allow !== "true") {
    throw new Error(
      "Seed execution blocked in production. " +
        "Set SEED_ALLOW_PRODUCTION=true to override (requires audit justification)."
    );
  }

  if (env === "production" && allow === "true") {
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "warn",
        component: "seed-engine",
        event: "production_override",
        message:
          "Seed execution allowed in production via SEED_ALLOW_PRODUCTION flag",
      })
    );
  }
};
