/**
 * Ride Sequelize Model
 *
 * Persistence layer for the ride entity.
 * Stores current state, locations, rider/driver assignments, and version for optimistic locking.
 */

import { createId } from "@paralleldrive/cuid2";
import { DataTypes, Model, Op, type Sequelize } from "sequelize";
import { RIDE_STATES, type RideState } from "../domain/ride-states.js";

/**
 * Ride model attributes (all columns)
 */
export interface RideAttributes {
  id: string;
  tenant_id: string;
  rider_id: string;
  driver_id: string | null;
  state: RideState;
  version: number;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  requested_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Attributes required when creating a new ride
 */
export interface RideCreationAttributes {
  id?: string;
  tenant_id: string;
  rider_id: string;
  driver_id?: string | null;
  state?: RideState;
  version?: number;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  requested_at?: Date;
  started_at?: Date | null;
  completed_at?: Date | null;
  expires_at?: Date | null;
}

/**
 * Ride Model class
 */
export class RideModel
  extends Model<RideAttributes, RideCreationAttributes>
  implements RideAttributes
{
  declare id: string;
  declare tenant_id: string;
  declare rider_id: string;
  declare driver_id: string | null;
  declare state: RideState;
  declare version: number;
  declare pickup_lat: number;
  declare pickup_lng: number;
  declare dropoff_lat: number;
  declare dropoff_lng: number;
  declare requested_at: Date;
  declare started_at: Date | null;
  declare completed_at: Date | null;
  declare expires_at: Date | null;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

/**
 * Initialize the Ride model with Sequelize instance
 *
 * @param sequelize - Sequelize instance
 * @returns Initialized RideModel
 */
export const initRideModel = (sequelize: Sequelize): typeof RideModel => {
  RideModel.init(
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
      rider_id: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "rider_id",
      },
      driver_id: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "driver_id",
      },
      state: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: RIDE_STATES.CREATED,
        validate: {
          isValidState(value: string) {
            const validStates = Object.values(RIDE_STATES);
            if (!validStates.includes(value as RideState)) {
              throw new Error(`Invalid ride state: ${value}`);
            }
          },
        },
      },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      pickup_lat: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
        field: "pickup_lat",
      },
      pickup_lng: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
        field: "pickup_lng",
      },
      dropoff_lat: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
        field: "dropoff_lat",
      },
      dropoff_lng: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
        field: "dropoff_lng",
      },
      requested_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: "requested_at",
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "started_at",
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "completed_at",
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "expires_at",
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
      tableName: "rides",
      timestamps: true,
      underscored: true,
      indexes: [
        {
          fields: ["tenant_id", "rider_id"],
          name: "idx_rides_tenant_rider",
        },
        {
          fields: ["tenant_id", "driver_id"],
          name: "idx_rides_tenant_driver",
        },
        {
          fields: ["tenant_id", "state"],
          name: "idx_rides_tenant_state",
        },
        {
          fields: ["expires_at"],
          name: "idx_rides_expires_at",
          where: {
            expires_at: {
              [Op.ne]: null,
            },
          },
        },
      ],
    }
  );

  return RideModel;
};
