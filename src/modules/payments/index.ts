/**
 * Payments Module
 *
 * Wires hexagonal ports, adapters, use cases, event handlers, and routes.
 * All payment orchestration flows through use cases — no legacy service layer.
 */

import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import type { Sequelize } from "sequelize";
import type { IEventBus } from "../../shared/infrastructure/events/event-bus.js";
import { DOMAIN_EVENT_TYPES } from "../../shared/infrastructure/events/event-types.js";
import { createPaymentJsonApiRoutes } from "./adapters/inbound/index.js";
import { createMockPaymentProvider } from "./adapters/outbound/mock-payment-provider.js";
import { OutboxRepository } from "./adapters/outbound/outbox.repository.js";
import { PaymentRepository } from "./adapters/outbound/payment.repository.js";
import { SequelizeUnitOfWork } from "./adapters/outbound/sequelize-unit-of-work.js";
import { SystemClock } from "./adapters/outbound/system-clock.js";
import {
  CreatePaymentIntentUseCase,
  GetPaymentStatusUseCase,
  GetSupportEvidenceUseCase,
  GetUserReceiptUseCase,
  InitiateSettlementUseCase,
} from "./application/use-cases/index.js";
import { createPaymentOnFareCalculatedHandler } from "./event-handlers/payment-on-fare-calculated.js";
import {
  initOutboxModel,
  initPaymentIntentModel,
  initSettlementAttemptModel,
} from "./infrastructure/index.js";

/**
 * Injected from rides module to avoid circular dependency.
 * Returns null when ride not found.
 */
export type GetRiderIdFn = (
  rideId: string,
  tenantId?: string
) => Promise<string | null>;

export const initPaymentModule = (
  sequelize: Sequelize,
  eventBus: IEventBus,
  getRiderId: GetRiderIdFn
): {
  paymentRoutes: FastifyPluginAsync;
} => {
  initPaymentIntentModel(sequelize);
  initSettlementAttemptModel(sequelize);
  initOutboxModel(sequelize);

  const uow = new SequelizeUnitOfWork(sequelize);
  const clock = new SystemClock();
  const repo = new PaymentRepository(uow);
  const outbox = new OutboxRepository(uow, clock);
  const paymentProvider = createMockPaymentProvider(clock);
  const idGen = { generate: randomUUID };

  const createPaymentIntent = new CreatePaymentIntentUseCase(
    uow,
    repo,
    outbox,
    clock,
    idGen
  );
  const initiateSettlement = new InitiateSettlementUseCase(
    uow,
    repo,
    paymentProvider,
    outbox,
    clock,
    idGen
  );
  const getUserReceipt = new GetUserReceiptUseCase(repo);
  const getSupportEvidence = new GetSupportEvidenceUseCase(repo);
  const getPaymentStatus = new GetPaymentStatusUseCase(repo);

  const paymentRoutes = createPaymentJsonApiRoutes({
    createPaymentIntent,
    initiateSettlement,
    getUserReceipt,
    getSupportEvidence,
    getPaymentStatus,
  });

  const paymentOnFareCalculatedHandler = createPaymentOnFareCalculatedHandler(
    createPaymentIntent,
    getRiderId
  );

  eventBus.subscribe(
    DOMAIN_EVENT_TYPES.FARE_CALCULATED,
    paymentOnFareCalculatedHandler
  );

  return {
    paymentRoutes,
  };
};

export type { PaymentProviderPort } from "./application/ports/payment-provider.port.js";
export type {
  PaymentIntentDTO,
  SettlementAttemptDTO,
} from "./infrastructure/payment.repository.js";
