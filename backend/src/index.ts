import { createServer } from 'node:http';
import { initSentry } from './config/sentry';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/db';
import { env } from './config/env';
import { logger } from './config/logger';
import { initSocket } from './realtime/socket';

/**
 * Server bootstrap: connect DB → build app → attach Socket.io → listen.
 * Handles graceful shutdown so in-flight requests drain and the DB closes
 * cleanly on SIGTERM/SIGINT (important for zero-downtime deploys).
 */
async function bootstrap(): Promise<void> {
  initSentry();
  await connectDatabase();

  const app = createApp();
  const server = createServer(app);
  initSocket(server);

  server.listen(env.PORT, () => {
    logger.info(`🚀 KDS API listening on ${env.API_URL} (${env.NODE_ENV})`);
    logger.info(`📚 Docs at ${env.API_URL}/docs`);
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down gracefully…');
    server.close(async () => {
      await disconnectDatabase();
      logger.info('Shutdown complete');
      process.exit(0);
    });
    // Force-exit if it hangs.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) =>
    logger.error({ reason }, 'Unhandled promise rejection'),
  );
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — exiting');
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
