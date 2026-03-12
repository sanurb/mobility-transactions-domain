/**
 * Get Support Evidence Use Case
 *
 * Query use case: Retrieves detailed payment evidence for support/operations.
 *
 * DESIGN PRINCIPLES:
 * - Read-only operation (no mutations, no UoW)
 * - Returns full evidence including attempt timeline
 * - Access control enforced at inbound boundary (ops/support scope required)
 * - Includes providerRef for reconciliation (safe for ops, not for users)
 */

import type { RideId } from "../../../../shared/types/ids/index.js";
import type { PaymentStatus } from "../../domain/payment-policy.js";
import type { SettlementOutcome } from "../../domain/payment-types.js";
import type { PaymentRepositoryPort } from "../ports/payment-repository.port.js";

/**
 * Input for retrieving support evidence
 */
export interface GetSupportEvidenceInput {
  /** Ride ID to get evidence for */
  readonly rideId: RideId;
}

/**
 * Attempt details for evidence
 */
export interface AttemptEvidence {
  readonly attemptNumber: number;
  readonly outcome: SettlementOutcome;
  readonly reasonCode: string | null;
  readonly initiatedAt: string;
  readonly completedAt: string | null;
}

/**
 * Support evidence output (full details)
 */
export interface GetSupportEvidenceOutput {
  readonly paymentIntentId: string;
  readonly rideId: string;
  readonly riderId: string;
  readonly amountCOP: number;
  readonly paymentStatus: PaymentStatus;
  readonly attemptCount: number;
  readonly attempts: readonly AttemptEvidence[];
  readonly createdAt: string;
}

/**
 * Get Support Evidence Use Case
 */
export class GetSupportEvidenceUseCase {
  constructor(private readonly repo: PaymentRepositoryPort) {}

  /**
   * Execute: Retrieve full payment evidence for support.
   *
   * @param input - Evidence query parameters
   * @returns Evidence output or null if not found
   */
  async execute(
    input: GetSupportEvidenceInput
  ): Promise<GetSupportEvidenceOutput | null> {
    // Find payment intent by ride ID
    const intent = await this.repo.findByRideId(input.rideId);
    if (!intent) {
      return null;
    }

    // Map attempts to evidence format
    const attempts: AttemptEvidence[] = intent.attempts.map((a) => ({
      attemptNumber: a.attemptNumber,
      outcome: a.outcome,
      reasonCode: a.reasonCode,
      initiatedAt: a.initiatedAtUTC,
      completedAt: a.completedAtUTC,
    }));

    // Return full evidence
    return {
      paymentIntentId: String(intent.id),
      rideId: String(intent.rideId),
      riderId: String(intent.riderId),
      amountCOP: intent.amountCOP.amount,
      paymentStatus: intent.paymentStatus,
      attemptCount: intent.attemptCount,
      attempts,
      createdAt: intent.createdAtUTC,
    };
  }
}
