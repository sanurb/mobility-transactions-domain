/**
 * DispatchAudit Sequelize Model
 *
 * Immutable evidence store for dispatch decisions.
 * Owned by DISPATCH bounded context - written through DispatchAuditWriter.
 * Not coupled to DriverRepositoryPort.
 */

import { createId } from "@paralleldrive/cuid2";
import { DataTypes, Model, type Sequelize } from "sequelize";

/**
 * Dispatch outcome enum
 */
export type DispatchOutcome =
  | "SUCCEEDED"
  | "CONFLICT"
  | "NO_ELIGIBLE"
  | "FAILED";

/**
 * DispatchAudit model attributes (all columns)
 */
export interface DispatchAuditAttributes {
  id: string;
  tenant_id: string;
  correlation_id: string;
  ride_id: string;
  selected_driver_id: string | null;
  candidates_json: string;
  candidates_count: number;
  selection_criteria: string;
  search_radius_meters: number;
  search_center_latitude: number;
  search_center_longitude: number;
  outcome: DispatchOutcome;
  failure_code: string | null;
  dispatched_at: Date;
  created_at: Date;
}

/**
 * Attributes required when creating a new dispatch audit
 */
export interface DispatchAuditCreationAttributes {
  id?: string;
  tenant_id: string;
  correlation_id: string;
  ride_id: string;
  selected_driver_id?: string | null;
  candidates_json: string;
  candidates_count: number;
  selection_criteria: string;
  search_radius_meters: number;
  search_center_latitude: number;
  search_center_longitude: number;
  outcome: DispatchOutcome;
  failure_code?: string | null;
  dispatched_at: Date;
}

/**
 * DispatchAudit Model class
 */
export class DispatchAuditModel
  extends Model<DispatchAuditAttributes, DispatchAuditCreationAttributes>
  implements DispatchAuditAttributes
{
  declare id: string;
  declare tenant_id: string;
  declare correlation_id: string;
  declare ride_id: string;
  declare selected_driver_id: string | null;
  declare candidates_json: string;
  declare candidates_count: number;
  declare selection_criteria: string;
  declare search_radius_meters: number;
  declare search_center_latitude: number;
  declare search_center_longitude: number;
  declare outcome: DispatchOutcome;
  declare failure_code: string | null;
  declare dispatched_at: Date;
  declare readonly created_at: Date;
}

/**
 * Initialize the DispatchAudit model with Sequelize instance
 *
 * @param sequelize - Sequelize instance
 * @returns Initialized DispatchAuditModel
 */
export const initDispatchAuditModel = (
  sequelize: Sequelize
): typeof DispatchAuditModel => {
  DispatchAuditModel.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: () => createId(),
      },
      tenant_id: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "tenant_id",
      },
      correlation_id: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "correlation_id",
      },
      ride_id: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "ride_id",
      },
      selected_driver_id: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "selected_driver_id",
      },
      candidates_json: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: "candidates_json",
      },
      candidates_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "candidates_count",
      },
      selection_criteria: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "selection_criteria",
      },
      search_radius_meters: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "search_radius_meters",
      },
      search_center_latitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
        field: "search_center_latitude",
      },
      search_center_longitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
        field: "search_center_longitude",
      },
      outcome: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isIn: [["SUCCEEDED", "CONFLICT", "NO_ELIGIBLE", "FAILED"]],
        },
      },
      failure_code: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "failure_code",
      },
      dispatched_at: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "dispatched_at",
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: "created_at",
      },
    },
    {
      sequelize,
      tableName: "dispatch_audits",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false, // Immutable evidence store
      underscored: true,
      indexes: [
        {
          fields: ["tenant_id", "dispatched_at"],
          name: "idx_dispatch_audits_tenant_dispatched",
        },
        {
          fields: ["tenant_id", "correlation_id"],
          name: "idx_dispatch_audits_tenant_correlation",
          unique: true,
        },
      ],
    }
  );

  return DispatchAuditModel;
};
