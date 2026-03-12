import { TaggedError } from "better-result";

/**
 * Severity levels for observability routing
 */
export type ErrorSeverity = "info" | "warn" | "error" | "critical";

/**
 * Base error props shared by all domain errors
 */
interface BaseErrorProps {
  readonly message: string;
  readonly retryable: boolean;
  readonly severity: ErrorSeverity;
  readonly [key: string]: unknown;
}

/**
 * VALIDATION ERRORS - Malformed input at API boundary
 */
export class ValidationError extends TaggedError("VALIDATION_ERROR")<
  BaseErrorProps & {
    readonly cause?: unknown;
  }
>() {
  constructor(message: string, cause?: unknown) {
    super({ message, retryable: false, severity: "info", cause });
  }
}

/**
 * NOT_FOUND - Resource does not exist
 */
export class NotFoundError extends TaggedError("NOT_FOUND")<
  BaseErrorProps & {
    readonly resourceType: string;
    readonly resourceId: string;
  }
>() {
  constructor(resourceType: string, resourceId: string) {
    super({
      message: `${resourceType} not found: ${resourceId}`,
      retryable: false,
      severity: "info",
      resourceType,
      resourceId,
    });
  }
}

/**
 * CONFLICT - State conflict (concurrent modification, illegal transition)
 */
export class ConflictError extends TaggedError("CONFLICT")<
  BaseErrorProps & {
    readonly currentState?: string;
    readonly attemptedAction?: string;
  }
>() {
  constructor(
    message: string,
    opts?: { currentState?: string; attemptedAction?: string }
  ) {
    super({
      message,
      retryable: false,
      severity: "warn",
      currentState: opts?.currentState,
      attemptedAction: opts?.attemptedAction,
    });
  }
}

/**
 * AUTHENTICATION_ERROR - Invalid or missing credentials
 */
export class AuthenticationError extends TaggedError(
  "AUTHENTICATION_ERROR"
)<BaseErrorProps>() {
  constructor(message = "Authentication required") {
    super({ message, retryable: false, severity: "info" });
  }
}

/**
 * AUTHORIZATION_ERROR - Insufficient permissions
 */
export class AuthorizationError extends TaggedError("AUTHORIZATION_ERROR")<
  BaseErrorProps & {
    readonly requiredScope?: string;
  }
>() {
  constructor(message = "Insufficient permissions", requiredScope?: string) {
    super({ message, retryable: false, severity: "warn", requiredScope });
  }
}

/**
 * INFRASTRUCTURE_ERROR - External system failures (database, network, providers)
 */
export class InfrastructureError extends TaggedError("INFRASTRUCTURE_ERROR")<
  BaseErrorProps & {
    readonly service?: string;
    readonly cause?: unknown;
  }
>() {
  constructor(
    message: string,
    opts?: { service?: string; cause?: unknown; retryable?: boolean }
  ) {
    super({
      message,
      retryable: opts?.retryable ?? true,
      severity: "error",
      service: opts?.service,
      cause: opts?.cause,
    });
  }
}

/**
 * POLICY_VIOLATION - Business rule violated
 */
export class PolicyViolationError extends TaggedError("POLICY_VIOLATION")<
  BaseErrorProps & {
    readonly policyScope: string;
    readonly policyName: string;
  }
>() {
  constructor(policyName: string, message: string) {
    super({
      message,
      retryable: false,
      severity: "warn",
      policyScope: policyName,
      policyName,
    });
  }
}

/**
 * UNEXPECTED_ERROR - Last resort for truly unexpected conditions
 */
export class UnexpectedError extends TaggedError("UNEXPECTED_ERROR")<
  BaseErrorProps & {
    readonly cause?: unknown;
  }
>() {
  constructor(message = "An unexpected error occurred", cause?: unknown) {
    super({ message, retryable: false, severity: "critical", cause });
  }
}

/**
 * Union type of all domain errors for exhaustive handling
 */
export type DomainError =
  | ValidationError
  | NotFoundError
  | ConflictError
  | AuthenticationError
  | AuthorizationError
  | InfrastructureError
  | PolicyViolationError
  | UnexpectedError;

/**
 * All possible error type tags
 */
export type DomainErrorType = DomainError["_tag"];
