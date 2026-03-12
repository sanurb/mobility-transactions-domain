/**
 * Brand utility type for creating nominal types.
 *
 * A branded type is structurally identical to its underlying type but
 * treated as distinct by TypeScript's type system. This prevents accidental
 * mixing of conceptually different values (e.g., RideId vs PaymentIntentId).
 */
declare const __brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

/**
 * Configuration for branded ID validation
 */
const ID_MIN_LENGTH = 1;
const ID_MAX_LENGTH = 128;

/**
 * Create a branded ID with validation.
 *
 * @param value - The string value to brand
 * @returns A branded ID
 * @throws {Error} If validation fails
 */
export const createBrandedId = <B extends string>(
  value: string
): Brand<string, B> => {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error("ID must not be empty");
  }

  if (trimmed.length < ID_MIN_LENGTH || trimmed.length > ID_MAX_LENGTH) {
    throw new Error(
      `ID length must be between ${ID_MIN_LENGTH} and ${ID_MAX_LENGTH} characters`
    );
  }

  return trimmed as Brand<string, B>;
};

/**
 * Safe parse a value into a branded ID.
 *
 * @param value - The value to parse
 * @returns The branded ID if valid, null otherwise
 */
export const parseBrandedId = <B extends string>(
  value: unknown
): Brand<string, B> | null => {
  if (typeof value !== "string") {
    return null;
  }

  try {
    return createBrandedId<B>(value);
  } catch {
    return null;
  }
};

/**
 * Create a branded ID without validation.
 *
 * ONLY use this for trusted rehydration scenarios (e.g., reading from database).
 * This bypasses all validation and assumes the value is already valid.
 *
 * @param value - The string value to brand
 * @returns A branded ID
 */
export const unsafeBrandedId = <B extends string>(
  value: string
): Brand<string, B> => {
  return value as Brand<string, B>;
};
