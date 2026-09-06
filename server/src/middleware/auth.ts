import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { verifyAccessToken } from '../modules/auth/auth.tokens';
import { AppError } from '../utils/AppError';

/**
 * Guards endpoints that require an authenticated user. Expects an
 * "Authorization: Bearer <accessToken>" header, verifies it, and re-checks
 * the user's tokenVersion so revoked sessions are rejected immediately.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new AppError(401, 'Authentication required');
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new AppError(401, 'Authentication required');
    }

    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, tokenVersion: true },
    });
    if (!user || user.tokenVersion !== payload.tv) {
      throw new AppError(401, 'Session is no longer valid');
    }

    req.user = { id: user.id, role: user.role };
    next();
  } catch (error) {
    next(error);
  }
}
