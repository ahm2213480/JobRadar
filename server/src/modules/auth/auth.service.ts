import bcrypt from 'bcryptjs';
import { Prisma, type User } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { verifyRefreshToken } from './auth.tokens';
import type { LoginInput, RegisterInput } from './auth.schemas';

const BCRYPT_ROUNDS = 12;

/** Fields safe to expose in API responses (never the password hash). */
export function toPublicUser(user: User): {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: Date;
} {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export async function registerUser(input: RegisterInput): Promise<User> {
  const email = input.email.toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  try {
    return await prisma.user.create({
      data: { email, passwordHash, fullName: input.fullName },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new AppError(409, 'An account with this email already exists');
    }
    throw error;
  }
}

export async function authenticateUser(input: LoginInput): Promise<User> {
  const email = input.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Same generic message for unknown email and wrong password.
    throw new AppError(401, 'Invalid email or password');
  }
  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError(401, 'Invalid email or password');
  }
  return user;
}

export async function getSessionUser(userId: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id: userId } });
}

/**
 * Issues a new token pair for a presented refresh token. Verifies the token
 * signature and that its tokenVersion still matches the user's — a mismatch
 * means the session was revoked (logout / logout-everywhere).
 */
export async function rotateSession(refreshToken: string): Promise<User> {
  const payload = verifyRefreshToken(refreshToken);
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.tokenVersion !== payload.tv) {
    throw new AppError(401, 'Session is no longer valid');
  }
  return user;
}

/** Invalidates every outstanding refresh token for the user. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
}

/**
 * Logout helper: revokes the session family behind the presented refresh
 * cookie. Invalid/expired cookies are ignored — logout is always idempotent.
 */
export async function revokeSessionFromToken(refreshToken: string): Promise<void> {
  try {
    const payload = verifyRefreshToken(refreshToken);
    await revokeAllSessions(payload.sub);
  } catch (error) {
    if (error instanceof AppError) {
      return;
    }
    throw error;
  }
}
