/**
 * JSON:API Helpers
 *
 * Utilities for building JSON:API compliant documents, resources, and errors.
 * Enforces strict content-type rules and maps domain errors to JSON:API error format.
 *
 * Reference: https://jsonapi.org/format/
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import type { DomainError } from "../../../errors/error-types.js";
import { mapDomainErrorToHttpStatus } from "../../../errors/http-error-mapper.js";

/**
 * JSON:API content type constant
 */
export const APPLICATION_VND_API_JSON = "application/vnd.api+json";

// ============================================
// JSON:API Type Definitions
// ============================================

/**
 * JSON:API Resource Object
 */
export interface JsonApiResource {
  type: string;
  id: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  links?: Record<string, string>;
}

/**
 * JSON:API Error Object
 */
export interface JsonApiError {
  status: string;
  title: string;
  detail: string;
  source?: {
    pointer?: string;
    parameter?: string;
  };
  meta?: Record<string, unknown>;
}

/**
 * JSON:API Document (single resource)
 */
export interface JsonApiDocumentSingle {
  data: JsonApiResource;
  meta?: Record<string, unknown>;
  links?: Record<string, string>;
}

/**
 * JSON:API Document (collection)
 */
export interface JsonApiDocumentCollection {
  data: JsonApiResource[];
  meta?: Record<string, unknown>;
  links?: Record<string, string>;
}

/**
 * JSON:API Error Document
 */
export interface JsonApiErrorDocument {
  errors: JsonApiError[];
}

// ============================================
// Document Builders
// ============================================

/**
 * Build a JSON:API resource object
 */
export const buildResource = (params: {
  type: string;
  id: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  links?: Record<string, string>;
}): JsonApiResource => {
  const resource: JsonApiResource = {
    type: params.type,
    id: params.id,
  };

  if (params.attributes) {
    resource.attributes = params.attributes;
  }

  if (params.relationships) {
    resource.relationships = params.relationships;
  }

  if (params.meta) {
    resource.meta = params.meta;
  }

  if (params.links) {
    resource.links = params.links;
  }

  return resource;
};

/**
 * Build a JSON:API document for a single resource
 */
export const buildDocumentSingle = (
  resource: JsonApiResource,
  meta?: Record<string, unknown>,
  links?: Record<string, string>
): JsonApiDocumentSingle => {
  const doc: JsonApiDocumentSingle = { data: resource };

  if (meta) {
    doc.meta = meta;
  }

  if (links) {
    doc.links = links;
  }

  return doc;
};

/**
 * Build a JSON:API document for a collection of resources
 */
export const buildDocumentCollection = (
  resources: JsonApiResource[],
  meta?: Record<string, unknown>,
  links?: Record<string, string>
): JsonApiDocumentCollection => {
  const doc: JsonApiDocumentCollection = { data: resources };

  if (meta) {
    doc.meta = meta;
  }

  if (links) {
    doc.links = links;
  }

  return doc;
};

/**
 * Build a JSON:API error object
 */
export const buildError = (params: {
  status: string;
  title: string;
  detail: string;
  source?: {
    pointer?: string;
    parameter?: string;
  };
  meta?: Record<string, unknown>;
}): JsonApiError => {
  const error: JsonApiError = {
    status: params.status,
    title: params.title,
    detail: params.detail,
  };

  if (params.source) {
    error.source = params.source;
  }

  if (params.meta) {
    error.meta = params.meta;
  }

  return error;
};

/**
 * Build a JSON:API error document
 */
export const buildErrorDocument = (
  errors: JsonApiError[]
): JsonApiErrorDocument => {
  return { errors };
};

// ============================================
// Header Enforcement
// ============================================

/**
 * Assert that request has correct JSON:API headers
 *
 * For requests with body (POST, PATCH), Content-Type MUST be application/vnd.api+json
 * For all requests, Accept SHOULD include application/vnd.api+json or *\/*
 */
export const assertJsonApiRequestHeaders = (request: FastifyRequest): void => {
  const method = request.method;
  const hasBody = method === "POST" || method === "PATCH" || method === "PUT";

  if (hasBody) {
    const contentType = request.headers["content-type"];
    if (contentType !== APPLICATION_VND_API_JSON) {
      throw new Error(
        `Content-Type must be ${APPLICATION_VND_API_JSON} for requests with body`
      );
    }
  }
};

/**
 * Set JSON:API response headers
 */
export const setJsonApiResponseHeaders = (reply: FastifyReply): void => {
  reply.header("Content-Type", APPLICATION_VND_API_JSON);
};

// ============================================
// Domain Error Mapping
// ============================================

/**
 * Map a DomainError to a JSON:API error object
 *
 * SECURITY CONTRACT (SEC-03):
 * - Never includes cause, stack traces, or internal details
 * - Never includes providerRef, paymentToken, or other PII
 * - Only includes safe metadata for debugging
 */
export const mapDomainErrorToJsonApi = (
  error: DomainError,
  requestId: string
): JsonApiError => {
  const httpStatus = mapDomainErrorToHttpStatus(error);
  const statusString = String(httpStatus);

  // Base error
  const jsonApiError: JsonApiError = {
    status: statusString,
    title: error._tag.replace(/_/g, " ").toLowerCase(),
    detail: error.message,
  };

  // Add safe metadata
  const meta: Record<string, unknown> = {
    requestId,
    retryable: error.retryable,
  };

  // Add safe, non-sensitive fields from specific error types
  if (error._tag === "NOT_FOUND") {
    meta.resourceType = error.resourceType;
  }

  if (error._tag === "CONFLICT") {
    meta.currentState = error.currentState;
    meta.attemptedAction = error.attemptedAction;
  }

  if (error._tag === "POLICY_VIOLATION") {
    meta.policyName = error.policyName;
  }

  jsonApiError.meta = meta;

  return jsonApiError;
};

/**
 * Map a validation error (Zod) to a JSON:API error object
 */
export const mapValidationErrorToJsonApi = (
  message: string,
  requestId: string,
  pointer?: string,
  parameter?: string
): JsonApiError => {
  const error: JsonApiError = {
    status: "400",
    title: "validation error",
    detail: message,
    meta: {
      requestId,
      retryable: false,
    },
  };

  if (pointer || parameter) {
    error.source = {};
    if (pointer) {
      error.source.pointer = pointer;
    }
    if (parameter) {
      error.source.parameter = parameter;
    }
  }

  return error;
};
