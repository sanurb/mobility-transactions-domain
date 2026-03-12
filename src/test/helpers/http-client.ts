/**
 * Typed HTTP client wrapper for test requests
 *
 * Simplifies test arrange phase by wrapping injectRequest with common defaults.
 * No assertions - tests own all expectations.
 */

import type {
  FastifyInstance,
  InjectOptions,
  LightMyRequestResponse,
} from "fastify";

export interface HttpClient {
  postJson(
    path: string,
    body: unknown,
    headers?: Record<string, string>
  ): Promise<LightMyRequestResponse>;
  putJson(
    path: string,
    body: unknown,
    headers?: Record<string, string>
  ): Promise<LightMyRequestResponse>;
  get(
    path: string,
    headers?: Record<string, string>
  ): Promise<LightMyRequestResponse>;
}

/**
 * Create HTTP client for test requests
 * Sets Authorization header and JSON content-type automatically
 */
export const createHttpClient = (params: {
  app: FastifyInstance;
  token: string;
}): HttpClient => {
  const { app, token } = params;

  const postJson = async (
    path: string,
    body: unknown,
    headers?: Record<string, string>
  ): Promise<LightMyRequestResponse> => {
    return app.inject({
      method: "POST",
      url: path,
      payload: body as InjectOptions["payload"],
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...headers,
      },
    });
  };

  const putJson = async (
    path: string,
    body: unknown,
    headers?: Record<string, string>
  ): Promise<LightMyRequestResponse> => {
    return app.inject({
      method: "PUT",
      url: path,
      payload: body as InjectOptions["payload"],
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...headers,
      },
    });
  };

  const get = async (
    path: string,
    headers?: Record<string, string>
  ): Promise<LightMyRequestResponse> => {
    return app.inject({
      method: "GET",
      url: path,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...headers,
      },
    });
  };

  return {
    postJson,
    putJson,
    get,
  };
};
