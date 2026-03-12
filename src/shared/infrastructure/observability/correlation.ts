/**
 * @fileoverview
 * Request-scoped correlation context using AsyncLocalStorage.
 * Propagates correlation metadata through async call chains without explicit passing.
 *
 * DESIGN:
 * - AsyncLocalStorage provides request-scoped isolation
 * - No TenantId (per PRD: isolation via ownership/role/geo)
 * - Correlation context includes: correlationId, causationId, userId, role, requestId, useCase
 * - API: runWithCorrelation(ctx, fn) wraps execution; getCorrelation() retrieves current context
 */

import { AsyncLocalStorage } from "node:async_hooks";

// ============================================
// Correlation Context Type
// ============================================

/**
 * Correlation context for a single request
 * Immutable once set (no mutation allowed)
 */
export interface CorrelationContext {
  /** Primary correlation ID for request tracking */
  readonly correlationId: string;
  /** Causation ID for event chains (optional) */
  readonly causationId?: string;
  /** User ID if authenticated (optional) */
  readonly userId?: string;
  /** User role if authenticated (optional) */
  readonly role?: "rider" | "driver" | "admin" | "system";
  /** Request ID from Fastify (optional, usually same as correlationId) */
  readonly requestId?: string;
  /** Use case name for observability (optional, set at adapter boundary) */
  readonly useCase?: string;
}

// ============================================
// AsyncLocalStorage Store
// ============================================

const correlationStore = new AsyncLocalStorage<CorrelationContext>();

// ============================================
// API
// ============================================

/**
 * Run a function within a correlation context.
 * All async operations spawned within fn will have access to the same context.
 *
 * @param ctx - Correlation context to establish
 * @param fn - Async function to execute within context
 * @returns Promise resolving to fn's return value
 */
export const runWithCorrelation = async <T>(
  ctx: CorrelationContext,
  fn: () => Promise<T>
): Promise<T> => {
  return correlationStore.run(ctx, fn);
};

/**
 * Get the current correlation context.
 * Returns undefined if called outside runWithCorrelation.
 *
 * @returns Current correlation context or undefined
 */
export const getCorrelation = (): CorrelationContext | undefined => {
  return correlationStore.getStore();
};

/**
 * Set the use case name in the current correlation context.
 * Returns a new context with the use case set (immutable update).
 *
 * IMPORTANT: This does NOT mutate the store - caller must use runWithCorrelation
 * with the returned context to propagate the change.
 *
 * @param useCase - Use case name to set
 * @returns New context with use case set, or undefined if no context exists
 */
export const withUseCase = (
  useCase: string
): CorrelationContext | undefined => {
  const current = correlationStore.getStore();
  if (!current) {
    return undefined;
  }

  return {
    ...current,
    useCase,
  };
};

/**
 * Get correlation ID from current context, or return default value.
 *
 * @param defaultValue - Default value if no context exists
 * @returns Correlation ID or default
 */
export const getCorrelationId = (defaultValue = "unknown"): string => {
  const ctx = correlationStore.getStore();
  return ctx?.correlationId ?? defaultValue;
};
