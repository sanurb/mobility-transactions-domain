import { beforeEach, describe, expect, test } from "vitest";
import { InitiateSettlementUseCase } from "../../application/use-cases/initiate-settlement.js";
import { PaymentIntent } from "../../domain/payment-intent.aggregate.js";
import {
  FakeClock,
  FakeIdGenerator,
  FakeOutbox,
  FakePaymentProvider,
  FakePaymentRepository,
  FakeUnitOfWork,
} from "../helpers/faked-ports.js";
import {
  buildIdempotencyKey,
  buildPaymentIntentCreateInput,
} from "../helpers/payment-test-factories.js";

describe("InitiateSettlementUseCase", () => {
  let repo: FakePaymentRepository;
  let provider: FakePaymentProvider;
  let outbox: FakeOutbox;
  let clock: FakeClock;
  let uow: FakeUnitOfWork;
  let useCase: InitiateSettlementUseCase;
  let idGen: FakeIdGenerator;

  beforeEach(() => {
    repo = new FakePaymentRepository();
    provider = new FakePaymentProvider("SUCCEEDED", "provider-ref-123");
    outbox = new FakeOutbox();
    clock = new FakeClock("2026-02-13T10:00:00.000Z");
    uow = new FakeUnitOfWork();
    idGen = new FakeIdGenerator();
    useCase = new InitiateSettlementUseCase(
      uow,
      repo,
      provider,
      outbox,
      clock,
      idGen
    );
  });

  test("When policy allows and provider succeeds, then it records attempt with correct outcome", async () => {
    const createInput = buildPaymentIntentCreateInput();
    const intent = PaymentIntent.create({
      id: createInput.id,
      rideId: createInput.rideId,
      riderId: createInput.riderId,
      amountCOP: createInput.amountCOP,
      fareBreakdown: createInput.fareBreakdown,
      createdAtUTC: "2026-02-13T09:00:00.000Z",
    });
    intent.pullDomainEvents();
    await repo.save(intent, {} as never);

    const output = await useCase.execute({
      rideId: createInput.rideId,
      idempotencyKey: buildIdempotencyKey(),
      providerTokenRef: "token-123",
      correlationId: "corr-123",
    });

    expect(output.attemptNumber).toBe(1);
    expect(output.paymentIntentId).toBe(String(createInput.id));
  });

  test("When policy rejects, then it throws error", async () => {
    const createInput = buildPaymentIntentCreateInput();
    const intent = PaymentIntent.create({
      id: createInput.id,
      rideId: createInput.rideId,
      riderId: createInput.riderId,
      amountCOP: createInput.amountCOP,
      fareBreakdown: createInput.fareBreakdown,
      createdAtUTC: "2026-02-13T09:00:00.000Z",
    });
    intent.attemptSettlement({
      idempotencyKey: buildIdempotencyKey({ value: "attempt-1" }),
      outcome: "SUCCEEDED",
      providerRef: "provider-ref-123",
      reasonCode: null,
      initiatedAtUTC: "2026-02-13T09:01:00.000Z",
      completedAtUTC: "2026-02-13T09:01:05.000Z",
    });
    intent.pullDomainEvents();
    await repo.save(intent, {} as never);

    await expect(
      useCase.execute({
        rideId: createInput.rideId,
        idempotencyKey: buildIdempotencyKey({ value: "attempt-2" }),
        providerTokenRef: "token-456",
        correlationId: "corr-456",
      })
    ).rejects.toThrow();
  });

  test("When provider fails, then it records failed attempt and enqueues settlement.completed with outcome FAILED", async () => {
    const createInput = buildPaymentIntentCreateInput();
    const intent = PaymentIntent.create({
      id: createInput.id,
      rideId: createInput.rideId,
      riderId: createInput.riderId,
      amountCOP: createInput.amountCOP,
      fareBreakdown: createInput.fareBreakdown,
      createdAtUTC: "2026-02-13T09:00:00.000Z",
    });
    await repo.save(intent, {} as never);
    provider.setOutcome("FAILED", null, "provider_error");

    const output = await useCase.execute({
      rideId: createInput.rideId,
      idempotencyKey: buildIdempotencyKey(),
      providerTokenRef: "token-123",
      correlationId: "corr-123",
    });

    expect(output.outcome).toBe("FAILED");
    expect(output.attemptNumber).toBe(1);
    expect(outbox.enqueued.length).toBeGreaterThan(0);
  });
});
