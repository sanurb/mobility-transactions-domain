/**
 * PaymentIntent Sequelize Model
 *
 * Immutable persistence for payment intents.
 * Each ride can have exactly one payment intent (unique constraint on tenant_id + ride_id).
 * Stores complete payment context: rider, amount, fare breakdown snapshot.
 */

import { createId } from "@paralleldrive/cuid2";
import { DataTypes, Model, type Sequelize } from "sequelize";

/**
 * PaymentIntent model attributes (all columns)
 */
export interface PaymentIntentAttributes {
  id: string;
  tenant_id: string;
  ride_id: string;
  rider_id: string;
  amount_cop: number;
  currency: string;
  fare_base: number;
  fare_distance_component: number;
  fare_time_component: number;
  fare_minimum_applied: boolean;
  created_at_utc: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Attributes required when creating a payment intent
 */
export interface PaymentIntentCreationAttributes {
  id?: string;
  tenant_id: string;
  ride_id: string;
  rider_id: string;
  amount_cop: number;
  currency?: string;
  fare_base: number;
  fare_distance_component: number;
  fare_time_component: number;
  fare_minimum_applied: boolean;
  created_at_utc: Date;
}

/**
 * PaymentIntent Model class
 */
export class PaymentIntentModel
  extends Model<PaymentIntentAttributes, PaymentIntentCreationAttributes>
  implements PaymentIntentAttributes
{
  declare id: string;
  declare tenant_id: string;
  declare ride_id: string;
  declare rider_id: string;
  declare amount_cop: number;
  declare currency: string;
  declare fare_base: number;
  declare fare_distance_component: number;
  declare fare_time_component: number;
  declare fare_minimum_applied: boolean;
  declare created_at_utc: Date;
  declare readonly created_at: Date;
  declare readonly updated_at: Date;
}

/**
 * Initialize the PaymentIntent model with Sequelize instance
 *
 * @param sequelize - Sequelize instance
 * @returns Initialized PaymentIntentModel
 */
export const initPaymentIntentModel = (
  sequelize: Sequelize
): typeof PaymentIntentModel => {
  PaymentIntentModel.init(
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
      ride_id: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "ride_id",
      },
      rider_id: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "rider_id",
      },
      amount_cop: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "amount_cop",
        validate: {
          min: 0,
        },
      },
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        field: "currency",
        defaultValue: "COP",
      },
      fare_base: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fare_base",
      },
      fare_distance_component: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fare_distance_component",
      },
      fare_time_component: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "fare_time_component",
      },
      fare_minimum_applied: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        field: "fare_minimum_applied",
      },
      created_at_utc: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at_utc",
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
      tableName: "payment_intents",
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ["tenant_id", "ride_id"],
          name: "idx_payment_intents_tenant_ride_unique",
        },
        {
          fields: ["tenant_id", "rider_id"],
          name: "idx_payment_intents_tenant_rider",
        },
      ],
    }
  );

  return PaymentIntentModel;
};
