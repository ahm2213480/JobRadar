import { once } from 'node:events';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { REFRESH_COOKIE_NAME } from './auth.tokens';

/**
 * End-to-end auth flow tests against the real Express app (plain Node fetch,
 * no extra test libraries). Requires DATABASE_URL — the whole suite is
 * skipped automatically when no database is configured. In CI it runs against
 * a Postgres service container after `prisma migrate deploy`; locally it uses
 * whatever server/.env points to.
 *
 * Safety: users are created only with the dedicated `jr-it-` email prefix and
 * deleted again afterwards — the rest of the database is never touched.
 *
 * Request budget: the credential endpoints are rate-limited to 20 attempts /
 * 15 min, so this file deliberately stays at ~16 requests per run.
 */

const RUNS_WITH_DB = Boolean(env.DATABASE_URL);
const TEST_EMAIL_PREFIX = 'jr-it-';
const PASSWORD = 'Password123';

const uniqueEmail = (): string =>
  `${TEST_EMAIL_PREFIX}${Date.now()}-${randomUUID().slice(0, 8)}@test.local`;

interface AuthSession {
  user: { id: string; email: string; fullName: string; role: string };
  accessToken: string;
  /** "jobradar_refresh=<jwt>" pair, ready for a Cookie header. */
  refreshCookie: string;
}

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = createApp();
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
}, 30_000);

afterAll(async () => {
  // Cascade deletes remove every row created through this user's relations.
  await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } });
  await prisma.$disconnect();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}, 30_000);

async function call(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** Raw Set-Cookie value for the refresh cookie (includes attributes). */
function rawRefreshCookie(res: Response): string {
  const match = res.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${REFRESH_COOKIE_NAME}=`));
  if (!match) {
    throw new Error(`No ${REFRESH_COOKIE_NAME} cookie in response`);
  }
  return match;
}

/** "name=value" pair extracted from a Set-Cookie value, for a Cookie header. */
function cookiePair(rawCookie: string): string {
  return rawCookie.split(';')[0];
}

function bearer(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

async function login(email: string, password: string): Promise<AuthSession> {
  const res = await call('POST', '/auth/login', { email, password });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { user: AuthSession['user']; accessToken: string };
  return {
    user: body.user,
    accessToken: body.accessToken,
    refreshCookie: cookiePair(rawRefreshCookie(res)),
  };
}

describe.skipIf(!RUNS_WITH_DB)('auth flow (integration)', () => {
  const email = uniqueEmail();
  let session: AuthSession;

  it('rejects invalid registration bodies with 400 and field-level details', async () => {
    const res = await call('POST', '/auth/register', {
      fullName: 'x',
      email: 'not-an-email',
      password: 'short',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: string;
      details: Array<{ path: string; message: string }>;
    };
    expect(body.error).toBe('Validation failed');
    expect(body.details.some((detail) => detail.path === 'password')).toBe(true);
    expect(body.details.some((detail) => detail.path === 'email')).toBe(true);
  });

  it('registers a user: public shape, access token and httpOnly refresh cookie', async () => {
    const res = await call('POST', '/auth/register', {
      fullName: 'Integration Tester',
      email,
      password: PASSWORD,
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      user: AuthSession['user'] & { passwordHash?: string };
      accessToken: string;
    };
    expect(body.user.email).toBe(email);
    expect(body.user.role).toBe('USER');
    expect(body.user.passwordHash).toBeUndefined();
    expect(typeof body.accessToken).toBe('string');

    const rawCookie = rawRefreshCookie(res);
    expect(rawCookie).toContain('HttpOnly');
    expect(rawCookie).toContain('Path=/api/auth');
    expect(rawCookie).toContain('SameSite=Strict');
    session = {
      user: body.user,
      accessToken: body.accessToken,
      refreshCookie: cookiePair(rawCookie),
    };
  });

  it('rejects a duplicate email with 409', async () => {
    const res = await call('POST', '/auth/register', {
      fullName: 'Integration Tester',
      email,
      password: PASSWORD,
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe(
      'An account with this email already exists',
    );
  });

  it('uses the same generic 401 for unknown email and wrong password', async () => {
    const unknownEmail = await call('POST', '/auth/login', {
      email: uniqueEmail(),
      password: PASSWORD,
    });
    const wrongPassword = await call('POST', '/auth/login', {
      email,
      password: 'WrongPassword123',
    });
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(((await unknownEmail.json()) as { error: string }).error).toBe('Invalid email or password');
    expect(((await wrongPassword.json()) as { error: string }).error).toBe('Invalid email or password');
  });

  it('logs in with valid credentials and returns a working session', async () => {
    session = await login(email, PASSWORD);
    expect(session.user.id).toBeTruthy();
    expect(session.accessToken).toBeTruthy();
  });

  it('GET /auth/me requires a bearer token (401 without one)', async () => {
    const res = await call('GET', '/auth/me');
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe('Authentication required');
  });

  it('GET /auth/me returns the session user with a valid access token', async () => {
    const res = await call('GET', '/auth/me', undefined, bearer(session.accessToken));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: AuthSession['user'] };
    expect(body.user.id).toBe(session.user.id);
    expect(body.user.email).toBe(email);
  });

  it('POST /auth/refresh rotates the session (new access token + new refresh cookie)', async () => {
    const previousCookie = session.refreshCookie;
    const res = await call('POST', '/auth/refresh', undefined, {
      Cookie: session.refreshCookie,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { accessToken: string };
    expect(typeof body.accessToken).toBe('string');

    // Access tokens are stateless bearer tokens: their claims (sub, role, tv,
    // iat, exp) have second granularity, so a token minted for the same user in
    // the same second is byte-identical by design. Asserting string inequality
    // was timing-dependent — it passed against a remote DB (hundreds of ms per
    // request) but failed on a fast local Postgres where both requests land in
    // the same second. Assert what actually matters instead: the refreshed
    // token authenticates as the same user.
    const me = await call('GET', '/auth/me', undefined, bearer(body.accessToken));
    expect(me.status).toBe(200);
    expect(((await me.json()) as { user: AuthSession['user'] }).user.id).toBe(session.user.id);

    // The refresh token carries a random jti, so real rotation is guaranteed
    // and can be asserted deterministically.
    const newCookie = cookiePair(rawRefreshCookie(res));
    expect(newCookie).toBeTruthy();
    expect(newCookie).not.toBe(previousCookie);
    session = { ...session, accessToken: body.accessToken, refreshCookie: newCookie };
  });

  it('POST /auth/refresh without a cookie → 401 "No active session"', async () => {
    const res = await call('POST', '/auth/refresh');
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe('No active session');
  });

  it('logout clears the cookie and revokes the access token immediately', async () => {
    const res = await call('POST', '/auth/logout', undefined, {
      Cookie: session.refreshCookie,
    });
    expect(res.status).toBe(204);

    // tokenVersion was incremented — the old access token is dead on arrival.
    const meAfterLogout = await call('GET', '/auth/me', undefined, bearer(session.accessToken));
    expect(meAfterLogout.status).toBe(401);
    expect(((await meAfterLogout.json()) as { error: string }).error).toBe(
      'Session is no longer valid',
    );
  });

  it('revoking a session invalidates every other outstanding refresh token', async () => {
    // Two logins → two independent sessions (A and B) for the same user.
    const sessionA = await login(email, PASSWORD);
    const sessionB = await login(email, PASSWORD);

    // Revoking B (logout) bumps tokenVersion — A's refresh token must die too.
    const logoutRes = await call('POST', '/auth/logout', undefined, {
      Cookie: sessionB.refreshCookie,
    });
    expect(logoutRes.status).toBe(204);

    const staleRefresh = await call('POST', '/auth/refresh', undefined, {
      Cookie: sessionA.refreshCookie,
    });
    expect(staleRefresh.status).toBe(401);
    expect(((await staleRefresh.json()) as { error: string }).error).toBe(
      'Session is no longer valid',
    );

    // B's own access token is revoked as well.
    const meB = await call('GET', '/auth/me', undefined, bearer(sessionB.accessToken));
    expect(meB.status).toBe(401);
  });
});
