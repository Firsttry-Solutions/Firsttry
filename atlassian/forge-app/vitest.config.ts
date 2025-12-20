import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.ts'],
    exclude: ['node_modules', 'dist'],
    // Ignore process.exit() calls in test harnesses
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
