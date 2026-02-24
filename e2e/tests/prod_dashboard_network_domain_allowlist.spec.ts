import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const DASHBOARD_URL = 'https://firsttry.atlassian.net/jira/dashboards/10102';
const EVIDENCE_BASE = '/tmp';
const EVIDENCE_PREFIX = 'ft_dashboard_domain_allowlist_';

// Load and validate policy
const policyPath = path.join(__dirname, '../policy/prod_proof_allowlist.json');
if (!fs.existsSync(policyPath)) {
  throw new Error(`Policy not found at ${policyPath}`);
}

const policyContent = fs.readFileSync(policyPath, 'utf-8');
const policy = JSON.parse(policyContent);

// Validate network_domain_allowlist
if (!policy.network_domain_allowlist) {
  throw new Error('Policy missing network_domain_allowlist');
}

const allowlist = policy.network_domain_allowlist;
const now = new Date();
const expiryDate = new Date(allowlist.expires_utc);

if (expiryDate <= now) {
  throw new Error(`Network domain allowlist expired at ${allowlist.expires_utc}`);
}

// Compute policy hash
const policyHash = crypto.createHash('sha256').update(policyContent).digest('hex');

// Helper to check if hostname is allowed
const isHostAllowed = (hostname: string): boolean => {
  const lowerHostname = hostname.toLowerCase();

  // Check exact matches in allowed_hosts
  if (allowlist.allowed_hosts.some((h: string) => h.toLowerCase() === lowerHostname)) {
    return true;
  }

  // Check suffix matches (must start with .) in allowed_host_suffixes (Atlassian only)
  if (allowlist.allowed_host_suffixes && allowlist.allowed_host_suffixes.some((suffix: string) => {
    if (!suffix.startsWith('.')) {
      return false; // Skip invalid suffixes
    }
    return lowerHostname.endsWith(suffix.toLowerCase());
  })) {
    return true;
  }

  // Check exact matches in third_party_exact_hosts (no wildcards)
  if (allowlist.third_party_exact_hosts && allowlist.third_party_exact_hosts.some((h: string) => h.toLowerCase() === lowerHostname)) {
    return true;
  }

  return false;
};

test('prod dashboard - network domain allowlist proof', async ({ page, context }) => {
  // Load authentication state (if available)
  const authPath = path.join(__dirname, '../.auth/storageState.json');
  if (fs.existsSync(authPath)) {
    try {
      const storageState = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
      if (storageState.cookies) {
        await context.addCookies(storageState.cookies);
      }
      if (storageState.origins) {
        for (const origin of storageState.origins) {
          if (origin.localStorage) {
            for (const item of origin.localStorage) {
              await page.evaluate(
                ([storage, key, value]) => window.localStorage.setItem(key, value),
                [origin.localStorage, item.name, item.value]
              );
            }
          }
        }
      }
    } catch (e) {
      // Auth state loading failed; continue anyway
    }
  }
  
  // Create evidence directory
  const timestamp = new Date().toUTCString().replace(/[:, ]/g, '').replace(/\s+/g, 'T');
  const evidenceDir = path.join(EVIDENCE_BASE, `${EVIDENCE_PREFIX}${timestamp}`);
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  // Write allowlist metadata
  fs.writeFileSync(path.join(evidenceDir, 'allowlist.version.txt'), String(allowlist.version));
  fs.writeFileSync(path.join(evidenceDir, 'allowlist.hash.sha256.txt'), policyHash);
  fs.writeFileSync(path.join(evidenceDir, 'allowlist.expired_count.txt'), '0');

  // Write evidence directory marker
  fs.writeFileSync(path.join(evidenceDir, 'EVIDENCE_DIR.txt'), evidenceDir);
  fs.writeFileSync(path.join(evidenceDir, 'START_UTC.txt'), new Date().toISOString());

  // Collect network requests
  const hostsSeenSet = new Set<string>();
  const nonHttpSchemes = new Set<string>();

  page.on('request', (request) => {
    try {
      const url = request.url();
      const urlObj = new URL(url);

      // Only evaluate http(s)
      if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
        hostsSeenSet.add(urlObj.hostname.toLowerCase());
      } else {
        // Record non-http scheme
        nonHttpSchemes.add(urlObj.protocol.toLowerCase());
      }
    } catch (e) {
      // Invalid URL or protocol like about:, data:, blob: - record scheme if parseable
      const match = request.url().match(/^([a-z]+):/i);
      if (match) {
        nonHttpSchemes.add(match[1].toLowerCase());
      }
    }
  });

  // Navigate to dashboard with reasonable timeout
  try {
    await page.goto(DASHBOARD_URL, { waitUntil: 'load', timeout: 15000 });
  } catch (e) {
    // Page might have navigation issues; continue with evidence capture
    // The request listener will have captured what it could
  }

  // Wait briefly for any late requests
  try {
    await page.waitForTimeout(1000);
  } catch (e) {
    // Page closed; continue with evidence capture
  }

  // Capture final URL
  let finalUrl = '';
  let host = '';
  let pathname = '';
  
  try {
    finalUrl = page.url();
    const urlObj = new URL(finalUrl);
    host = urlObj.hostname;
    pathname = urlObj.pathname;
  } catch (e) {
    // Page closed or URL unavailable
  }

  // Write URL components
  fs.writeFileSync(path.join(evidenceDir, 'final_url.txt'), finalUrl);
  fs.writeFileSync(path.join(evidenceDir, 'host.txt'), host);
  fs.writeFileSync(path.join(evidenceDir, 'path.txt'), pathname);

  // Validate final URL
  let testPassed = true;
  const failures: string[] = [];

  if (host.toLowerCase() !== 'firsttry.atlassian.net') {
    testPassed = false;
    failures.push(`Final host mismatch: ${host}`);
  }

  if (pathname !== '/jira/dashboards/10102' && pathname !== '/jira/dashboards/10102/') {
    testPassed = false;
    failures.push(`Final path invalid: ${pathname}`);
  }

  // Sort and write hosts
  const hostsSorted = Array.from(hostsSeenSet).sort();
  fs.writeFileSync(path.join(evidenceDir, 'hosts_seen.txt'), hostsSorted.join('\n'));

  // Filter blocked hosts
  const blockedHosts = hostsSorted.filter((h) => !isHostAllowed(h));
  fs.writeFileSync(
    path.join(evidenceDir, 'hosts_blocked.txt'),
    blockedHosts.length > 0 ? blockedHosts.join('\n') : ''
  );

  // Write non-http schemes
  const schemesSorted = Array.from(nonHttpSchemes).sort();
  fs.writeFileSync(path.join(evidenceDir, 'non_http_schemes.txt'), schemesSorted.join('\n'));

  // Check for blocked hosts
  if (blockedHosts.length > 0) {
    testPassed = false;
    failures.push(`Found ${blockedHosts.length} disallowed host(s): ${blockedHosts.join(', ')}`);
  }

  // Take screenshot
  try {
    if (testPassed) {
      try {
        await page.screenshot({
          path: path.join(evidenceDir, 'success.png'),
          fullPage: true,
        });
      } catch (err) {
        fs.writeFileSync(path.join(evidenceDir, 'screenshot_error.txt'), String(err));
        // Don't fail test on screenshot error; only fail on validation errors
      }
    } else {
      try {
        await page.screenshot({
          path: path.join(evidenceDir, 'failure.png'),
          fullPage: true,
        });
      } catch (err) {
        fs.writeFileSync(path.join(evidenceDir, 'screenshot_error.txt'), String(err));
      }
    }
  } catch (err) {
    // Ignore outer error
  }

  // Write result
  if (testPassed) {
    fs.writeFileSync(path.join(evidenceDir, 'SUCCESS.txt'), 'PASS');
  } else {
    fs.writeFileSync(path.join(evidenceDir, 'FAIL.txt'), failures.join('\n'));
  }

  // Print evidence directory to stdout
  console.log(`EVIDENCE_DIR=${evidenceDir}`);

  // Assertions
  expect(testPassed).toBe(true);
});
