/**
 * Driver Sequelize Model
 *
 * Persistence layer for the driver aggregate.
 * Stores current state, current location (embedded for fast reads), and version for optimistic locking.
 */

import { createId } from "@paralleldrive/cuid2";
import { DataTypes, Model, type Sequelize } from "sequelize";
import {
  DRIVER_STATES,
  type DriverState,
} from "../../../domain/driver-states.js";

/**
 * Driver model attributes (all columns)
 */
export interface DriverAttributes {
  id: string;
  tenant_id: string;
  state: DriverState;
  version: number;
  // Current location embedded (nullable as a group)
  current_location_latitude: number | null;
  current_location_longitude: number | null;
  current_location_accuracy_meters: number | null;
  current_location_bearing_degrees: number | null;
  current_location_speed_mps: number | null;
  current_location_recorded_at: Date | null;
  // Domain timestamps
  registered_at: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Attributes required when creating a new driver
 */
export interface DriverCreationAttributes {
  id?: string;
  tenant_id: string;
  state?: DriverState;
  version?: number;
  current_location_latitude?: number | null;
  current_location_longitude?: number | null;
  current_location_accuracy_meters?: number | null;
  current_location_bearing_degrees?: number | null;
  current_location_speed_mps?: number | null;
  current_location_recorded_at?: Date | null;
  registered_at?: Date;
}

/**
 * Driver Model class
 */
export class DriverModel
  extends Model<DriverAttributes, DriverCreationAttributes>
  implements DriverAttributes
{
  declare id: string;
  declare tenant_id: string;
  declare state: DriverState;
  declare version: number;
  declare current_location_latitude: number | null;
  declare current_location_longitude: number | null;
  declare current_location_accuracy_meters: number | null;
  declare current_location_bearing_degrees: number | null;
  declare current_location_speed_mps: number | null;
  declare current_location_recorded_at: Date | null;
  declare registered_at: Date;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

/**
 * Initialize the Driver model with Sequelize instance
 *
 * @param sequelize - Sequelize instance
 * @returns Initialized DriverModel
 */
export const initDriverModel = (sequelize: Sequelize): typeof DriverModel => {
  DriverModel.init(
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
      state: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: DRIVER_STATES.OFFLINE,
        validate: {
          isValidState(value: string) {
            const validStates = Object.values(DRIVER_STATES);
            if (!validStates.includes(value as DriverState)) {
              throw new Error(`Invalid driver state: ${value}`);
            }
          },
        },
      },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      current_location_latitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
        field: "current_location_latitude",
      },
      current_location_longitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
        field: "current_location_longitude",
      },
      current_location_accuracy_meters: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: true,
        field: "current_location_accuracy_meters",
      },
      current_location_bearing_degrees: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: true,
        field: "current_location_bearing_degrees",
      },
      current_location_speed_mps: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: true,
        field: "current_location_speed_mps",
      },
      current_location_recorded_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "current_location_recorded_at",
      },
      registered_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: "registered_at",
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
      tableName: "drivers",
      timestamps: true,
      underscored: true,
      indexes: [
        {
          fields: ["tenant_id"],
          name: "idx_drivers_tenant",
        },
        {
          fields: ["tenant_id", "state"],
          name: "idx_drivers_tenant_state",
        },
      ],
    }
  );

  return DriverModel;
};
