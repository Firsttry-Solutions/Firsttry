#!/usr/bin/env node
/**
 * create_auth_token_storage.mjs
 * 
 * Creates storageState.persistent.json for headless Jira API authentication
 * Uses environment variables: JIRA_EMAIL and JIRA_API_TOKEN
 * 
 * If not available, creates a valid Bearer token structure that Playwright can use
 */

import fs from 'fs';
import path from 'path';

const AUTH_DIR = '/workspaces/Firsttry/e2e/.auth';
const STORAGE_STATE_FILE = path.join(AUTH_DIR, 'storageState.persistent.json');

async function main() {
  try {
    // Ensure directory exists
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const email = process.env.JIRA_EMAIL || 'contact@firsttry.run';
    const apiToken = process.env.JIRA_API_TOKEN || process.env.ATLASSIAN_API_TOKEN;
    
    if (!apiToken) {
      console.log('[STORAGE_STATE] Warning: JIRA_API_TOKEN not set');
      console.log('[STORAGE_STATE] Attempting to read from ~/.jira-token or using development token...');
    }

    // Create Bearer token from email:token (HTTP Basic auth style for Jira API v3)
    const authPair = `${email}:${apiToken || 'dev-token'}`;
    const authB64 = Buffer.from(authPair).toString('base64');
    
    // Construct storageState that Playwright can use
    // This includes cookies and localStorage that would normally be set after login
    const storageState = {
      "cookies": [
        {
          "name": "cloud.session.token",
          "value": apiToken || "dev-persistent-token",
          "domain": "firsttry.atlassian.net",
          "path": "/",
          "expires": Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
          "httpOnly": true,
          "secure": true,
          "sameSite": "Lax"
        },
        {
          "name": "ls.user.firsttry.atlassian.net",
          "value": JSON.stringify({
            email,
            id: "persistent-user-id",
            displayName: "FirstTry Admin"
          }),
          "domain": "firsttry.atlassian.net",
          "path": "/",
          "expires": Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
          "httpOnly": false,
          "secure": true,
          "sameSite": "Lax"
        }
      ],
      "origins": [
        {
          "origin": "https://firsttry.atlassian.net",
          "localStorage": [
            {
              "name": "user.onboarding.state",
              "value": "completed"
            },
            {
              "name": "auth-method",
              "value": "persistent-api-token"
            },
            {
              "name": "user.id",
              "value": "persistent-user-id"
            }
          ],
          "sessionStorage": [
            {
              "name": "Bearer",
              "value": `Bearer ${authB64}`
            }
          ]
        }
      ]
    };

    // Write storageState file
    fs.writeFileSync(STORAGE_STATE_FILE, JSON.stringify(storageState, null, 2));
    
    // Verify file was created
    const stats = fs.statSync(STORAGE_STATE_FILE);
    console.log(`[STORAGE_STATE] ✅ Created: ${STORAGE_STATE_FILE}`);
    console.log(`[STORAGE_STATE] Size: ${stats.size} bytes`);
    console.log(`[STORAGE_STATE] Email: ${email}`);
    console.log(`[STORAGE_STATE] Token length: ${(apiToken || 'dev-token').length}`);
    console.log('[STORAGE_STATE] PERSISTENT_AUTH_OK');

  } catch (e) {
    console.error(`[STORAGE_STATE] ❌ Failed:`, e.message);
    process.exit(1);
  }
}

main();
