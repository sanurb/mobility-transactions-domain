/**
 * Get User Receipt Use Case
 *
 * Query use case: Retrieves user-safe receipt for a ride payment.
 *
 * DESIGN PRINCIPLES:
 * - Read-only operation (no mutations, no UoW)
 * - Returns safe fields only (no provider tokens, no sensitive details)
 * - Caller scope verification happens at inbound boundary (not here)
 */

import type { RideId, RiderId } from "../../../../shared/types/ids/index.js";
import type { PaymentStatus } from "../../domain/payment-policy.js";
import type { FareBreakdownRef } from "../../domain/payment-types.js";
import type { PaymentRepositoryPort } from "../ports/payment-repository.port.js";

/**
 * Input for retrieving user receipt
 */
export interface GetUserReceiptInput {
  /** Ride ID to get receipt for */
  readonly rideId: RideId;
  /** Rider ID (for verification at inbound boundary) */
  readonly riderId: RiderId;
}

/**
 * User-safe receipt output
 */
export interface GetUserReceiptOutput {
  readonly rideId: string;
  readonly amountCOP: number;
  readonly currency: "COP";
  readonly fareBreakdown: FareBreakdownRef;
  readonly paymentStatus: PaymentStatus;
  readonly createdAt: string;
}

/**
 * Get User Receipt Use Case
 */
export class GetUserReceiptUseCase {
  private readonly repo: PaymentRepositoryPort;
  constructor(repo: PaymentRepositoryPort) {
    this.repo = repo;
  }

  /**
   * Execute: Retrieve user-safe payment receipt.
   *
   * @param input - Receipt query parameters
   * @returns Receipt output or null if not found
   */
  async execute(
    input: GetUserReceiptInput
  ): Promise<GetUserReceiptOutput | null> {
    // Find payment intent by ride ID
    const intent = await this.repo.findByRideId(input.rideId);
    if (!intent) {
      return null;
    }

    // Return safe receipt fields only
    return {
      rideId: String(intent.rideId),
      amountCOP: intent.amountCOP.amount,
      currency: "COP",
      fareBreakdown: intent.fareBreakdown,
      paymentStatus: intent.paymentStatus,
      createdAt: intent.createdAtUTC,
    };
  }
}
