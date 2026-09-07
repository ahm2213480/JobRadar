import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/prisma';
import { startJobScheduler } from './scheduler';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`JobRadar API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  if (!env.DATABASE_URL) {
    logger.warn('DATABASE_URL is not configured — database-dependent features are disabled until it is set in server/.env');
  } else {
    startJobScheduler();
  }
});

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Force-exit if connections do not drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception — exiting', error);
  process.exit(1);
});
