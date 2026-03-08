import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.ts', 'src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: [
      'node_modules',
      'dist',
      '**/__mocks__/**',
      '**/playwright/**',
      'tests/export/auditor/_*.ts',
      // gadget-ui tests require a browser env (jsdom) — run via src/gadget-ui npm test
      'src/gadget-ui/**',
      // phase4 tests require @jest/globals or unresolved dependencies in this layout
      'src/phase4/**',
      // src/__tests__/ are referenced as content artifacts, not standalone test runners
      'src/__tests__/**',
    ],
    testTimeout: 10000,
    hookTimeout: 10000,
    setupFiles: ['./vitest.setup.ts'],
    fileParallelism: false,
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@forge/api': `${__dirname}/tests/__mocks__/forge-api.ts`,
      '@forge/bridge': `${__dirname}/tests/__mocks__/forge-bridge.ts`,
    },
  },
});
