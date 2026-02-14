import { defineConfig, devices } from '@playwright/test';

// === FAIL-CLOSED ENV VALIDATION: Format-based, no tenant-lock ===
// Required env vars (must be set before playwright config loads)
const REQUIRED_VARS = ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_PASSWORD'];

// === VALIDATION GATE: Check required vars and validate URL format ===
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
      'To run deterministically:',
      '  export JIRA_BASE_URL="https://your-tenant.atlassian.net"',
      '  export JIRA_EMAIL="your-email@example.com"',
      '  export JIRA_PASSWORD="your-password"',
      '  export JIRA_DASHBOARD_URL="https://your-tenant.atlassian.net/jira/dashboards/XXXXX"  # optional',
      '  npm run dashboard:playwright:proof',
      '',
    ].join('\n');
    
    console.error(errorBlock);
    process.exit(1);
  }
  
  // Format validation: JIRA_BASE_URL must be valid HTTPS URL
  const baseUrl = process.env.JIRA_BASE_URL!;
  try {
    const parsed = new URL(baseUrl);
    
    // Reject http:// (must be https://)
    if (parsed.protocol !== 'https:') {
      const errorBlock = [
        '╔════════════════════════════════════════════════════════════════════════════╗',
        '║              JIRA_BASE_URL VALIDATION FAILED                              ║',
        '╚════════════════════════════════════════════════════════════════════════════╝',
        '',
        `Protocol Error: ${parsed.protocol}`,
        'JIRA_BASE_URL must use HTTPS (not HTTP)',
        '',
        'Valid example:',
        '  export JIRA_BASE_URL="https://your-tenant.atlassian.net"',
        '',
        'Invalid (rejected):',
        '  export JIRA_BASE_URL="http://your-tenant.atlassian.net"  # ← HTTP not allowed',
        '',
      ].join('\n');
      
      console.error(errorBlock);
      process.exit(1);
    }
  } catch (err) {
    const errorBlock = [
      '╔════════════════════════════════════════════════════════════════════════════╗',
      '║              JIRA_BASE_URL VALIDATION FAILED                              ║',
      '╚════════════════════════════════════════════════════════════════════════════╝',
      '',
      `Invalid URL format: ${baseUrl}`,
      '',
      'Valid example:',
      '  export JIRA_BASE_URL="https://your-tenant.atlassian.net"',
      '',
    ].join('\n');
    
    console.error(errorBlock);
    process.exit(1);
  }
}

// Run validation at config load time (fail-closed)
validateRequiredEnvVars();

// === BACKBONE FIX: Ensure headless is controlled by FT_PLAYWRIGHT_MODE consistently ===
const mode = process.env.FT_PLAYWRIGHT_MODE || 'headless';
const headless = (mode !== 'headed');
console.log('[CONFIG_MODE]', JSON.stringify({ mode, headless }));

// Normalize JIRA_BASE_URL: remove trailing slash
const rawBaseUrl = process.env.JIRA_BASE_URL!;
const baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

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
        headless,
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
        headless,
        trace: 'on',
        screenshot: 'off',
        video: 'off',
      },
    },
  ],
});
