/**
 * DriverLocation Sequelize Model
 *
 * Immutable audit trail for all accepted driver location updates.
 * Records quality metadata for debugging and analytics.
 */

import { createId } from "@paralleldrive/cuid2";
import { DataTypes, Model, type Sequelize } from "sequelize";
import type { DriverModel } from "./driver.model.js";

/**
 * DriverLocation model attributes (all columns)
 */
export interface DriverLocationAttributes {
  id: string;
  driver_id: string;
  tenant_id: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  bearing_degrees: number;
  speed_mps: number;
  recorded_at: Date;
  created_at: Date;
}

/**
 * Attributes required when creating a new driver location
 */
export interface DriverLocationCreationAttributes {
  id?: string;
  driver_id: string;
  tenant_id: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  bearing_degrees: number;
  speed_mps: number;
  recorded_at: Date;
}

/**
 * DriverLocation Model class
 */
export class DriverLocationModel
  extends Model<DriverLocationAttributes, DriverLocationCreationAttributes>
  implements DriverLocationAttributes
{
  declare id: string;
  declare driver_id: string;
  declare tenant_id: string;
  declare latitude: number;
  declare longitude: number;
  declare accuracy_meters: number;
  declare bearing_degrees: number;
  declare speed_mps: number;
  declare recorded_at: Date;
  declare readonly created_at: Date;
}

/**
 * Initialize the DriverLocation model with Sequelize instance
 *
 * @param sequelize - Sequelize instance
 * @param DriverModelClass - DriverModel for association setup
 * @returns Initialized DriverLocationModel
 */
export const initDriverLocationModel = (
  sequelize: Sequelize,
  DriverModelClass: typeof DriverModel
): typeof DriverLocationModel => {
  DriverLocationModel.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
        defaultValue: () => createId(),
      },
      driver_id: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "driver_id",
        references: {
          model: "drivers",
          key: "id",
        },
      },
      tenant_id: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "tenant_id",
      },
      latitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
      },
      longitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
      },
      accuracy_meters: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: false,
        field: "accuracy_meters",
      },
      bearing_degrees: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        field: "bearing_degrees",
      },
      speed_mps: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: false,
        field: "speed_mps",
      },
      recorded_at: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "recorded_at",
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
      tableName: "driver_locations",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false, // Immutable audit trail
      underscored: true,
      indexes: [
        {
          fields: ["tenant_id", "recorded_at"],
          name: "idx_driver_locations_tenant_recorded",
        },
        {
          fields: ["driver_id", "recorded_at"],
          name: "idx_driver_locations_driver_recorded",
        },
      ],
    }
  );

  // Set up associations
  DriverLocationModel.belongsTo(DriverModelClass, {
    foreignKey: "driver_id",
    as: "driver",
  });

  DriverModelClass.hasMany(DriverLocationModel, {
    foreignKey: "driver_id",
    as: "locations",
  });

  return DriverLocationModel;
};
