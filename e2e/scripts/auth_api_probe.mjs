#!/usr/bin/env node
/**
 * auth_api_probe.mjs
 * 
 * Check if auth is valid by hitting Jira REST API endpoints.
 * Does NOT require gadget or UI elements — pure API check.
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { resolveStorageStatePath } from './storage_state_paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

async function run() {
  const storageStateInput = process.env.STORAGE_STATE || './.auth/storageState.json';
  let storageStatePath = resolveStorageStatePath(storageStateInput);

  console.log(`[API_PROBE] StorageState: ${storageStatePath}`);

  let storageState = undefined;
  if (storageStatePath !== '__NONE__' && fs.existsSync(storageStatePath)) {
    storageState = JSON.parse(fs.readFileSync(storageStatePath, 'utf8'));
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState });

  try {
    const page = await context.newPage();

    // Endpoint 1: /rest/api/3/myself (requires auth)
    console.log(`[API_PROBE] Probing: GET /rest/api/3/myself`);
    let response = await page.goto('https://firsttry.atlassian.net/rest/api/3/myself', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    }).catch(err => {
      console.log(`[API_PROBE] /myself timeout: ${err.message}`);
      return null;
    });

    if (response) {
      const status = response.status();
      console.log(`[API_PROBE] /myself status: ${status}`);
      
      if (status === 200) {
        try {
          const text = await page.textContent('body');
          // Try to parse as JSON
          const data = JSON.parse(text || '{}');
          console.log(`[API_PROBE] /myself response has keys: ${Object.keys(data).join(', ')}`);
          console.log(`[API_PROBE] ✅ Auth is VALID (200 OK)`);
        } catch {
          console.log(`[API_PROBE] /myself returned 200 but response not valid JSON`);
        }
      } else if (status === 401 || status === 403) {
        console.log(`[API_PROBE] ❌ Auth is INVALID (${status})`);
        process.exit(2);
      }
    }

    // Endpoint 2: /rest/api/3/configuration/features (no auth required, but if we got 200 on /myself, this should work)
    if (response && response.status() === 200) {
      console.log(`[API_PROBE] Probing: GET /rest/api/3/configuration/features`);
      response = await page.goto('https://firsttry.atlassian.net/rest/api/3/configuration/features', {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      }).catch(() => null);

      if (response) {
        console.log(`[API_PROBE] /features status: ${response.status()}`);
      }
    }

    console.log(`[API_PROBE] ✅ API probe complete`);
    process.exit(0);

  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error(`[API_PROBE] FATAL: ${err.message}`);
  process.exit(1);
});
