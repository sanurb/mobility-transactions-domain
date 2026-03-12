import { PricingVersion } from "../../pricing-version.js";

type BuildPricingVersionOptions = Partial<{
  value: string;
}>;

/**
 * Factory for creating PricingVersion test instances with meaningful defaults.
 *
 * Default: v1.0.0 (initial pricing algorithm version)
 */
export const buildPricingVersion = (
  overrides?: BuildPricingVersionOptions
): PricingVersion => {
  const value = overrides?.value ?? "v1.0.0";
  const result = PricingVersion.create(value);

  if (result.isErr()) {
    throw new Error(`buildPricingVersion failed: ${result.error.message}`);
  }

  return result.value;
};
