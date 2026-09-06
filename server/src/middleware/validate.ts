import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

/**
 * Middleware factory that validates (and replaces) req.body with the given
 * Zod schema. Invalid input is forwarded to the global error handler, which
 * returns a 400 with field-level details.
 */
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };
}
