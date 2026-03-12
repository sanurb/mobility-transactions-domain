import { IdempotencyKey } from "../../idempotency-key.js";

type BuildIdempotencyKeyOptions = Partial<{
  raw: string;
}>;

/**
 * Factory for creating IdempotencyKey test instances with meaningful defaults.
 *
 * Default: "test-idempotency-key-123" (realistic format: prefix-descriptor-nonce)
 */
export const buildIdempotencyKey = (
  overrides?: BuildIdempotencyKeyOptions
): IdempotencyKey => {
  const raw = overrides?.raw ?? "test-idempotency-key-123";
  const result = IdempotencyKey.create(raw);

  if (result.isErr()) {
    throw new Error(`buildIdempotencyKey failed: ${result.error.message}`);
  }

  return result.value;
};
