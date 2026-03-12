/**
 * Payment Domain - Public Exports
 *
 * Exposes payment domain aggregate, entities, events, types, and policy functions.
 */

// Domain Events
export {
  createPaymentIntentCreatedEvent,
  createSettlementAttemptedEvent,
  createSettlementFailedEvent,
  createSettlementSucceededEvent,
  type PaymentIntentCreatedEvent,
  type PaymentIntentCreatedPayload,
  type SettlementAttemptedEvent,
  type SettlementAttemptedPayload,
  type SettlementFailedEvent,
  type SettlementFailedPayload,
  type SettlementSucceededEvent,
  type SettlementSucceededPayload,
} from "./events.js";
// Aggregate Root
export { PaymentIntent } from "./payment-intent.aggregate.js";
// Policy functions
export {
  type CanAttemptParams,
  canAttemptSettlement,
  derivePaymentStatus,
  getNextAttemptNumber,
  MAX_SETTLEMENT_ATTEMPTS,
  type PaymentStatus,
  type SettlementAttemptLike,
} from "./payment-policy.js";

// Types and constants
export {
  type FareBreakdownRef,
  PAYMENT_POLICY,
  SETTLEMENT_OUTCOMES,
  type SettlementOutcome,
} from "./payment-types.js";
// Entities
export { SettlementAttempt } from "./settlement-attempt.entity.js";
