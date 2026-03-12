/**
 * Standalone Sequelize connection for dbctl CLI.
 *
 * Creates a fresh, temporary Sequelize instance from DATABASE_URL.
 * This is NOT the app singleton — the CLI runs out-of-process.
 */

import { Sequelize } from "sequelize";

export const createConnection = (databaseUrl: string): Sequelize =>
  new Sequelize(databaseUrl, {
    dialect: "postgres",
    logging: false,
  });

export const getDatabaseUrl = (): string => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
};

export const withConnection = async <T>(
  fn: (sequelize: Sequelize) => Promise<T>
): Promise<T> => {
  const sequelize = createConnection(getDatabaseUrl());
  try {
    await sequelize.authenticate();
    return await fn(sequelize);
  } finally {
    await sequelize.close();
  }
};
