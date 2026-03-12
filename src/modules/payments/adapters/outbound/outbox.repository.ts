import { InfrastructureError } from "../../../../shared/errors/error-types.js";
import type { ClockPort } from "../../application/ports/clock.port.js";
import type {
  OutboxEnvelope,
  OutboxPort,
  OutboxRecord,
} from "../../application/ports/outbox.port.js";
import type {
  PaymentsTx,
  PaymentsTxContext,
} from "../../application/ports/unit-of-work.port.js";
import { OutboxModel } from "../../infrastructure/outbox.model.js";

/**
 * Sequelize Outbox Repository
 *
 * Implements outbox pattern for reliable event publishing.
 * Stores publish-ready envelopes with transaction support.
 *
 * DESIGN:
 * - payload_json MUST be JSON.stringify(envelope.payload)
 * - created_at_utc from ClockPort (deterministic, testable)
 * - Resolves opaque PaymentsTx via injected PaymentsTxContext
 */
export class OutboxRepository implements OutboxPort {
  readonly #txContext: PaymentsTxContext;
  readonly #clock: ClockPort;

  constructor(txContext: PaymentsTxContext, clock: ClockPort) {
    this.#txContext = txContext;
    this.#clock = clock;
  }

  /**
   * Enqueue outbox envelopes within transaction.
   */
  async enqueue(
    envelopes: readonly OutboxEnvelope[],
    tx: PaymentsTx
  ): Promise<void> {
    try {
      const transaction = this.#txContext.resolveSequelizeTx(tx) as any;
      const now = this.#clock.nowUTC();

      const records = envelopes.map((envelope) => ({
        id: envelope.id,
        event_name: envelope.eventName,
        schema_version: envelope.schemaVersion,
        aggregate_type: envelope.aggregateType,
        aggregate_id: envelope.aggregateId,
        correlation_id: envelope.correlationId,
        causation_id: envelope.causationId,
        occurred_at_utc: new Date(envelope.occurredAtUTC),
        payload_json: JSON.stringify(envelope.payload),
        created_at_utc: new Date(now),
        published_at_utc: null,
        publish_attempts: 0,
        last_error: null,
      }));

      await OutboxModel.bulkCreate(records, { transaction });
    } catch (error) {
      throw new InfrastructureError(
        `Failed to enqueue outbox records: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Fetch unpublished outbox records.
   * Returns records in creation order (FIFO).
   */
  async fetchUnpublished(limit: number): Promise<readonly OutboxRecord[]> {
    try {
      const models = await OutboxModel.findAll({
        where: {
          published_at_utc: null,
        },
        order: [["created_at_utc", "ASC"]],
        limit,
      });

      return models.map((model) => this.#mapToRecord(model));
    } catch (error) {
      throw new InfrastructureError(
        `Failed to fetch unpublished outbox records: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Mark outbox records as successfully published.
   */
  async markPublished(
    ids: readonly string[],
    publishedAtUTC: string
  ): Promise<void> {
    try {
      await OutboxModel.update(
        {
          published_at_utc: new Date(publishedAtUTC),
        },
        {
          where: {
            id: ids as string[],
          },
        }
      );
    } catch (error) {
      throw new InfrastructureError(
        `Failed to mark outbox records as published: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Mark outbox record as failed to publish.
   */
  async markFailed(
    id: string,
    error: string,
    failedAtUTC: string
  ): Promise<void> {
    try {
      const model = await OutboxModel.findByPk(id);

      if (!model) {
        throw new InfrastructureError(`Outbox record not found: ${id}`);
      }

      await model.update({
        publish_attempts: model.publish_attempts + 1,
        last_error: error,
      });
    } catch (error_) {
      throw new InfrastructureError(
        `Failed to mark outbox record as failed: ${error_ instanceof Error ? error_.message : String(error_)}`
      );
    }
  }

  /**
   * Map Sequelize model to OutboxRecord.
   */
  #mapToRecord(model: OutboxModel): OutboxRecord {
    return {
      id: model.id,
      eventName: model.event_name,
      schemaVersion: model.schema_version,
      aggregateType: model.aggregate_type,
      aggregateId: model.aggregate_id,
      correlationId: model.correlation_id,
      causationId: model.causation_id,
      occurredAtUTC: model.occurred_at_utc.toISOString(),
      payload: JSON.parse(model.payload_json) as unknown,
      createdAtUTC: model.created_at_utc.toISOString(),
      publishedAtUTC: model.published_at_utc
        ? model.published_at_utc.toISOString()
        : null,
      publishAttempts: model.publish_attempts,
      lastError: model.last_error,
    };
  }
}
