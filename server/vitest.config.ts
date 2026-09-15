import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Runs before any test module is imported — guarantees JWT secrets exist
    // so config/env.ts never process.exit()s in environments without .env.
    setupFiles: ['./src/test/setup-env.ts'],
  },
});

