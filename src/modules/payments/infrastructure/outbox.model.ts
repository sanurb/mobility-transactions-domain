/**
 * Outbox Sequelize Model
 *
 * Transactional outbox for payment integration events.
 * Stores publish-ready envelopes with auditable metadata.
 *
 * Table: payment_outbox
 *
 * Guarantees:
 * - Atomic persistence with aggregate changes (same transaction)
 * - Ordered delivery (created_at_utc ordering)
 * - Retry tracking (publish_attempts, last_error)
 * - Audit trail (correlation/causation/aggregate metadata)
 */

import { randomUUID } from "node:crypto";
import { DataTypes, Model, type Sequelize } from "sequelize";

/**
 * Outbox model attributes (all columns)
 */
export interface OutboxAttributes {
  id: string;
  event_name: string;
  schema_version: string;
  aggregate_type: string;
  aggregate_id: string;
  correlation_id: string;
  causation_id: string | null;
  occurred_at_utc: Date;
  payload_json: string;
  created_at_utc: Date;
  published_at_utc: Date | null;
  publish_attempts: number;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Attributes required when creating an outbox record
 */
export interface OutboxCreationAttributes {
  id?: string;
  event_name: string;
  schema_version: string;
  aggregate_type: string;
  aggregate_id: string;
  correlation_id: string;
  causation_id?: string | null;
  occurred_at_utc: Date;
  payload_json: string;
  created_at_utc: Date;
  published_at_utc?: Date | null;
  publish_attempts?: number;
  last_error?: string | null;
}

/**
 * Outbox Model class
 */
export class OutboxModel
  extends Model<OutboxAttributes, OutboxCreationAttributes>
  implements OutboxAttributes
{
  declare id: string;
  declare event_name: string;
  declare schema_version: string;
  declare aggregate_type: string;
  declare aggregate_id: string;
  declare correlation_id: string;
  declare causation_id: string | null;
  declare occurred_at_utc: Date;
  declare payload_json: string;
  declare created_at_utc: Date;
  declare published_at_utc: Date | null;
  declare publish_attempts: number;
  declare last_error: string | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

/**
 * Initialize the Outbox model with Sequelize instance
 *
 * @param sequelize - Sequelize instance
 * @returns Initialized OutboxModel
 */
export const initOutboxModel = (sequelize: Sequelize): typeof OutboxModel => {
  OutboxModel.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: () => randomUUID(),
      },
      event_name: {
        type: DataTypes.STRING(128),
        allowNull: false,
        field: "event_name",
      },
      schema_version: {
        type: DataTypes.STRING(32),
        allowNull: false,
        field: "schema_version",
      },
      aggregate_type: {
        type: DataTypes.STRING(64),
        allowNull: false,
        field: "aggregate_type",
      },
      aggregate_id: {
        type: DataTypes.STRING(128),
        allowNull: false,
        field: "aggregate_id",
      },
      correlation_id: {
        type: DataTypes.STRING(128),
        allowNull: false,
        field: "correlation_id",
      },
      causation_id: {
        type: DataTypes.STRING(128),
        allowNull: true,
        field: "causation_id",
      },
      occurred_at_utc: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "occurred_at_utc",
      },
      payload_json: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: "payload_json",
      },
      created_at_utc: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at_utc",
      },
      published_at_utc: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "published_at_utc",
      },
      publish_attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "publish_attempts",
        defaultValue: 0,
      },
      last_error: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "last_error",
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: "created_at",
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: "updated_at",
      },
    },
    {
      sequelize,
      tableName: "payment_outbox",
      timestamps: true,
      underscored: true,
      indexes: [
        {
          // Polling unpublished events
          fields: ["published_at_utc", "created_at_utc"],
          name: "idx_payment_outbox_unpublished",
        },
        {
          // Replay/debug by aggregate
          fields: ["aggregate_type", "aggregate_id", "occurred_at_utc"],
          name: "idx_payment_outbox_aggregate",
        },
        {
          // Tracing by correlation
          fields: ["correlation_id"],
          name: "idx_payment_outbox_correlation",
        },
      ],
    }
  );

  return OutboxModel;
};
