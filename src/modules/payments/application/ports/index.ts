/**
 * Payments Application Ports
 *
 * Hexagonal architecture ports for payments context.
 * All outbound dependencies are expressed as interfaces here.
 * Adapters implement these ports at the infrastructure boundary.
 */

// Clock
export type { ClockPort } from "./clock.port.js";
export type { IdGeneratorPort } from "./id-generator.port.js";
// Outbox
export type {
  OutboxEnvelope,
  OutboxPort,
  OutboxRecord,
} from "./outbox.port.js";
// Payment Provider (already exists from Phase 5)
export type {
  ChargeParams,
  ChargeResult,
  PaymentProviderPort,
} from "./payment-provider.port.js";
// Repositories
export type { PaymentRepositoryPort } from "./payment-repository.port.js";
// Unit of Work
export type {
  PaymentsTx,
  PaymentsTxContext,
  UnitOfWorkPort,
} from "./unit-of-work.port.js";
