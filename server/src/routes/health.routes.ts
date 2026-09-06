import { Router } from 'express';
import { env } from '../config/env';
import { prisma } from '../config/prisma';

type DatabaseStatus = 'connected' | 'not_configured' | 'unreachable';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  let database: DatabaseStatus = 'not_configured';
  let httpStatus = 200;

  if (env.DATABASE_URL) {
    try {
      // Tagged-template query — parameterized by design, no string concatenation.
      await prisma.$queryRaw`SELECT 1`;
      database = 'connected';
    } catch {
      database = 'unreachable';
      httpStatus = 503;
    }
  }

  res.status(httpStatus).json({
    status: httpStatus === 200 ? 'ok' : 'degraded',
    service: 'jobradar-api',
    version: '0.1.0',
    environment: env.NODE_ENV,
    database,
    timestamp: new Date().toISOString(),
  });
});
