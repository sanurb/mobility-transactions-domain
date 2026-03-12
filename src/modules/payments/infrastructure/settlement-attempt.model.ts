/**
 * SettlementAttempt Sequelize Model
 *
 * Write-once audit trail for settlement attempts.
 * Each attempt is immutable once created (no updates).
 * Unique constraint on [tenant_id, idempotency_key] enables idempotent settlement operations.
 */

import { createId } from "@paralleldrive/cuid2";
import { DataTypes, Model, type Sequelize } from "sequelize";

/**
 * SettlementAttempt model attributes (all columns)
 */
export interface SettlementAttemptAttributes {
  id: string;
  payment_intent_id: string;
  tenant_id: string;
  attempt_number: number;
  idempotency_key: string;
  outcome: string;
  provider_ref: string | null;
  reason_code: string | null;
  initiated_at_utc: Date;
  completed_at_utc: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Attributes required when creating a settlement attempt
 */
export interface SettlementAttemptCreationAttributes {
  id?: string;
  payment_intent_id: string;
  tenant_id: string;
  attempt_number: number;
  idempotency_key: string;
  outcome: string;
  provider_ref?: string | null;
  reason_code?: string | null;
  initiated_at_utc: Date;
  completed_at_utc?: Date | null;
}

/**
 * SettlementAttempt Model class
 */
export class SettlementAttemptModel
  extends Model<
    SettlementAttemptAttributes,
    SettlementAttemptCreationAttributes
  >
  implements SettlementAttemptAttributes
{
  declare id: string;
  declare payment_intent_id: string;
  declare tenant_id: string;
  declare attempt_number: number;
  declare idempotency_key: string;
  declare outcome: string;
  declare provider_ref: string | null;
  declare reason_code: string | null;
  declare initiated_at_utc: Date;
  declare completed_at_utc: Date | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

/**
 * Initialize the SettlementAttempt model with Sequelize instance
 *
 * @param sequelize - Sequelize instance
 * @returns Initialized SettlementAttemptModel
 */
export const initSettlementAttemptModel = (
  sequelize: Sequelize
): typeof SettlementAttemptModel => {
  SettlementAttemptModel.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: () => createId(),
      },
      payment_intent_id: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "payment_intent_id",
      },
      tenant_id: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "tenant_id",
      },
      attempt_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "attempt_number",
        validate: {
          min: 1,
        },
      },
      idempotency_key: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "idempotency_key",
      },
      outcome: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "outcome",
      },
      provider_ref: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "provider_ref",
      },
      reason_code: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "reason_code",
      },
      initiated_at_utc: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "initiated_at_utc",
      },
      completed_at_utc: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "completed_at_utc",
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
      tableName: "settlement_attempts",
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ["tenant_id", "idempotency_key"],
          name: "idx_settlement_attempts_tenant_idempotency_unique",
        },
        {
          fields: ["payment_intent_id"],
          name: "idx_settlement_attempts_payment_intent",
        },
        {
          fields: ["tenant_id", "outcome"],
          name: "idx_settlement_attempts_tenant_outcome",
        },
      ],
    }
  );

  return SettlementAttemptModel;
};
