import { beforeEach, describe, expect, test } from "vitest";
import { MoneyCOP } from "../../../../shared/domain/value-objects/money-cop.js";
import {
  unsafePaymentIntentId,
  unsafeRideId,
  unsafeRiderId,
} from "../../../../shared/types/ids/index.js";
import { CreatePaymentIntentUseCase } from "../../application/use-cases/create-payment-intent.js";
import { PaymentIntent } from "../../domain/payment-intent.aggregate.js";
import {
  FakeClock,
  FakeIdGenerator,
  FakeOutbox,
  FakePaymentRepository,
  FakeUnitOfWork,
} from "../helpers/faked-ports.js";
import {
  buildFareBreakdown,
  buildPaymentIntentCreateInput,
} from "../helpers/payment-test-factories.js";

describe("CreatePaymentIntentUseCase", () => {
  let repo: FakePaymentRepository;
  let outbox: FakeOutbox;
  let clock: FakeClock;
  let uow: FakeUnitOfWork;
  let useCase: CreatePaymentIntentUseCase;
  let idGen: FakeIdGenerator;

  beforeEach(() => {
    repo = new FakePaymentRepository();
    outbox = new FakeOutbox();
    clock = new FakeClock("2026-02-13T10:00:00.000Z");
    uow = new FakeUnitOfWork();
    idGen = new FakeIdGenerator();
    useCase = new CreatePaymentIntentUseCase(uow, repo, outbox, clock, idGen);
  });

  test("When creating intent for a new ride, then it saves aggregate and enqueues 1 integration event envelope", async () => {
    const input = buildPaymentIntentCreateInput();

    const output = await useCase.execute(input);

    expect(output.paymentIntentId).toBe(input.id);
    expect(output.amountCOP).toBe(input.amountCOP.amount);
    expect(outbox.enqueued).toHaveLength(1);
  });

  test("When creating intent for an existing ride, then it returns existing", async () => {
    const rideId = unsafeRideId("existing-ride-456");
    const existingIntent = PaymentIntent.create({
      id: unsafePaymentIntentId("existing-intent-456"),
      rideId,
      riderId: unsafeRiderId("rider-456"),
      amountCOP: MoneyCOP.fromTrusted(30_000),
      fareBreakdown: buildFareBreakdown(),
      createdAtUTC: "2026-02-13T09:00:00.000Z",
    });
    existingIntent.pullDomainEvents();
    await repo.save(existingIntent, {} as never);

    const output = await useCase.execute(
      buildPaymentIntentCreateInput({ rideId })
    );

    expect(output.paymentIntentId).toBe(existingIntent.id);
    expect(output.amountCOP).toBe(30_000);
  });
});
