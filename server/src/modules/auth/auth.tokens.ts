import type { Role } from '@prisma/client';
import type { Response } from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  tv: number;
}

export interface RefreshTokenPayload {
  sub: string;
  tv: number;
  /** Unique id — guarantees real rotation between issued refresh tokens. */
  jti?: string;
}

export const REFRESH_COOKIE_NAME = 'jobradar_refresh';
// Refresh cookie is scoped to the auth endpoints only — the browser never
// sends it with regular API calls.
const REFRESH_COOKIE_PATH = '/api/auth';

/** Converts a Prisma-style expiry string ("15m", "7d", "12h") to ms. */
function expiryToMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }
  const unitMs: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return Number(match[1]) * unitMs[match[2]];
}

export function signAccessToken(user: {
  id: string;
  role: Role;
  tokenVersion: number;
}): string {
  const payload: AccessTokenPayload = {
    sub: user.id,
    role: user.role,
    tv: user.tokenVersion,
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(user: {
  id: string;
  tokenVersion: number;
}): string {
  const payload: RefreshTokenPayload = {
    sub: user.id,
    tv: user.tokenVersion,
    // jti makes every issued refresh token unique — rotation is real even
    // when two tokens are signed within the same second.
    jti: randomUUID(),
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

function parsePayload(decoded: unknown): Record<string, unknown> {
  if (typeof decoded === 'string' || decoded === null || typeof decoded !== 'object') {
    throw new AppError(401, 'Invalid or expired token');
  }
  return decoded as Record<string, unknown>;
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = parsePayload(jwt.verify(token, env.JWT_ACCESS_SECRET));
    if (typeof payload.sub !== 'string' || typeof payload.tv !== 'number') {
      throw new AppError(401, 'Invalid or expired token');
    }
    return {
      sub: payload.sub,
      role: payload.role as Role,
      tv: payload.tv,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(401, 'Invalid or expired token');
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const payload = parsePayload(jwt.verify(token, env.JWT_REFRESH_SECRET));
    if (typeof payload.sub !== 'string' || typeof payload.tv !== 'number') {
      throw new AppError(401, 'Invalid or expired session');
    }
    return { sub: payload.sub, tv: payload.tv };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(401, 'Invalid or expired session');
  }
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    maxAge: expiryToMs(env.JWT_REFRESH_EXPIRES_IN),
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
  });
}
