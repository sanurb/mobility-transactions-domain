import { Result } from "better-result";
import type { DomainError } from "../errors/error-types.js";

// Re-export better-result core
export { Result };

/**
 * Create a success Result
 */
export const ok = <T>(value: T): Result<T, never> => Result.ok(value);

/**
 * Create a failure Result
 */
export const err = <E>(error: E): Result<never, E> => Result.err(error);

/**
 * Check if a Result is a success
 */
export const isOk = <T, E>(
  result: Result<T, E>
): result is Result<T, never> & { value: T } => result.isOk();

/**
 * Check if a Result is a failure
 */
export const isErr = <T, E>(
  result: Result<T, E>
): result is Result<never, E> & { error: E } => result.isErr();

/**
 * Standard Result type for domain operations
 * T = success value type
 * E = error type (defaults to DomainError)
 */
export type DomainResult<T, E extends DomainError = DomainError> = Result<T, E>;

/**
 * Async Result type for operations that return promises
 */
export type AsyncDomainResult<T, E extends DomainError = DomainError> = Promise<
  DomainResult<T, E>
>;

/**
 * Unwrap a Result, throwing if it's an error
 * Use sparingly - prefer pattern matching with isOk/isErr
 */
export const unwrap = <T, E>(result: Result<T, E>): T => {
  if (result.isErr()) {
    throw result.error;
  }
  return result.value;
};

/**
 * Unwrap a Result with a default value for errors
 */
export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T => {
  if (result.isErr()) {
    return defaultValue;
  }
  return result.value;
};

/**
 * Map over a successful Result
 */
export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> => {
  if (result.isErr()) {
    return result as unknown as Result<U, E>;
  }
  return Result.ok(fn(result.value));
};

/**
 * Map over a failed Result's error
 */
export const mapErr = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> => {
  if (result.isOk()) {
    return result as unknown as Result<T, F>;
  }
  return Result.err(fn(result.error));
};

/**
 * Flat map (chain) Results
 */
export const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> => {
  if (result.isErr()) {
    return result as unknown as Result<U, E>;
  }
  return fn(result.value);
};

/**
 * Combine multiple Results into a single Result
 * Returns first error encountered, or array of all values
 */
export const combineResults = <T, E>(
  results: Result<T, E>[]
): Result<T[], E> => {
  const values: T[] = [];
  for (const result of results) {
    if (result.isErr()) {
      return result as unknown as Result<T[], E>;
    }
    values.push(result.value);
  }
  return Result.ok(values);
};

/**
 * Try to execute a function, returning a Result
 * Use for wrapping operations that might throw
 */
export const tryCatch = <T, E extends DomainError>(
  fn: () => T,
  onError: (error: unknown) => E
): Result<T, E> => {
  try {
    return Result.ok(fn());
  } catch (error) {
    return Result.err(onError(error));
  }
};

/**
 * Async version of tryCatch
 */
export const tryCatchAsync = async <T, E extends DomainError>(
  fn: () => Promise<T>,
  onError: (error: unknown) => E
): Promise<Result<T, E>> => {
  try {
    return Result.ok(await fn());
  } catch (error) {
    return Result.err(onError(error));
  }
};
