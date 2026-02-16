/**
 * PLAYWRIGHT REVIEWER MINIMAL CONFIG (v3.2.8)
 * 
 * Fixed to serve UI via HTTP server for real JS hydration and proper DOM rendering.
 * - Serves: src/gadget-ui/dist on http://127.0.0.1:4173
 * - Tests: data-testid markers via DOM (not file:// URL, not HTML grep)
 * - NO Jira authentication required
 * - NO production environment required
 * - Tests data-testid markers without external dependencies
 * 
 * Usage:
 *   npx playwright test -c playwright.reviewer.config.ts tests/playwright/reviewer_minimal.spec.ts
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/playwright',
  testMatch: /reviewer_minimal\.spec\.ts/,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  reporter: [['line']],
  
  // Global webServer configuration for static UI serving
  webServer: {
    command: 'npx http-server src/gadget-ui/dist -p 4173 -a 127.0.0.1 --cors',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  
  projects: [
    {
      name: 'chromium-reviewer',
      testMatch: /reviewer_minimal\.spec\.ts/,
      use: {
        ...devices['chromium'],
        baseURL: 'http://127.0.0.1:4173',
        headless: true,
        trace: 'off',
        video: 'off',
        screenshot: 'off',
      },
    },
  ],
  
  // Global timeout: tests must complete within 120s total
  globalTimeout: 120_000,
});
