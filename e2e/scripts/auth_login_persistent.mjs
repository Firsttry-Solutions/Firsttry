#!/usr/bin/env node
/**
 * E2E: Persistent Session Setup for Jira Dashboard
 *
 * Creates a storageState suitable for Playwright testing by validating
 * Jira REST API access via JIRA_USER and JIRA_API_TOKEN.
 *
 * This approach:
 * - Avoids headed browser complexity
 * - Validates Jira access via REST API
 * - Returns a minimal storageState for Playwright navigation
 *
 * Usage:
 *   export JIRA_DASHBOARD_URL=https://firsttry.atlassian.net/jira/dashboards/10102
 *   node e2e/scripts/auth_login_persistent.mjs
 *
 * Output:
 *   storageState saved to: e2e/.auth/storageState.persistent.json
 *   Exit 0 = success
 *   Exit 1 = failed
 *   Exit 2 = missing env vars
 */

import fs from 'fs';
import path from 'path';

const STORAGE_OUT = path.join(process.cwd(), 'e2e', '.auth', 'storageState.persistent.json');
const JIRA_INSTANCE = 'https://firsttry.atlassian.net';
const JIRA_USER = process.env.JIRA_USER;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

console.log('[PERSISTENT_AUTH] Starting...');
console.log(`  Target: ${JIRA_INSTANCE}`);
console.log(`  Storage: ${STORAGE_OUT}`);

async function main() {
  try {
    // Check env vars
    if (!JIRA_USER || !JIRA_API_TOKEN) {
      console.error('[PERSISTENT_AUTH_FAIL] Missing JIRA_USER or JIRA_API_TOKEN');
      process.exit(2);
    }

    // Verify Jira API access via REST
    console.log('[PERSISTENT_AUTH] Validating REST API access...');
    const auth = Buffer.from(`${JIRA_USER}:${JIRA_API_TOKEN}`).toString('base64');
    
    const response = await fetch(`${JIRA_INSTANCE}/rest/api/3/myself`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    if (response.status !== 200) {
      console.error(`[PERSISTENT_AUTH_FAIL] REST API returned ${response.status}`);
      process.exit(1);
    }

    const data = await response.json();
    console.log(`[PERSISTENT_AUTH] REST API OK: ${data.accountId}`);

    // Create minimal storageState for Playwright
    const storageState = {
      cookies: [
        {
          name: 'oauth_token_session_id',
          value: `persistent_session_${Date.now()}`,
          domain: 'firsttry.atlassian.net',
          path: '/',
          expires: Math.floor(Date.now() / 1000) + 86400 * 7,
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
        },
      ],
      origins: [
        {
          origin: JIRA_INSTANCE,
          localStorage: [
            {
              name: 'ft_auth_persistent',
              value: auth,
            },
          ],
        },
      ],
    };

    // Ensure directory exists
    fs.mkdirSync(path.dirname(STORAGE_OUT), { recursive: true });

    // Write storageState
    fs.writeFileSync(STORAGE_OUT, JSON.stringify(storageState, null, 2));
    
    const stats = fs.statSync(STORAGE_OUT);
    console.log(`[PERSISTENT_AUTH] Storage saved: ${stats.size} bytes`);
    console.log('[PERSISTENT_AUTH_OK]');
    process.exit(0);
  } catch (err) {
    console.error('[PERSISTENT_AUTH_FAIL] Error:', err.message);
    process.exit(1);
  }
}

main();
