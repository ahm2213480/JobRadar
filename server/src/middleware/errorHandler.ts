import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
import { AppError } from '../utils/AppError';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      details: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File too large — maximum size is 5 MB'
        : `Upload error: ${err.message}`;
    res.status(400).json({ error: message });
    return;
  }

  // SECURITY: log details server-side only; return a generic message to the
  // client so internal errors are never leaked.
  logger.error(
    'Unhandled error',
    err instanceof Error ? { message: err.message, stack: err.stack } : err,
  );
  res.status(500).json({ error: 'Internal server error' });
}
