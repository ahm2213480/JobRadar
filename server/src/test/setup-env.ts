/**
 * Vitest setup — runs before any test module is imported (see vitest.config.ts).
 *
 * Provides safe fallbacks so the suite runs in environments without a
 * server/.env file (CI). Real values always win: dotenv does not override
 * existing process.env entries, and neither do these ?? defaults.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET ??= 'test-only-access-secret-0123456789abcdef0123';
process.env.JWT_REFRESH_SECRET ??= 'test-only-refresh-secret-0123456789abcdef01';
process.env.JWT_ACCESS_EXPIRES_IN ??= '15m';
process.env.JWT_REFRESH_EXPIRES_IN ??= '7d';
