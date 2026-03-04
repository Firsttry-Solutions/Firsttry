import { defineConfig } from '@playwright/test';

// Marketplace screenshot config — does NOT require JIRA credentials.
// Only FORGE_TUNNEL_URL is needed (validated inside the spec, not here).
export default defineConfig({
  testDir: './tests/playwright',
  testMatch: '**/marketplace_screenshots.spec.ts',
  timeout: 180_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  outputDir: './test-results/marketplace',
  use: {
    headless: true,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure', // capture on failure for debugging
    video: 'off',
    trace: 'retain-on-failure',   // capture trace on failure for debugging
  },
});
