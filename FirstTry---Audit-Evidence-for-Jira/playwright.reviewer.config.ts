/**
 * Playwright Configuration for Reviewer E2E Tests
 * 
 * Tests dashboard gadget rendering inside real Jira context with authentication.
 * 
 * Prerequisites:
 * - JIRA_BASE_URL environment variable
 * - JIRA_DASHBOARD_URL environment variable  
 * - PLAYWRIGHT_STORAGE_STATE (storageState.json with Jira session)
 * 
 * Generates:
 * - Screenshots: PLAYWRIGHT_SCREENSHOTS_DIR
 * - Videos: PLAYWRIGHT_VIDEOS_DIR
 * - Traces: PLAYWRIGHT_TRACES_DIR
 * - Logs: PLAYWRIGHT_CONSOLE_LOG, PLAYWRIGHT_CONSOLE_ERRORS, PLAYWRIGHT_PAGE_ERRORS
 */

import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

// Required environment variables
const STORAGE_STATE = process.env.PLAYWRIGHT_STORAGE_STATE || 
  path.join(__dirname, 'tests/playwright/.auth/storageState.json');

const SCREENSHOTS_DIR = process.env.PLAYWRIGHT_SCREENSHOTS_DIR || 
  path.join(__dirname, 'playwright-screenshots');

const VIDEOS_DIR = process.env.PLAYWRIGHT_VIDEOS_DIR || 
  path.join(__dirname, 'playwright-videos');

const TRACES_DIR = process.env.PLAYWRIGHT_TRACES_DIR || 
  path.join(__dirname, 'playwright-traces');

// Allow headed mode for debugging
const HEADED = process.env.HEADED === '1';

export default defineConfig({
  testDir: './tests/playwright',
  testMatch: '**/reviewer_dashboard_e2e.spec.ts',
  
  // Strict timeout enforcement
  timeout: 120000, // 2 minutes per test
  expect: {
    timeout: 30000
  },
  
  // Fail-closed: stop on first failure
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1, // Retry once to capture trace on failure
  workers: 1, // Single worker for deterministic execution
  
  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { 
      outputFolder: 'playwright-report-reviewer',
      open: 'never'
    }]
  ],
  
  // Global test configuration
  use: {
    // Use saved authentication state
    storageState: STORAGE_STATE,
    
    // Browser configuration
    baseURL: undefined, // No baseURL - test uses explicit absolute URLs
    headless: !HEADED,
    viewport: { width: 1440, height: 900 },
    
    // Evidence capture - maximum forensics
    screenshot: 'only-on-failure', // Automatic screenshots on failure
    video: 'on', // ALWAYS record video
    trace: 'on-first-retry', // Capture trace on retry for failure analysis
    
    // Timeouts
    actionTimeout: 30000,
    navigationTimeout: 60000,
    
    // User agent
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  },
  
  // Output directories
  outputDir: 'test-results',
  
  // Projects
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--no-sandbox'
          ]
        }
      },
    },
  ],
  
  // Disable web server - we connect to live Jira instance
  webServer: undefined,
});
