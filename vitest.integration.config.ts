/**
 * Vitest configuration for integration tests that run against real third-party
 * services (Upstash Redis, Pusher).
 *
 * Run with:
 *   npx vitest run --config vitest.integration.config.ts
 *
 * Requires .env.local to be populated with real credentials.
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    exclude: ['node_modules', '.next'],
    setupFiles: ['src/test-setup-integration.ts'],
    // Run sequentially to avoid Redis key collisions between tests
    sequence: { concurrent: false },
    // Longer timeout for real network I/O
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
