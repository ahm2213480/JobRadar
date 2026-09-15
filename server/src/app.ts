import { existsSync } from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import type { Express } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { apiRouter } from './routes';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');

  // Behind a PaaS reverse proxy (Render, Fly, Railway, Heroku) Express must
  // trust exactly that one hop. Without it req.ip is the proxy address, so
  // every visitor shares a single rate-limit bucket and express-rate-limit
  // rejects requests that carry X-Forwarded-For.
  app.set('trust proxy', 1);

  app.use(helmet());

  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
      credentials: true,
    }),
  );

  // Parses cookies so the auth refresh token (httpOnly) is reachable at
  // req.cookies.
  app.use(cookieParser());

  app.use(express.json({ limit: '1mb' }));

  if (env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  }

  // Generic safety net for the whole API. Tighter, per-endpoint limits are
  // applied on the credential endpoints in the auth router.
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );

  app.use('/api', apiRouter);

  // Single-service deploy: in production the API also serves the built SPA so
  // the browser only ever talks to one origin. That keeps the httpOnly refresh
  // cookie first-party (sameSite=strict) and removes CORS from the picture.
  // In development the Vite dev server serves the UI instead.
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (env.NODE_ENV === 'production' && existsSync(clientDist)) {
    app.use(express.static(clientDist));
    // react-router routes (e.g. /jobs/some-id) don't exist as files: fall back
    // to index.html. Registered as a path-less middleware because Express 5
    // rejects a bare "*" route pattern.
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
