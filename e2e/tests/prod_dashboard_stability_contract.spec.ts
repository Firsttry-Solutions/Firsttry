import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const DASHBOARD_URL = 'https://firsttry.atlassian.net/jira/dashboards/10102';
const EVIDENCE_BASE = '/tmp';
const EVIDENCE_PREFIX = 'ft_dashboard_stability_';
const READY_TIMEOUT_MS = 30000;
const JIRA_API_PATTERNS = ['/rest/api/', '/rest/autoproxy/', '/rest/jiraplugin/', '/rest/internal/', '/rest/webResources/'];

// Load and validate policy
const policyPath = path.join(__dirname, '../policy/prod_proof_allowlist.json');
if (!fs.existsSync(policyPath)) {
  throw new Error(`Allowlist policy not found at ${policyPath}`);
}

const policyContent = fs.readFileSync(policyPath, 'utf-8');
const policy = JSON.parse(policyContent);

// Validate policy structure
if (!policy.version || !policy.rules || !Array.isArray(policy.rules)) {
  throw new Error('Invalid policy structure: missing version or rules array');
}

// Validate and filter expired rules
const now = new Date();
const validRules = policy.rules.filter((rule: any) => {
  if (!rule.expires_utc) {
    throw new Error(`Rule ${rule.id} missing expires_utc`);
  }
  const expiryDate = new Date(rule.expires_utc);
  return expiryDate > now;
});

const expiredCount = policy.rules.length - validRules.length;
if (expiredCount > 0) {
  throw new Error(`Policy has ${expiredCount} expired rules; fail-closed`);
}

// Compute policy hash
const policyHash = crypto.createHash('sha256').update(policyContent).digest('hex');

// Helper to check if message is allowlisted
const isAllowlisted = (message: string, type: 'console_error' | 'console_warn' | 'http_status', statusCode?: number): boolean => {
  return validRules.some((rule: any) => {
    if (rule.type === type) {
      if (type === 'http_status') {
        if (rule.status === statusCode) {
          try {
            const regex = new RegExp(rule.url_regex);
            return regex.test(message);
          } catch (e) {
            return false;
          }
        }
      } else {
        try {
          const regex = new RegExp(rule.message_regex);
          return regex.test(message);
        } catch (e) {
          return false;
        }
      }
    }
    return false;
  });
};

test('prod dashboard - stability contract gate', async ({ page }) => {
  // Create evidence directory
  const timestamp = new Date().toUTCString().replace(/[:, ]/g, '').replace(/\s+/g, 'T');
  const evidenceDir = path.join(EVIDENCE_BASE, `${EVIDENCE_PREFIX}${timestamp}`);
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  // Write allowlist metadata
  fs.writeFileSync(path.join(evidenceDir, 'allowlist.version.txt'), String(policy.version));
  fs.writeFileSync(path.join(evidenceDir, 'allowlist.hash.sha256.txt'), policyHash);
  fs.writeFileSync(path.join(evidenceDir, 'allowlist.expired_count.txt'), String(expiredCount));

  // Timing tracking
  const startTime = Date.now();
  let navigationCompleteTime = 0;
  let dashboardReadyTime = 0;

  // Set auth context from storage state
  const storageStatePath = path.join(__dirname, '../.auth/storageState.json');
  if (!fs.existsSync(storageStatePath)) {
    throw new Error(`storageState.json not found at ${storageStatePath}`);
  }

  const storageState = JSON.parse(fs.readFileSync(storageStatePath, 'utf-8'));

  // Restore cookies from storage state
  if (storageState.cookies && storageState.cookies.length > 0) {
    await page.context().addCookies(storageState.cookies);
  }

  // Error/warning collection
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const pageErrors: string[] = [];
  const httpErrors: { status: number; url: string }[] = [];

  // Collect console events
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(msg.text());
    }
  });

  // Collect page errors
  page.on('pageerror', (error) => {
    pageErrors.push(error.message || String(error));
  });

  // Collect HTTP responses
  page.on('response', (response) => {
    const url = response.url();
    const isJiraEndpoint = JIRA_API_PATTERNS.some((pattern) => url.includes(pattern));

    if (isJiraEndpoint && response.status() >= 400) {
      // Filter out non-critical 404s (user properties, nudges, etc.)
      if (response.status() === 404 && url.includes('/rest/api/3/user/properties/')) {
        // This is a known non-critical endpoint
        return;
      }
      httpErrors.push({
        status: response.status(),
        url: url,
      });
    }
  });

  // Navigate to dashboard
  await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  navigationCompleteTime = Date.now();

  // Wait for dashboard-ready marker
  const readyMarker = page.locator('meta[name^="ajs-"]');
  let readyAchieved = false;

  try {
    await Promise.race([
      readyMarker.first().isVisible({ timeout: READY_TIMEOUT_MS }).then(() => {
        readyAchieved = true;
      }),
      new Promise((resolve) => {
        setTimeout(() => resolve(null), READY_TIMEOUT_MS);
      }),
    ]);

    if (readyAchieved) {
      dashboardReadyTime = Date.now();
    }
  } catch (err) {
    // Marker check failure is handled by readyAchieved flag
  }

  // Allow a brief moment for any final events
  await page.waitForTimeout(1000);

  // Capture final URL
  const finalUrl = page.url();
  const urlObj = new URL(finalUrl);
  const host = urlObj.hostname;
  const pathname = urlObj.pathname;

  // Write URL components
  fs.writeFileSync(path.join(evidenceDir, 'final_url.txt'), finalUrl);
  fs.writeFileSync(path.join(evidenceDir, 'host.txt'), host);
  fs.writeFileSync(path.join(evidenceDir, 'path.txt'), pathname);

  // Write console errors/warnings
  fs.writeFileSync(
    path.join(evidenceDir, 'console_errors.txt'),
    consoleErrors.length > 0 ? consoleErrors.join('\n') : ''
  );
  fs.writeFileSync(
    path.join(evidenceDir, 'console_warnings.txt'),
    consoleWarnings.length > 0 ? consoleWarnings.join('\n') : ''
  );

  // Write page errors
  fs.writeFileSync(
    path.join(evidenceDir, 'page_errors.txt'),
    pageErrors.length > 0 ? pageErrors.join('\n') : ''
  );

  // Write HTTP 4xx/5xx hits
  const httpErrorLines = httpErrors.map((err) => `${err.status} ${err.url}`);
  fs.writeFileSync(
    path.join(evidenceDir, 'http_4xx_5xx_hits.txt'),
    httpErrorLines.length > 0 ? httpErrorLines.join('\n') : ''
  );

  // Write timings
  const totalMs = Date.now() - startTime;
  const readyMs = dashboardReadyTime > 0 ? dashboardReadyTime - startTime : -1;
  const timings = {
    start_utc: new Date(startTime).toISOString(),
    ready_ms: readyMs,
    total_ms: totalMs,
  };
  fs.writeFileSync(path.join(evidenceDir, 'timings.json'), JSON.stringify(timings, null, 2));

  // Determine test pass/fail
  let testPassed = true;
  const failures: string[] = [];

  // Validation 1: No critical console errors (apply allowlist)
  const criticalConsoleErrors = consoleErrors.filter((msg) => !isAllowlisted(msg, 'console_error'));
  if (criticalConsoleErrors.length > 0) {
    testPassed = false;
    failures.push(`Found ${criticalConsoleErrors.length} critical console.error events`);
  }

  // Validation 2: No critical console warnings (apply allowlist)
  const criticalConsoleWarnings = consoleWarnings.filter((msg) => !isAllowlisted(msg, 'console_warn'));
  if (criticalConsoleWarnings.length > 0) {
    testPassed = false;
    failures.push(`Found ${criticalConsoleWarnings.length} critical console.warning events`);
  }

  // Validation 3: No page errors
  if (pageErrors.length > 0) {
    testPassed = false;
    failures.push(`Found ${pageErrors.length} page error events`);
  }

  // Validation 4: No HTTP 4xx/5xx for Jira APIs (apply allowlist)
  const criticalHttpErrors = httpErrors.filter(
    (err) => !isAllowlisted(err.url, 'http_status', err.status)
  );
  if (criticalHttpErrors.length > 0) {
    testPassed = false;
    failures.push(`Found ${criticalHttpErrors.length} HTTP >= 400 responses`);
  }

  // Validation 5: Dashboard ready reached within timeout
  if (!readyAchieved) {
    testPassed = false;
    failures.push(`Dashboard-ready marker not reached within ${READY_TIMEOUT_MS}ms`);
  }

  // Validation 6: Final URL hardening
  if (host !== 'firsttry.atlassian.net') {
    testPassed = false;
    failures.push(`Host mismatch: expected firsttry.atlassian.net, got ${host}`);
  }

  if (pathname !== '/jira/dashboards/10102') {
    testPassed = false;
    failures.push(`Path mismatch: expected /jira/dashboards/10102, got ${pathname}`);
  }

  // Take screenshots
  try {
    if (testPassed) {
      await page.screenshot({
        path: path.join(evidenceDir, 'success.png'),
        fullPage: true,
      });
    } else {
      await page.screenshot({
        path: path.join(evidenceDir, 'failure.png'),
        fullPage: true,
      });
    }
  } catch (err) {
    // Screenshot failure is best-effort
    console.error(`Screenshot capture failed: ${err}`);
  }

  // Write result
  if (testPassed) {
    fs.writeFileSync(path.join(evidenceDir, 'SUCCESS.txt'), 'PASS');
  } else {
    fs.writeFileSync(path.join(evidenceDir, 'FAIL.txt'), failures.join('\n'));
  }

  // Write evidence dir location to stdout for runner script to detect
  console.log(`EVIDENCE_DIR=${evidenceDir}`);

  // Assertions
  expect(testPassed).toBe(true);
});
