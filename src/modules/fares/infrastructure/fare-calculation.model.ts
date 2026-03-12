/**
 * FareCalculation Sequelize Model
 *
 * Immutable persistence layer for fare calculations.
 * Each ride can have exactly one fare calculation (unique constraint on ride_id).
 * Stores complete audit trail: inputs, outputs, pricing version, and calculation timestamp.
 */

import { createId } from "@paralleldrive/cuid2";
import { DataTypes, Model, type Sequelize } from "sequelize";

/**
 * FareCalculation model attributes (all columns)
 */
export interface FareCalculationAttributes {
  id: string;
  ride_id: string;
  tenant_id: string;
  base_fare_cop: number;
  distance_km: number;
  duration_minutes: number;
  distance_component_cop: number;
  time_component_cop: number;
  total_fare_cop: number;
  minimum_applied: boolean;
  pricing_version: string;
  calculated_at: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Attributes required when creating a fare calculation
 */
export interface FareCalculationCreationAttributes {
  id?: string;
  ride_id: string;
  tenant_id: string;
  base_fare_cop: number;
  distance_km: number;
  duration_minutes: number;
  distance_component_cop: number;
  time_component_cop: number;
  total_fare_cop: number;
  minimum_applied: boolean;
  pricing_version: string;
  calculated_at: Date;
}

/**
 * FareCalculation Model class
 */
export class FareCalculationModel
  extends Model<FareCalculationAttributes, FareCalculationCreationAttributes>
  implements FareCalculationAttributes
{
  declare id: string;
  declare ride_id: string;
  declare tenant_id: string;
  declare base_fare_cop: number;
  declare distance_km: number;
  declare duration_minutes: number;
  declare distance_component_cop: number;
  declare time_component_cop: number;
  declare total_fare_cop: number;
  declare minimum_applied: boolean;
  declare pricing_version: string;
  declare calculated_at: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

/**
 * Initialize the FareCalculation model with Sequelize instance
 *
 * @param sequelize - Sequelize instance
 * @returns Initialized FareCalculationModel
 */
export const initFareCalculationModel = (
  sequelize: Sequelize
): typeof FareCalculationModel => {
  FareCalculationModel.init(
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
      },
      tenant_id: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "tenant_id",
      },
      base_fare_cop: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "base_fare_cop",
        validate: {
          min: 0,
        },
      },
      distance_km: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
        field: "distance_km",
        validate: {
          min: 0,
        },
      },
      duration_minutes: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
        field: "duration_minutes",
        validate: {
          min: 0,
        },
      },
      distance_component_cop: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "distance_component_cop",
      },
      time_component_cop: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "time_component_cop",
      },
      total_fare_cop: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "total_fare_cop",
      },
      minimum_applied: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        field: "minimum_applied",
      },
      pricing_version: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "pricing_version",
      },
      calculated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "calculated_at",
      },
      createdAt: {
        type: DataTypes.DATE,
        field: "created_at",
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: "updated_at",
      },
    },
    {
      sequelize,
      tableName: "fare_calculations",
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ["tenant_id", "ride_id"],
          name: "idx_fare_calculations_tenant_ride_unique",
        },
        {
          fields: ["tenant_id"],
          name: "idx_fare_calculations_tenant",
        },
      ],
    }
  );

  return FareCalculationModel;
};
