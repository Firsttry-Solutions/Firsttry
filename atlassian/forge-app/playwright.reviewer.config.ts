/**
 * PLAYWRIGHT REVIEWER MINIMAL CONFIG
 * 
 * Minimal configuration for deterministic reviewer gate validation.
 * - NO Jira authentication required
 * - NO production environment required
 * - Uses local URL or mock environment
 * - Tests data-testid markers without external dependencies
 * 
 * Usage:
 *   npx playwright test --config tests/playwright.reviewer.config.ts tests/playwright/reviewer_minimal.spec.ts
 */

import { defineConfig, devices } from '@playwright/test';

// Configuration environment: FT_UI_BUNDLE_URL can be:
// - http://localhost:3000 (dev server)
// - http://localhost:5173 (vite dev)
// - file:// URL for static HTML with markers
const UI_BUNDLE_URL = process.env.FT_UI_BUNDLE_URL || 'http://localhost:3000';

console.log('[REVIEWER_MINIMAL_CONFIG]', {
  mode: 'reviewer-minimal',
  uiBundleUrl: UI_BUNDLE_URL,
  requiresJiraAuth: false,
  requiresProductionEnv: false,
  timeout: 30000,
  retries: 0,
});

export default defineConfig({
  testDir: './tests/playwright',
  testMatch: /reviewer_minimal\.spec\.ts/,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  reporter: [['list']],
  projects: [
    {
      name: 'chromium-reviewer',
      testMatch: /reviewer_minimal\.spec\.ts/,
      use: {
        ...devices['chromium'],
        baseURL: UI_BUNDLE_URL,
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
