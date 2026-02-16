/**
 * PLAYWRIGHT REVIEWER MINIMAL CONFIG
 * 
 * Minimal configuration for deterministic reviewer gate validation.
 * - NO Jira authentication required
 * - NO production environment required
 * - Uses local built bundle or dev server
 * - Tests data-testid markers without external dependencies
 * 
 * Usage:
 *   npx playwright test --config playwright.reviewer.config.ts tests/playwright/reviewer_minimal.spec.ts
 * 
 * Environment variable support:
 *   FT_UI_BUNDLE_URL - override bundle URL (default: auto-detect from dist/ or http://localhost:3000)
 */

import { defineConfig, devices } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Auto-detect UI bundle URL (same logic as in test file)
function getUIBundleUrl(): string {
  if (process.env.FT_UI_BUNDLE_URL) {
    return process.env.FT_UI_BUNDLE_URL;
  }
  
  const distPath = path.join(__dirname, 'dist/ui/index.html');
  if (fs.existsSync(distPath)) {
    console.log('[REVIEWER_MINIMAL_CONFIG] Using local built bundle:', distPath);
    return `file://${distPath}`;
  }
  
  return 'http://localhost:3000';
}

const UI_BUNDLE_URL = getUIBundleUrl();

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
