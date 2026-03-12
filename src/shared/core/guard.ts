import { Result, TaggedError } from "better-result";

export class GuardError extends TaggedError("GuardError")<{
  argumentName?: string;
  reason: string;
  message: string;
}>() {
  constructor(args: { argumentName?: string; reason: string }) {
    super({ ...args, message: args.reason });
  }
}

export type GuardArgument<T> = {
  argument: T;
  argumentName: string;
};

export type GuardArgumentCollection<T> = readonly GuardArgument<T>[];

export function combine(
  guardResults: readonly Result<void, GuardError>[]
): Result<void, GuardError> {
  for (const result of guardResults) {
    if (result.isErr()) {
      return result;
    }
  }
  return Result.ok(undefined);
}

export function greaterThan(
  minValue: number,
  actualValue: number
): Result<void, GuardError> {
  return actualValue > minValue
    ? Result.ok(undefined)
    : Result.err(
        new GuardError({
          reason: `Number given {${actualValue}} is not greater than {${minValue}}`,
        })
      );
}

export function againstAtLeast(
  numChars: number,
  text: string
): Result<void, GuardError> {
  return text.length >= numChars
    ? Result.ok(undefined)
    : Result.err(
        new GuardError({ reason: `Text is not at least ${numChars} chars.` })
      );
}

export function againstAtMost(
  numChars: number,
  text: string
): Result<void, GuardError> {
  return text.length <= numChars
    ? Result.ok(undefined)
    : Result.err(
        new GuardError({ reason: `Text is greater than ${numChars} chars.` })
      );
}

export function againstNullOrUndefined<T>(
  argument: T,
  argumentName: string
): Result<void, GuardError> {
  if (argument === null || argument === undefined) {
    return Result.err(
      new GuardError({
        argumentName,
        reason: `${argumentName} is null or undefined`,
      })
    );
  }
  return Result.ok(undefined);
}

export function againstNullOrUndefinedBulk<T>(
  args: GuardArgumentCollection<T>
): Result<void, GuardError> {
  for (const arg of args) {
    const result = againstNullOrUndefined(arg.argument, arg.argumentName);
    if (result.isErr()) {
      return result;
    }
  }
  return Result.ok(undefined);
}

export function isOneOf<T>(
  value: T,
  validValues: readonly T[],
  argumentName: string
): Result<void, GuardError> {
  const isValid = validValues.includes(value);
  if (isValid) {
    return Result.ok(undefined);
  }
  return Result.err(
    new GuardError({
      argumentName,
      reason: `${argumentName} isn't oneOf the correct values in ${JSON.stringify(validValues)}. Got "${value}".`,
    })
  );
}

export function inRange(
  num: number,
  min: number,
  max: number,
  argumentName: string
): Result<void, GuardError> {
  const isInRange = num >= min && num <= max;
  if (!isInRange) {
    return Result.err(
      new GuardError({
        argumentName,
        reason: `${argumentName} is not within range ${min} to ${max}.`,
      })
    );
  }
  return Result.ok(undefined);
}

export function allInRange(
  numbers: readonly number[],
  min: number,
  max: number,
  argumentName: string
): Result<void, GuardError> {
  for (const num of numbers) {
    const numIsInRangeResult = inRange(num, min, max, argumentName);
    if (numIsInRangeResult.isErr()) {
      return Result.err(
        new GuardError({
          argumentName,
          reason: `${argumentName} is not within the range.`,
        })
      );
    }
  }
  return Result.ok(undefined);
}
