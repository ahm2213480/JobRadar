import type { Request, Response } from 'express';
import type { User } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import {
  authenticateUser,
  getSessionUser,
  registerUser,
  revokeSessionFromToken,
  rotateSession,
  toPublicUser,
} from './auth.service';
import {
  REFRESH_COOKIE_NAME,
  clearRefreshCookie,
  setRefreshCookie,
  signAccessToken,
  signRefreshToken,
} from './auth.tokens';
import type { LoginInput, RegisterInput } from './auth.schemas';

/**
 * Sends the auth payload (public user + short-lived access token) and sets
 * the long-lived refresh token as an httpOnly cookie.
 */
function sendSession(res: Response, user: User, status: number): void {
  const accessToken = signAccessToken(user);
  setRefreshCookie(res, signRefreshToken(user));
  res.status(status).json({
    user: toPublicUser(user),
    accessToken,
  });
}

export async function register(req: Request, res: Response): Promise<void> {
  const user = await registerUser(req.body as RegisterInput);
  sendSession(res, user, 201);
}

export async function login(req: Request, res: Response): Promise<void> {
  const user = await authenticateUser(req.body as LoginInput);
  sendSession(res, user, 200);
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (!token) {
    throw new AppError(401, 'No active session');
  }
  try {
    const user = await rotateSession(token);
    const accessToken = signAccessToken(user);
    // Rotation: every refresh issues a new refresh token as well.
    setRefreshCookie(res, signRefreshToken(user));
    res.status(200).json({ accessToken });
  } catch (error) {
    clearRefreshCookie(res);
    throw error;
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (token) {
    await revokeSessionFromToken(token);
  }
  clearRefreshCookie(res);
  res.status(204).send();
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await getSessionUser(req.user!.id);
  if (!user) {
    throw new AppError(401, 'Session is no longer valid');
  }
  res.status(200).json({ user: toPublicUser(user) });
}
