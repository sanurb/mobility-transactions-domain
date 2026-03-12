import type {
  PaymentIntentId,
  RideId,
} from "../../../../shared/types/ids/index.js";
import type { PaymentIntent } from "../../domain/payment-intent.aggregate.js";
import type { PaymentsTx } from "./unit-of-work.port.js";

/**
 * Payment Repository Port
 *
 * Repository for PaymentIntent aggregates following hexagonal architecture.
 *
 * DESIGN PRINCIPLES:
 * - Operates on PaymentIntent aggregate ONLY (no persistence DTOs leak inward)
 * - No tenantId parameters (PRD: isolation via ownership/role/geo at inbound boundary)
 * - Repository MUST reconstitute via PaymentIntent.reconstitute()
 * - Repository MUST NOT pull domain events (application owns event orchestration)
 * - All writes require explicit transaction passing (enforces atomicity)
 *
 * PERSISTENCE RULES:
 * - save() persists intent + all owned settlement attempts
 * - find*() methods reconstitute full aggregate from persistence
 * - No update/delete operations (append-only for audit integrity)
 */
export interface PaymentRepositoryPort {
  /**
   * Save a payment intent aggregate with all its settlement attempts.
   * Creates new intent or updates existing one.
   * Persists all owned settlement attempts atomically.
   *
   * MUST NOT pull domain events - application layer owns event orchestration.
   *
   * @param aggregate - PaymentIntent aggregate to persist
   * @param tx - Transaction to use for persistence
   * @throws InfrastructureError if persistence fails
   */
  save(aggregate: PaymentIntent, tx: PaymentsTx): Promise<void>;

  /**
   * Find payment intent by ID.
   * Reconstitutes full aggregate via PaymentIntent.reconstitute().
   *
   * @param id - Payment intent ID
   * @returns Reconstituted aggregate or null if not found
   * @throws InfrastructureError if reconstitution fails
   */
  findById(id: PaymentIntentId): Promise<PaymentIntent | null>;

  /**
   * Find payment intent by ride ID.
   * Each ride has exactly one payment intent (unique constraint).
   * Reconstitutes full aggregate via PaymentIntent.reconstitute().
   *
   * @param rideId - Ride ID
   * @returns Reconstituted aggregate or null if not found
   * @throws InfrastructureError if reconstitution fails
   */
  findByRideId(rideId: RideId): Promise<PaymentIntent | null>;
}
