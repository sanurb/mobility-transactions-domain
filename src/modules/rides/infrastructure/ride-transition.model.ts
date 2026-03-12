/**
 * RideTransition Sequelize Model
 *
 * Audit trail for all ride state transitions.
 * Records from_state, to_state, who changed it, when, and why.
 * Essential for compliance, debugging, and analytics.
 */

import { createId } from "@paralleldrive/cuid2";
import { DataTypes, Model, type Sequelize } from "sequelize";
import type { ChangedByRole } from "../domain/ride-states.js";
import type { RideModel } from "./ride.model.js";

export type { ChangedByRole };

/**
 * RideTransition model attributes (all columns)
 */
export interface RideTransitionAttributes {
  id: string;
  ride_id: string;
  from_state: string;
  to_state: string;
  changed_by: string;
  changed_by_role: ChangedByRole;
  reason: string | null;
  correlation_id: string | null;
  created_at: Date;
}

/**
 * Attributes required when creating a new transition
 */
export interface RideTransitionCreationAttributes {
  id?: string;
  ride_id: string;
  from_state: string;
  to_state: string;
  changed_by: string;
  changed_by_role: ChangedByRole;
  reason?: string | null;
  correlation_id?: string | null;
}

/**
 * RideTransition Model class
 */
export class RideTransitionModel
  extends Model<RideTransitionAttributes, RideTransitionCreationAttributes>
  implements RideTransitionAttributes
{
  declare id: string;
  declare ride_id: string;
  declare from_state: string;
  declare to_state: string;
  declare changed_by: string;
  declare changed_by_role: ChangedByRole;
  declare reason: string | null;
  declare correlation_id: string | null;
  declare readonly created_at: Date;
}

/**
 * Initialize the RideTransition model with Sequelize instance
 *
 * @param sequelize - Sequelize instance
 * @param RideModel - RideModel for association setup
 * @returns Initialized RideTransitionModel
 */
export const initRideTransitionModel = (
  sequelize: Sequelize,
  RideModelClass: typeof RideModel
): typeof RideTransitionModel => {
  RideTransitionModel.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: () => createId(),
      },
      ride_id: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "ride_id",
        references: {
          model: "rides",
          key: "id",
        },
      },
      from_state: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "from_state",
      },
      to_state: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "to_state",
      },
      changed_by: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "changed_by",
      },
      changed_by_role: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "changed_by_role",
        validate: {
          isIn: [["rider", "driver", "system"]],
        },
      },
      reason: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      correlation_id: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "correlation_id",
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
      tableName: "ride_transitions",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false, // No updates allowed on audit trail
      underscored: true,
      indexes: [
        {
          fields: ["ride_id", "created_at"],
          name: "idx_ride_transitions_ride_created",
        },
        {
          fields: ["correlation_id"],
          name: "idx_ride_transitions_correlation",
        },
      ],
    }
  );

  // Set up associations
  RideTransitionModel.belongsTo(RideModelClass, {
    foreignKey: "ride_id",
    as: "ride",
  });

  RideModelClass.hasMany(RideTransitionModel, {
    foreignKey: "ride_id",
    as: "transitions",
  });

  return RideTransitionModel;
};
