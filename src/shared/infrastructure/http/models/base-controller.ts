/**
 * Composable HTTP response helpers for Fastify.
 *
 * Integrates with domain Result types and http-error-mapper. Use these from
 * route handlers instead of a base controller class. No magic literals;
 * uses HTTP_STATUS and MIME_TYPES constants.
 */

import type { FastifyReply } from "fastify";
import { HTTP_STATUS } from "../../../core/constants/http_status.js";
import { MIME_TYPES } from "../../../core/constants/mime_types.js";
import type { Result } from "../../../core/result.js";
import type { DomainError } from "../../../errors/error-types.js";
import {
  type ApiErrorResponse,
  createErrorResponse,
  mapDomainErrorToHttpStatus,
} from "../../../errors/http-error-mapper.js";

/** Content-Type for JSON API responses with UTF-8 charset. */
const CONTENT_TYPE_JSON_UTF8 = `${MIME_TYPES.json}; charset=utf-8`;

/** Default message for unhandled server errors (no internal details). */
const DEFAULT_SERVER_ERROR_MESSAGE = "An unexpected error occurred.";

/**
 * Sends a success response with optional JSON body.
 * Uses HTTP_STATUS and CONTENT_TYPE_JSON_UTF8.
 */
export const sendSuccess = <T>(
  reply: FastifyReply,
  statusCode: number,
  body?: T
): void => {
  if (body !== undefined) {
    reply.code(statusCode).type(CONTENT_TYPE_JSON_UTF8).send(body);
    return;
  }
  reply.code(statusCode).send();
};

/**
 * Sends a domain error response using the centralized mapper.
 * Status and body come from mapDomainErrorToHttpStatus and createErrorResponse.
 */
export const sendError = (
  reply: FastifyReply,
  error: DomainError,
  requestId: string
): void => {
  const statusCode = mapDomainErrorToHttpStatus(error);
  const body = createErrorResponse(error, requestId);
  reply.code(statusCode).type(CONTENT_TYPE_JSON_UTF8).send(body);
};

export type SendDomainResultOptions<T> = {
  /** HTTP status for success (default 200). */
  successStatus?: number;
  /** Optional serializer for the success value (e.g. mapRideToResponse). */
  serialize?: (value: T) => unknown;
};

/**
 * Pattern-matches on a Domain Result: on error sends the mapped error response,
 * on success sends the value (optionally serialized) with the given status.
 * Eliminates repetitive if (result.isErr()) { ... } return reply.send(...) in handlers.
 */
export const sendDomainResult = <T>(
  reply: FastifyReply,
  result: Result<T, DomainError>,
  requestId: string,
  options: SendDomainResultOptions<T> = {}
): void => {
  if (result.isErr()) {
    sendError(reply, result.error, requestId);
    return;
  }
  const status = options.successStatus ?? HTTP_STATUS.success.ok;
  const body =
    options.serialize !== undefined
      ? options.serialize(result.value)
      : result.value;
  sendSuccess(reply, status, body);
};

/**
 * Sends a 500 response for unhandled errors.
 * Returns deterministic ApiErrorResponse shape without exposing raw error messages.
 *
 * SECURITY CONTRACT (SEC-03):
 * - Never includes raw error messages (may contain provider errors with sensitive data)
 * - Never includes stack traces or internal details
 * - Returns generic message only
 */
export const sendFail = (
  reply: FastifyReply,
  _error: unknown,
  requestId?: string
): void => {
  const body: ApiErrorResponse = {
    errorType: "UNEXPECTED_ERROR" as const,
    message: "An unexpected error occurred",
    retryable: false,
    requestId: requestId ?? "unknown",
  };
  reply
    .code(HTTP_STATUS.serverError.internalServerError)
    .type(CONTENT_TYPE_JSON_UTF8)
    .send(body);
};
