import { beforeEach, describe, expect, it } from "vitest";
import { TransitionRideUseCase } from "../../application/use-cases/transition-ride.js";
import { Ride } from "../../domain/ride.aggregate.js";
import { RIDE_STATES } from "../../domain/ride-states.js";
import { FakeClock, FakeRideRepository } from "../helpers/faked-ports.js";
import {
  buildRideCreateRequest,
  buildRideSnapshot,
} from "../helpers/ride-test-factories.js";

describe.sequential("TransitionRideUseCase", () => {
  let repository: FakeRideRepository;
  let clock: FakeClock;
  let useCase: TransitionRideUseCase;

  beforeEach(() => {
    repository = new FakeRideRepository();
    repository.clear();
    clock = new FakeClock("2026-02-13T14:00:00.000Z");
    useCase = new TransitionRideUseCase(repository, clock);
  });

  it("When transitioning a valid ride, then new state is saved", async () => {
    const props = buildRideCreateRequest();
    const ride = Ride.create(props);
    ride.pullDomainEvents();
    await repository.save(ride);

    const result = await useCase.execute({
      rideId: props.id,
      toState: RIDE_STATES.DISPATCHING,
      changedBy: "test-system",
      changedByRole: "system",
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().newState).toBe(RIDE_STATES.DISPATCHING);
  });

  it("When ride does not exist, then NOT_FOUND error is returned", async () => {
    const props = buildRideCreateRequest();

    const result = await useCase.execute({
      rideId: props.id,
      toState: RIDE_STATES.DISPATCHING,
      changedBy: "test-system",
      changedByRole: "system",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toMatchObject({ _tag: "NOT_FOUND" });
    }
  });

  it("When saving a stale version, then CONFLICT error is returned", async () => {
    const props = buildRideCreateRequest();
    const ride = Ride.create(props);
    await repository.save(ride);
    ride.transition({
      toState: RIDE_STATES.DISPATCHING,
      changedBy: "other-system",
      changedByRole: "system",
      nowUTC: clock.now(),
    });
    await repository.save(ride);
    const staleRide = Ride.reconstitute(
      buildRideSnapshot({ id: props.id, version: 1 })
    );

    const result = await repository.save(staleRide);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toMatchObject({ _tag: "CONFLICT" });
    }
  });
});
