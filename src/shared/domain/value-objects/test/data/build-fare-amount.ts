import { FareAmount, type FarePolicy } from "../../fare-amount.js";

type BuildFareAmountOptions = Partial<{
  rawAmount: number;
  minimumFareCOP: number;
}>;

/**
 * Factory for creating FareAmount test instances with meaningful defaults.
 *
 * Default: 6500 COP raw amount with 5000 COP minimum (Bogota standard)
 * This represents a typical short ride above minimum fare.
 */
export const buildFareAmount = (
  overrides?: BuildFareAmountOptions
): FareAmount => {
  const rawAmount = overrides?.rawAmount ?? 6500;
  const minimumFareCOP = overrides?.minimumFareCOP ?? 5000;

  const policy: FarePolicy = { minimumFareCOP };
  const result = FareAmount.create(rawAmount, policy);

  if (result.isErr()) {
    throw new Error(`buildFareAmount failed: ${result.error.message}`);
  }

  return result.value;
};
