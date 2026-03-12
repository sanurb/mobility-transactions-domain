import { describe, expect, it } from "vitest";
import { PricingVersion } from "../../../../shared/domain/value-objects/index.js";
import { calculateFare } from "../../domain/index.js";
import { buildFareInput } from "../helpers/fare-test-factories.js";

describe("calculateFare", () => {
  it("When all components provided, then calculates correct total", () => {
    const pricingVersion = PricingVersion.create("v1.0.0").unwrap();
    const input = buildFareInput({
      baseFareCOP: 3500,
      distanceKm: 5.0,
      durationMinutes: 10,
    });

    const result = calculateFare(
      input,
      { minimumFareCOP: 5000, pricingVersion },
      "2026-02-13T10:00:00.000Z"
    );

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().totalFare.amount).toBe(11_500);
  });

  it("When distance has decimals, then rounds distance component up", () => {
    const pricingVersion = PricingVersion.create("v1.0.0").unwrap();
    const input = buildFareInput({
      baseFareCOP: 3500,
      distanceKm: 5.1,
      durationMinutes: 0,
    });

    const result = calculateFare(
      input,
      { minimumFareCOP: 0, pricingVersion },
      "2026-02-13T10:00:00.000Z"
    );

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().breakdown.distanceComponent.amount).toBe(6120);
  });

  it("When duration has decimals, then rounds time component up", () => {
    const pricingVersion = PricingVersion.create("v1.0.0").unwrap();
    const input = buildFareInput({
      baseFareCOP: 0,
      distanceKm: 0,
      durationMinutes: 10.3,
    });

    const result = calculateFare(
      input,
      { minimumFareCOP: 0, pricingVersion },
      "2026-02-13T10:00:00.000Z"
    );

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().breakdown.timeComponent.amount).toBe(2060);
  });

  it("When total is below minimum, then applies minimum fare", () => {
    const pricingVersion = PricingVersion.create("v1.0.0").unwrap();
    const input = buildFareInput({
      baseFareCOP: 1000,
      distanceKm: 1.0,
      durationMinutes: 1,
    });

    const result = calculateFare(
      input,
      { minimumFareCOP: 5000, pricingVersion },
      "2026-02-13T10:00:00.000Z"
    );

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().totalFare.amount).toBe(5000);
    expect(result.unwrap().totalFare.minimumApplied).toBe(true);
  });

  it("When total is above minimum, then does not apply minimum fare", () => {
    const pricingVersion = PricingVersion.create("v1.0.0").unwrap();
    const input = buildFareInput({
      baseFareCOP: 10_000,
      distanceKm: 0,
      durationMinutes: 0,
    });

    const result = calculateFare(
      input,
      { minimumFareCOP: 5000, pricingVersion },
      "2026-02-13T10:00:00.000Z"
    );

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().totalFare.amount).toBe(10_000);
    expect(result.unwrap().totalFare.minimumApplied).toBe(false);
  });

  it("When custom pricing version provided, then includes it in result", () => {
    const pricingVersion = PricingVersion.create("v2.1.3").unwrap();
    const input = buildFareInput();

    const result = calculateFare(
      input,
      { minimumFareCOP: 5000, pricingVersion },
      "2026-02-13T10:00:00.000Z"
    );

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().pricingVersion.value).toBe("v2.1.3");
  });

  it("When timestamp provided, then includes calculatedAtUTC in result", () => {
    const pricingVersion = PricingVersion.create("v1.0.0").unwrap();
    const input = buildFareInput();
    const timestamp = "2026-02-13T15:30:00.000Z";

    const result = calculateFare(
      input,
      { minimumFareCOP: 5000, pricingVersion },
      timestamp
    );

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().calculatedAtUTC).toBe(timestamp);
  });

  it("When base fare is negative, then rejects with error", () => {
    const pricingVersion = PricingVersion.create("v1.0.0").unwrap();
    const input = buildFareInput({ baseFareCOP: -100 });

    const result = calculateFare(
      input,
      { minimumFareCOP: 5000, pricingVersion },
      "2026-02-13T10:00:00.000Z"
    );

    expect(result.isErr()).toBe(true);
  });

  it("When base fare is non-integer, then rejects with error", () => {
    const pricingVersion = PricingVersion.create("v1.0.0").unwrap();
    const input = buildFareInput({ baseFareCOP: 3500.5 });

    const result = calculateFare(
      input,
      { minimumFareCOP: 5000, pricingVersion },
      "2026-02-13T10:00:00.000Z"
    );

    expect(result.isErr()).toBe(true);
  });

  it("When distance is negative, then rejects with error", () => {
    const pricingVersion = PricingVersion.create("v1.0.0").unwrap();
    const input = buildFareInput({ distanceKm: -5 });

    const result = calculateFare(
      input,
      { minimumFareCOP: 5000, pricingVersion },
      "2026-02-13T10:00:00.000Z"
    );

    expect(result.isErr()).toBe(true);
  });

  it("When duration is negative, then rejects with error", () => {
    const pricingVersion = PricingVersion.create("v1.0.0").unwrap();
    const input = buildFareInput({ durationMinutes: -10 });

    const result = calculateFare(
      input,
      { minimumFareCOP: 5000, pricingVersion },
      "2026-02-13T10:00:00.000Z"
    );

    expect(result.isErr()).toBe(true);
  });

  it("When base fare is infinite, then rejects with error", () => {
    const pricingVersion = PricingVersion.create("v1.0.0").unwrap();
    const input = buildFareInput({ baseFareCOP: Number.POSITIVE_INFINITY });

    const result = calculateFare(
      input,
      { minimumFareCOP: 5000, pricingVersion },
      "2026-02-13T10:00:00.000Z"
    );

    expect(result.isErr()).toBe(true);
  });

  it("When distance is NaN, then rejects with error", () => {
    const pricingVersion = PricingVersion.create("v1.0.0").unwrap();
    const input = buildFareInput({ distanceKm: Number.NaN });

    const result = calculateFare(
      input,
      { minimumFareCOP: 5000, pricingVersion },
      "2026-02-13T10:00:00.000Z"
    );

    expect(result.isErr()).toBe(true);
  });
});
