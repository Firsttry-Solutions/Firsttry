import { defineConfig, devices } from '@playwright/test';

// === FAIL-CLOSED ENV VALIDATION: Mechanically correct, deterministic ===
// Required env vars (must be set before playwright config loads)
const REQUIRED_VARS = ['JIRA_BASE_URL'];

// Optional env vars (may be set for specific test behavior)
const OPTIONAL_VARS = [
  'JIRA_DASHBOARD_URL',  // Used in test (defaults to base URL + path if not set)
  'FT_FORCE_FORGE_CONSOLE_ERROR',
  'FT_DETERMINISTIC_IFRAME_SRC_HASH_ONLY',
];

// === VALIDATION GATE: List all env vars and fail if required ones missing ===
function validateRequiredEnvVars(): void {
  const missing: string[] = [];
  
  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }
  
  if (missing.length > 0) {
    // Fail-closed: Print deterministic error block
    const errorBlock = [
      '╔════════════════════════════════════════════════════════════════════════════╗',
      '║                 PLAYWRIGHT ENV VALIDATION FAILED                          ║',
      '║                      Missing Required Variables                           ║',
      '╚════════════════════════════════════════════════════════════════════════════╝',
      '',
      `Missing ${missing.length} required environment variable(s):`,
      '',
      ...missing.map(v => `  - ${v} (REQUIRED)`),
      '',
      'Example export commands:',
      '',
      ...missing.map(v => `  export ${v}="<SET_YOUR_VALUE>"`),
      '',
      'To run deterministically:',
      '  export JIRA_BASE_URL="https://firsttry.atlassian.net"',
      '  export JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/XXXXX"',
      '  npm run dashboard:playwright:proof',
      '',
    ].join('\n');
    
    console.error(errorBlock);
    process.exit(1);
  }
  
  // Additional validation: JIRA_BASE_URL must be exact value
  const baseUrl = process.env.JIRA_BASE_URL!;
  const expectedBaseUrl = 'https://firsttry.atlassian.net';
  if (baseUrl !== expectedBaseUrl) {
    const errorBlock = [
      '╔════════════════════════════════════════════════════════════════════════════╗',
      '║              JIRA_BASE_URL VALIDATION FAILED                              ║',
      '╚════════════════════════════════════════════════════════════════════════════╝',
      '',
      `Expected: ${expectedBaseUrl}`,
      `Got:      ${baseUrl}`,
      '',
      'To fix, set the correct URL:',
      `  export JIRA_BASE_URL="${expectedBaseUrl}"`,
      '',
    ].join('\n');
    
    console.error(errorBlock);
    process.exit(1);
  }
}

// Run validation at config load time (fail-closed)
validateRequiredEnvVars();
const baseUrl = process.env.JIRA_BASE_URL!;

export default defineConfig({
  testDir: './tests/playwright',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: [['list']],
  projects: [
    {
      name: 'setup',
      testMatch: /tests\/playwright\/auth\.setup\.ts/,
      timeout: 600_000,
      use: {
        ...devices['chromium'],
        baseURL: baseUrl,
        headless: true,
        trace: 'off',
      },
    },
    {
      name: 'chromium',
      testMatch: /tests\/playwright\/dashboard-phase1-diagnostics\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['chromium'],
        baseURL: baseUrl,
        storageState: 'tests/playwright/.auth/state.json',
        headless: true,
        trace: 'on',
        screenshot: 'off',
        video: 'off',
      },
    },
  ],
});
