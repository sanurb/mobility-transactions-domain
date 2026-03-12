import { beforeEach, describe, expect, it } from "vitest";
import { FareAmount } from "../../../../shared/domain/value-objects/fare-amount.js";
import { PricingVersion } from "../../../../shared/domain/value-objects/index.js";
import { MoneyCOP } from "../../../../shared/domain/value-objects/money-cop.js";
import { createRideId } from "../../../../shared/types/ids/index.js";
import { CalculateFareUseCase } from "../../application/use-cases/index.js";
import { FakeClock, FakeFareRepository } from "../helpers/faked-ports.js";
import {
  buildCalculateFareInput,
  buildRideId,
} from "../helpers/fare-test-factories.js";

describe("CalculateFareUseCase", () => {
  let repository: FakeFareRepository;
  let clock: FakeClock;
  let useCase: CalculateFareUseCase;

  beforeEach(() => {
    repository = new FakeFareRepository();
    clock = new FakeClock("2026-02-13T10:00:00.000Z");
    useCase = new CalculateFareUseCase(repository, clock);
  });

  it("When ride has no fare, then saves and returns new fare", async () => {
    const input = buildCalculateFareInput({
      rideId: createRideId(buildRideId("001")),
    });

    const result = await useCase.execute(input);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().rideId).toBe(input.rideId);
  });

  it("When fare already calculated, then returns existing fare", async () => {
    const input = buildCalculateFareInput({
      rideId: createRideId(buildRideId("002")),
    });
    const firstResult = await useCase.execute(input);

    const secondResult = await useCase.execute(input);

    expect(secondResult.isOk()).toBe(true);
    expect(secondResult.unwrap().id).toBe(firstResult.unwrap().id);
  });

  it("When repository already has fare for ride, then returns existing via use case", async () => {
    const input = buildCalculateFareInput({
      rideId: createRideId(buildRideId("003")),
    });
    const pricingVersion = PricingVersion.create("v1.0.0").unwrap();
    await repository.save({
      rideId: input.rideId,
      baseFare: MoneyCOP.fromTrusted(3500),
      distanceKm: 5.0,
      durationMinutes: 10,
      distanceComponent: MoneyCOP.fromTrusted(6000),
      timeComponent: MoneyCOP.fromTrusted(2000),
      totalFare: FareAmount.create(11_500, { minimumFareCOP: 5000 }).unwrap(),
      pricingVersion,
      calculatedAtUTC: clock.now(),
    });

    const result = await useCase.execute(input);

    expect(result.isOk()).toBe(true);
  });
});
