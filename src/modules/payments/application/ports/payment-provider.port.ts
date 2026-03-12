import type { Result } from "../../../../shared/core/result.js";
import type { DomainError } from "../../../../shared/errors/error-types.js";
import type { SettlementOutcome } from "../../domain/payment-types.js";

/**
 * Parameters for charging a payment method
 */
export interface ChargeParams {
  /** Unique key for idempotent charge (from client) */
  readonly idempotencyKey: string;
  /** Amount to charge in COP */
  readonly amountCOP: number;
  /** Rider identifier (for payment method lookup) */
  readonly riderId: string;
  /** Tenant identifier */
  readonly tenantId: string;
  /** Optional metadata for provider */
  readonly metadata?: Record<string, string>;
}

/**
 * Result of a charge attempt
 */
export interface ChargeResult {
  /** Canonical outcome mapped from provider response */
  readonly outcome: SettlementOutcome;
  /** Provider's transaction reference (for reconciliation) */
  readonly providerRef: string | null;
  /** Reason code (e.g., "insufficient_funds", "card_declined") */
  readonly reasonCode: string | null;
  /** Timestamp when provider completed the charge */
  readonly completedAtUTC: string;
}

/**
 * Payment Provider Port
 *
 * Hexagonal port for payment provider integration.
 * Implementations can be swapped without changing domain/application logic.
 *
 * Implementations:
 * - MockPaymentProvider (testing)
 * - StripePaymentProvider (production)
 * - MercadoPagoPaymentProvider (future)
 */
export interface PaymentProviderPort {
  /**
   * Attempt to charge a payment method
   *
   * @param params - Charge parameters
   * @returns Result with ChargeResult on success, DomainError on failure
   */
  charge(params: ChargeParams): Promise<Result<ChargeResult, DomainError>>;
}
