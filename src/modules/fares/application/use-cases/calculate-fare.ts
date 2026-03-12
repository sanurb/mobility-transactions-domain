/**
 * Idempotent fare calculation: checks for an existing fare before computing,
 * delegates pricing to the domain, and persists the result.
 */

import { Result } from "../../../../shared/core/result.js";
import { PricingVersion } from "../../../../shared/domain/value-objects/index.js";
import type { DomainError } from "../../../../shared/errors/error-types.js";
import type { RideId } from "../../../../shared/types/ids/index.js";
import { calculateFare, type FareInput } from "../../domain/index.js";
import type {
  ClockPort,
  FareRecord,
  FareRepositoryPort,
} from "../ports/index.js";

/** Primitives from inbound adapter — VOs are parsed internally. */
export interface CalculateFareInput {
  readonly rideId: RideId;
  readonly baseFareCOP: number;
  readonly distanceKm: number;
  readonly durationMinutes: number;
  readonly minimumFareCOP: number;
  readonly pricingVersionString: string;
}

export class CalculateFareUseCase {
  private readonly repository: FareRepositoryPort;
  private readonly clock: ClockPort;

  constructor(repository: FareRepositoryPort, clock: ClockPort) {
    this.repository = repository;
    this.clock = clock;
  }

  async execute(
    input: CalculateFareInput
  ): Promise<Result<FareRecord, DomainError>> {
    const existingResult = await this.repository.findByRideId(input.rideId);
    if (existingResult.isErr()) {
      return existingResult;
    }

    if (existingResult.value !== null) {
      return Result.ok(existingResult.value);
    }

    const pricingVersionResult = PricingVersion.create(
      input.pricingVersionString
    );
    if (pricingVersionResult.isErr()) {
      return Result.err(pricingVersionResult.error);
    }

    const fareInput: FareInput = {
      baseFareCOP: input.baseFareCOP,
      distanceKm: input.distanceKm,
      durationMinutes: input.durationMinutes,
    };

    const calculationResult = calculateFare(
      fareInput,
      {
        minimumFareCOP: input.minimumFareCOP,
        pricingVersion: pricingVersionResult.value,
      },
      this.clock.now()
    );

    if (calculationResult.isErr()) {
      return Result.err(calculationResult.error);
    }

    const fareResult = calculationResult.value;

    return this.repository.save({
      rideId: input.rideId,
      baseFare: fareResult.breakdown.baseFare,
      distanceKm: input.distanceKm,
      durationMinutes: input.durationMinutes,
      distanceComponent: fareResult.breakdown.distanceComponent,
      timeComponent: fareResult.breakdown.timeComponent,
      totalFare: fareResult.totalFare,
      pricingVersion: fareResult.pricingVersion,
      calculatedAtUTC: fareResult.calculatedAtUTC,
    });
  }
}
