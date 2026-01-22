#!/usr/bin/env node
/**
 * auth_preflight_rest_only.mjs
 * 
 * Deterministic REST API-only authentication check for CI/automation.
 * Does NOT use Playwright UI navigation - fully headless-compatible.
 * 
 * Requirements:
 *   - JIRA_USER: Jira username
 *   - JIRA_API_TOKEN: Jira API token
 * 
 * Exit codes:
 *   0 - OK: /rest/api/3/myself returned 200
 *   1 - FAIL: API returned non-200 status
 *   2 - MISSING: Missing required env vars
 * 
 * Usage:
 *   node e2e/scripts/auth_preflight_rest_only.mjs
 *   JIRA_USER=user JIRA_API_TOKEN=token node e2e/scripts/auth_preflight_rest_only.mjs
 */

const USER = process.env.JIRA_USER;
const API_TOKEN = process.env.JIRA_API_TOKEN;
const API_URL = "https://firsttry.atlassian.net/rest/api/3/myself";

if (!USER || !API_TOKEN) {
  console.error("[REST_PREFLIGHT_FAIL] Missing JIRA_USER or JIRA_API_TOKEN");
  process.exit(2);
}

async function checkAuth() {
  try {
    const credentials = Buffer.from(`${USER}:${API_TOKEN}`).toString("base64");
    
    const response = await fetch(API_URL, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 200) {
      const data = await response.json();
      const accountId = data.accountId || data.name || data.email || "unknown";
      console.log(`[REST_PREFLIGHT_OK] ${accountId}`);
      process.exit(0);
    } else {
      const body = await response.text().catch(() => "");
      const snippet = body.substring(0, 80).replace(/\n/g, " ");
      console.error(`[REST_PREFLIGHT_FAIL] ${response.status} ${snippet}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`[REST_PREFLIGHT_FAIL] ${err.message}`);
    process.exit(1);
  }
}

checkAuth();
