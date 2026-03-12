import { ok, type Result } from "../../../../shared/core/result.js";
import type { DomainError } from "../../../../shared/errors/error-types.js";
import type { ClockPort } from "../../application/ports/clock.port.js";
import type {
  ChargeParams,
  ChargeResult,
  PaymentProviderPort,
} from "../../application/ports/payment-provider.port.js";
import { SETTLEMENT_OUTCOMES } from "../../domain/payment-types.js";

export class MockPaymentProvider implements PaymentProviderPort {
  private callCount = 0;
  private forcedOutcome: ChargeResult | null = null;

  constructor(private readonly clock: ClockPort) {}

  setForcedOutcome(outcome: ChargeResult): void {
    this.forcedOutcome = outcome;
  }
  clearForcedOutcome(): void {
    this.forcedOutcome = null;
  }
  getCallCount(): number {
    return this.callCount;
  }
  resetCallCount(): void {
    this.callCount = 0;
  }

  async charge(
    params: ChargeParams
  ): Promise<Result<ChargeResult, DomainError>> {
    this.callCount++;
    if (this.forcedOutcome) {
      return ok(this.forcedOutcome);
    }
    return ok({
      outcome: SETTLEMENT_OUTCOMES.SUCCEEDED,
      providerRef: `mock_${params.idempotencyKey}`,
      reasonCode: null,
      completedAtUTC: this.clock.nowUTC(),
    });
  }
}

export const createMockPaymentProvider = (
  clock: ClockPort
): PaymentProviderPort => new MockPaymentProvider(clock);
