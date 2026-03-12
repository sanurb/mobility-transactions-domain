import { MoneyCOP } from "../../money-cop.js";

type BuildMoneyCOPOptions = Partial<{
  amount: number;
}>;

/**
 * Factory for creating MoneyCOP test instances with meaningful defaults.
 *
 * Default: 5000 COP (minimum fare amount from PRD)
 */
export const buildMoneyCOP = (overrides?: BuildMoneyCOPOptions): MoneyCOP => {
  const amount = overrides?.amount ?? 5000;
  const result = MoneyCOP.create(amount);

  if (result.isErr()) {
    throw new Error(`buildMoneyCOP failed: ${result.error.message}`);
  }

  return result.value;
};
