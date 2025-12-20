import { defineConfig } from 'vitest/config';

/**
 * PHASE-5 ONLY VITEST CONFIGURATION
 * 
 * This config isolates Phase-5 tests and prevents Phase-3 tests
 * from interfering with verification.
 * 
 * Used by: npm run verify:phase5 and vitest --config vitest.phase5.config.ts
 */

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // ONLY include Phase-5 tests, EXCLUDE all others
    include: ['tests/test_phase5_validation.ts'],
    exclude: ['node_modules', 'dist', 'tests/test_phase3_*.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
