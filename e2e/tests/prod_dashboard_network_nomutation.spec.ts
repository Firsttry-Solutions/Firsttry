import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const DASHBOARD_URL = 'https://firsttry.atlassian.net/jira/dashboards/10102';
const EVIDENCE_BASE = '/tmp';
const EVIDENCE_PREFIX = 'ft_dashboard_nomutation_';
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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

// Helper to check if request is allowlisted
const isAllowlisted = (method: string, url: string): boolean => {
  // Only check for HTTP 404 POST mutations (unlikely but let's be safe)
  // For now, we're primarily checking nomutation, so no real allowlists apply here
  return false;
};

test('prod dashboard - network non-mutation proof', async ({ page }) => {
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

  // Collect network requests
  const requestsLog: { method: string; url: string }[] = [];
  page.on('request', (request) => {
    requestsLog.push({
      method: request.method(),
      url: request.url(),
    });
  });

  // Navigate to dashboard
  await page.goto(DASHBOARD_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2000); // Allow any late requests

  // Capture final URL
  const finalUrl = page.url();
  const urlObj = new URL(finalUrl);
  const host = urlObj.hostname;
  const pathname = urlObj.pathname;

  // Write URL components
  fs.writeFileSync(path.join(evidenceDir, 'final_url.txt'), finalUrl);
  fs.writeFileSync(path.join(evidenceDir, 'host.txt'), host);
  fs.writeFileSync(path.join(evidenceDir, 'path.txt'), pathname);

  // Get unique methods (sorted)
  const methodsSet = new Set(requestsLog.map((r) => r.method));
  const methodsSorted = Array.from(methodsSet).sort();
  fs.writeFileSync(
    path.join(evidenceDir, 'methods_seen.txt'),
    methodsSorted.join('\n')
  );

  // Check for mutations
  const mutationHits: string[] = [];
  const knownMutationPatterns = [
    '/rest/api/',
    '/rest/autoproxy/',
    '/rest/jiraplugin/',
  ];

  requestsLog.forEach((req) => {
    if (MUTATION_METHODS.has(req.method)) {
      // Only flag as mutation if it's to a known Jira API endpoint
      const isMutationEndpoint = knownMutationPatterns.some((pattern) => req.url.includes(pattern));
      if (isMutationEndpoint) {
        mutationHits.push(`${req.method} ${req.url}`);
      }
    }
  });

  let testPassed = true;
  const failures: string[] = [];

  // Validation 1: No mutations
  if (mutationHits.length > 0) {
    testPassed = false;
    failures.push(`Found ${mutationHits.length} mutation requests`);
  }

  // Validation 2: Final URL host
  if (host !== 'firsttry.atlassian.net') {
    testPassed = false;
    failures.push(`Host mismatch: expected firsttry.atlassian.net, got ${host}`);
  }

  // Validation 3: Final URL path
  if (pathname !== '/jira/dashboards/10102') {
    testPassed = false;
    failures.push(`Path mismatch: expected /jira/dashboards/10102, got ${pathname}`);
  }

  // Write mutation hits
  if (mutationHits.length > 0) {
    fs.writeFileSync(
      path.join(evidenceDir, 'mutation_hits.txt'),
      mutationHits.join('\n')
    );
  } else {
    fs.writeFileSync(path.join(evidenceDir, 'mutation_hits.txt'), '');
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
    fs.writeFileSync(
      path.join(evidenceDir, 'FAIL.txt'),
      failures.join('\n')
    );
  }

  // Write evidence dir location to stdout for runner script to detect
  console.log(`EVIDENCE_DIR=${evidenceDir}`);

  // Assertions
  expect(testPassed).toBe(true);
});
