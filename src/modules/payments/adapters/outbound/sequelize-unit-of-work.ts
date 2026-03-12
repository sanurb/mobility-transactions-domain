import type { Sequelize, Transaction } from "sequelize";
import type {
  PaymentsTx,
  PaymentsTxContext,
  UnitOfWorkPort,
} from "../../application/ports/unit-of-work.port.js";

/**
 * Sequelize Unit of Work Implementation
 *
 * Provides transaction management using Sequelize.
 * Implements PaymentsTxContext to resolve opaque tokens to real Sequelize transactions.
 *
 * DESIGN:
 * - Creates opaque PaymentsTx tokens (symbols)
 * - Binds tokens to real Sequelize transactions in instance-scoped Map
 * - Provides resolveSequelizeTx() for adapters to get real transaction
 * - NO module-level WeakMap (explicit, testable, no hidden state)
 */
export class SequelizeUnitOfWork implements UnitOfWorkPort, PaymentsTxContext {
  readonly #sequelize: Sequelize;
  readonly #transactions = new Map<symbol, Transaction>();

  constructor(sequelize: Sequelize) {
    this.#sequelize = sequelize;
  }

  /**
   * Execute a function within a Sequelize transaction.
   * Creates opaque token, binds to real transaction, then executes.
   */
  async withTransaction<T>(fn: (tx: PaymentsTx) => Promise<T>): Promise<T> {
    const transaction = await this.#sequelize.transaction();

    // Create opaque token
    const token = Symbol("PaymentsTx") as PaymentsTx;

    // Bind token to real transaction
    this.#transactions.set(token, transaction);

    try {
      const result = await fn(token);
      await transaction.commit();

      // Clean up binding
      this.#transactions.delete(token);

      return result;
    } catch (error) {
      await transaction.rollback();

      // Clean up binding
      this.#transactions.delete(token);

      throw error;
    }
  }

  /**
   * Resolve opaque transaction token to real Sequelize transaction.
   * Called by adapters that need concrete transaction.
   *
   * @param tx - Opaque transaction token
   * @returns Real Sequelize transaction
   * @throws Error if token not recognized
   */
  resolveSequelizeTx(tx: PaymentsTx): Transaction {
    const transaction = this.#transactions.get(tx as symbol);

    if (!transaction) {
      throw new Error(
        "Invalid PaymentsTx token - transaction not found or already completed"
      );
    }

    return transaction;
  }
}
