/**
 * Fare Service - Facade over use cases for legacy handler and routes.
 *
 * Delegates to CalculateFareUseCase and GetFareUseCase.
 * Maps FareRecord to FareCalculationDTO for API responses.
 */

import { Result } from "../../../shared/core/result.js";
import type { DomainError } from "../../../shared/errors/error-types.js";
import type { RideId } from "../../../shared/types/ids/index.js";
import type { ClockPort } from "./ports/clock.port.js";
import type { FareRepositoryPort } from "./ports/fare-repository.port.js";
import type { FareRecord } from "./ports/index.js";
import { CalculateFareUseCase } from "./use-cases/calculate-fare.js";
import { GetFareUseCase } from "./use-cases/get-fare.js";

/** Default pricing version for fare calculation (Bogota). */
const DEFAULT_PRICING_VERSION = "v1.0.0";
/** Minimum fare COP (Bogota standard from PRD). */
const MINIMUM_FARE_COP_BOGOTA = 5000;

/**
 * Maps FareRecord to API DTO.
 */
function toFareCalculationDTO(
  record: FareRecord,
  tenantId?: string
): FareCalculationDTO {
  return {
    id: record.id,
    rideId: record.rideId,
    tenantId,
    totalFareCOP: record.totalFare.amount,
    baseFareCOP: record.baseFare.amount,
    distanceComponentCOP: record.distanceComponent.amount,
    timeComponentCOP: record.timeComponent.amount,
    minimumApplied: record.totalFare.minimumApplied,
    pricingVersion: record.pricingVersion.value,
    calculatedAt: new Date(record.calculatedAtUTC),
    createdAt: new Date(record.createdAtUTC),
  };
}

/**
 * DTO for fare API responses.
 * Owned by the application layer; adapters map to their own wire format.
 */
export interface FareCalculationDTO {
  readonly id: string;
  readonly rideId: string;
  readonly tenantId?: string;
  readonly totalFareCOP: number;
  readonly baseFareCOP: number;
  readonly distanceComponentCOP: number;
  readonly timeComponentCOP: number;
  readonly minimumApplied: boolean;
  readonly pricingVersion: string;
  readonly calculatedAt: Date;
  readonly createdAt: Date;
}

export interface IFareService {
  calculateAndStoreFare(params: {
    rideId: string;
    tenantId?: string;
    baseFareCOP: number;
    distanceKm: number;
    durationMinutes: number;
  }): Promise<Result<FareCalculationDTO, DomainError>>;
  getFareByRideId(
    rideId: string,
    _tenantId: string
  ): Promise<Result<FareCalculationDTO | null, DomainError>>;
}

/**
 * Fare service implementation using use cases.
 */
class FareService implements IFareService {
  constructor(
    private readonly calculateFare: CalculateFareUseCase,
    private readonly getFare: GetFareUseCase
  ) {}

  async calculateAndStoreFare(params: {
    rideId: string;
    tenantId: string;
    baseFareCOP: number;
    distanceKm: number;
    durationMinutes: number;
  }): Promise<Result<FareCalculationDTO, DomainError>> {
    const result = await this.calculateFare.execute({
      rideId: params.rideId as RideId,
      baseFareCOP: params.baseFareCOP,
      distanceKm: params.distanceKm,
      durationMinutes: params.durationMinutes,
      minimumFareCOP: MINIMUM_FARE_COP_BOGOTA,
      pricingVersionString: DEFAULT_PRICING_VERSION,
    });
    if (result.isErr()) {
      return result;
    }
    return Result.ok(toFareCalculationDTO(result.value, params.tenantId));
  }

  async getFareByRideId(
    rideId: string,
    tenantId: string
  ): Promise<Result<FareCalculationDTO | null, DomainError>> {
    const result = await this.getFare.execute(rideId as RideId);
    if (result.isErr()) {
      return result;
    }
    const record = result.value;
    if (record === null) {
      return Result.ok(null);
    }
    return Result.ok(toFareCalculationDTO(record, tenantId));
  }
}

export function createFareService(
  repository: FareRepositoryPort,
  clock: ClockPort
): IFareService {
  return new FareService(
    new CalculateFareUseCase(repository, clock),
    new GetFareUseCase(repository)
  );
}
