import { PrismaClient } from '@prisma/client';
import { env } from './env';

/**
 * Appends fast-fail connection parameters to the DATABASE_URL so requests
 * against a cold/sleeping server (Neon free tier) fail quickly instead of
 * hanging the whole job sync inside a Prisma query. Existing parameters are
 * preserved.
 */
function withConnectionDefaults(url: string): string {
  try {
    const u = new URL(url);
    const add = (key: string, value: string): void => {
      if (!u.searchParams.has(key)) u.searchParams.set(key, value);
    };
    add('connect_timeout', '10'); // seconds — fail fast when DB is cold
    add('pool_timeout', '5'); // seconds — don't wait forever for a pool slot
    add('connection_limit', '5');
    if (!u.searchParams.has('sslmode')) u.searchParams.set('sslmode', 'require');
    return u.toString();
  } catch {
    return url; // unparseable URL — let Prisma surface its own error
  }
}

// Reuse a single PrismaClient across hot reloads in development to avoid
// exhausting database connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: env.DATABASE_URL ? withConnectionDefaults(env.DATABASE_URL) : undefined,
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
