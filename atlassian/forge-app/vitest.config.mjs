import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.ts'],
    exclude: ['node_modules', 'dist', '**/__mocks__/**'],
    testTimeout: 10000,
    hookTimeout: 10000,
    setupFiles: ['./vitest.setup.ts'],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@forge/api': `${__dirname}/tests/__mocks__/forge-api.ts`,
    },
  },
});
