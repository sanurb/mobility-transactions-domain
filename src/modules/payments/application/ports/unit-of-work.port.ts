/**
 * Unit of Work Port
 *
 * Provides atomic transaction support for payments persistence operations.
 * Ensures aggregate persistence and outbox enqueue happen in the SAME database transaction.
 *
 * DESIGN PRINCIPLES:
 * - PaymentsTx is opaque to application/domain (no Sequelize mention)
 * - NO hidden global registry (WeakMap) allowed
 * - Transaction context is explicit and adapter-owned
 * - Atomicity is structural (not "remember to pass tx")
 *
 * ADAPTER CONTRACT:
 * - Outbound adapters accept `tx: PaymentsTx` parameter
 * - Adapters resolve PaymentsTx to real Sequelize transaction via injected PaymentsTxContext
 * - This keeps the mapping explicit and testable without global state
 */

/**
 * Opaque transaction token.
 * Application code passes this to repository/outbox operations.
 * Only the adapter knows how to resolve it to a real Sequelize transaction.
 */
export type PaymentsTx = symbol & { readonly __brand: "PaymentsTx" };

/**
 * Transaction context interface for resolving opaque tokens to real transactions.
 * Implemented by SequelizeUnitOfWork and injected into adapters.
 * This is the explicit contract that replaces hidden WeakMap registries.
 */
export interface PaymentsTxContext {
  /**
   * Resolve the opaque transaction token to a real Sequelize transaction.
   * Only called by adapters that need the concrete transaction.
   *
   * @param tx - Opaque transaction token
   * @returns The real Sequelize transaction
   * @throws Error if token is not recognized
   */
  resolveSequelizeTx(tx: PaymentsTx): unknown; // unknown is Sequelize.Transaction at adapter boundary
}

/**
 * Unit of Work Port
 *
 * Provides transactional boundaries for payments operations.
 * All repository and outbox operations MUST happen within a transaction.
 */
export interface UnitOfWorkPort {
  /**
   * Execute a function within a database transaction.
   * Commits on success, rolls back on error.
   *
   * @param fn - Function to execute within transaction
   * @returns Promise with function result
   * @throws Error if transaction fails
   */
  withTransaction<T>(fn: (tx: PaymentsTx) => Promise<T>): Promise<T>;
}
