#!/usr/bin/env node
/**
 * inspect_storage_state.mjs
 * 
 * Inspect storageState.json structure WITHOUT leaking sensitive values.
 * Print: cookie count, domains, names, origins, and session vs persistent breakdown.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { resolveStorageStatePath } from './storage_state_paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

async function run() {
  const storageStateInput = process.env.STORAGE_STATE || './.auth/storageState.json';
  let storageStatePath = resolveStorageStatePath(storageStateInput);

  if (storageStatePath === '__NONE__') {
    console.log('[INSPECT_STORAGE] Running in unauthenticated mode (__NONE__)');
    process.exit(0);
  }

  console.log(`[INSPECT_STORAGE] StorageState path: ${storageStatePath}`);

  if (!fs.existsSync(storageStatePath)) {
    console.error(`[INSPECT_STORAGE] ERROR: File not found: ${storageStatePath}`);
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(storageStatePath, 'utf8');
    const state = JSON.parse(content);

    console.log(`[INSPECT_STORAGE] File size: ${fs.statSync(storageStatePath).size} bytes`);

    // Cookies
    const cookies = state.cookies || [];
    console.log(`[INSPECT_STORAGE] Total cookies: ${cookies.length}`);

    if (cookies.length > 0) {
      // Unique domains
      const domains = new Set(cookies.map(c => c.domain || 'unknown'));
      console.log(`[INSPECT_STORAGE] Unique domains: ${Array.from(domains).sort().join(', ')}`);

      // Cookie names
      const names = cookies.map(c => c.name);
      console.log(`[INSPECT_STORAGE] Cookie names: ${names.join(', ')}`);

      // Expiration analysis
      const expiryTimes = cookies
        .map(c => c.expires || -1)
        .filter(e => e !== undefined && e !== null);
      
      if (expiryTimes.length > 0) {
        const minExpiry = Math.min(...expiryTimes);
        const maxExpiry = Math.max(...expiryTimes);
        console.log(`[INSPECT_STORAGE] Expiry range: ${new Date(minExpiry * 1000).toISOString()} to ${new Date(maxExpiry * 1000).toISOString()}`);
      }

      // Session vs persistent
      const sessionCookies = cookies.filter(c => c.expires === -1 || c.expires === 0 || !c.expires).length;
      const persistentCookies = cookies.length - sessionCookies;
      console.log(`[INSPECT_STORAGE] Session cookies: ${sessionCookies}, Persistent: ${persistentCookies}`);

      // Check for auth-related cookie names
      const authCookies = cookies.filter(c => 
        c.name.toLowerCase().includes('auth') ||
        c.name.toLowerCase().includes('session') ||
        c.name.toLowerCase().includes('token') ||
        c.name.toLowerCase().includes('xsrf')
      );
      console.log(`[INSPECT_STORAGE] Auth-related cookies: ${authCookies.map(c => c.name).join(', ')}`);
    }

    // Origins
    const origins = state.origins || [];
    console.log(`[INSPECT_STORAGE] Origins: ${origins.length}`);
    if (origins.length > 0) {
      const originHostnames = new Set(origins.map(o => {
        try {
          return new URL(o.origin).hostname;
        } catch {
          return o.origin;
        }
      }));
      console.log(`[INSPECT_STORAGE] Origin hostnames: ${Array.from(originHostnames).sort().join(', ')}`);
    }

    // LocalStorage
    if (origins.length > 0) {
      const localStorageCount = origins.filter(o => o.localStorage && o.localStorage.length > 0).length;
      console.log(`[INSPECT_STORAGE] Origins with localStorage: ${localStorageCount}`);
    }

    // Overall structure check
    const hasRequiredFields = 'cookies' in state || 'origins' in state;
    console.log(`[INSPECT_STORAGE] Has required fields: ${hasRequiredFields}`);

    if (cookies.length === 0 && origins.length === 0) {
      console.warn('[INSPECT_STORAGE] WARNING: storageState appears empty');
      process.exit(1);
    }

    console.log('[INSPECT_STORAGE] ✅ StorageState structure OK');
    process.exit(0);

  } catch (err) {
    console.error(`[INSPECT_STORAGE] ERROR: ${err.message}`);
    process.exit(1);
  }
}

run();
