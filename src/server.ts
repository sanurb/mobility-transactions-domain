import { bootstrap } from "./bootstrap/bootstrap.js";
import { config } from "./config/index.js";

export const startServer = async (): Promise<void> => {
  const { app, logger, shutdown } = await bootstrap();

  let shuttingDown = false;
  const shutdownOnce = async (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    try {
      await shutdown(signal);
    } finally {
      // no process.exit aquí
    }
  };

  process.on("SIGTERM", () => void shutdownOnce("SIGTERM"));
  process.on("SIGINT", () => void shutdownOnce("SIGINT"));

  try {
    await app.listen({ port: config.server.port, host: "0.0.0.0" });
    logger.info({ port: config.server.port }, "Server started");
  } catch (err) {
    logger.fatal({ err }, "Server startup failed");
    // throw para que el main decida
    throw err;
  }
};
