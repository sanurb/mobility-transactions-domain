/**
 * Get Payment Status Use Case
 *
 * Query use case: Retrieves payment status for a ride.
 *
 * DESIGN PRINCIPLES:
 * - Read-only operation (no mutations, no UoW)
 * - Returns minimal status information
 * - Fast query for status checks
 */

import type { RideId } from "../../../../shared/types/ids/index.js";
import type { PaymentStatus } from "../../domain/payment-policy.js";
import type { PaymentRepositoryPort } from "../ports/payment-repository.port.js";

/**
 * Input for retrieving payment status
 */
export interface GetPaymentStatusInput {
  /** Ride ID to check status for */
  readonly rideId: RideId;
}

/**
 * Payment status output
 */
export interface GetPaymentStatusOutput {
  readonly status: PaymentStatus;
  readonly attemptCount: number;
}

/**
 * Get Payment Status Use Case
 */
export class GetPaymentStatusUseCase {
  constructor(private readonly repo: PaymentRepositoryPort) {}

  /**
   * Execute: Retrieve payment status.
   *
   * @param input - Status query parameters
   * @returns Status output or null if not found
   */
  async execute(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput | null> {
    // Find payment intent by ride ID
    const intent = await this.repo.findByRideId(input.rideId);
    if (!intent) {
      return null;
    }

    // Return status
    return {
      status: intent.paymentStatus,
      attemptCount: intent.attemptCount,
    };
  }
}
