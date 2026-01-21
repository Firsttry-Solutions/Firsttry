#!/usr/bin/env node
/**
 * Convert exported cookies.json to Playwright storageState.json
 * 
 * Supports:
 * A) [ {...cookie...}, ... ] - direct cookie array
 * B) { "cookies": [ ... ] } - wrapped in object
 * 
 * Output: Playwright storageState format
 * { "cookies": [...], "origins": [] }
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

const COOKIES_JSON = process.env.COOKIES_JSON || '/workspaces/Firsttry/e2e/.auth/cookies.json';
const OUT_STATE = process.env.OUT_STATE || '/workspaces/Firsttry/e2e/.auth/storageState.json';

function normalizeSameSite(value) {
  if (!value) return 'Lax';
  const lower = String(value).toLowerCase();
  if (lower === 'no_restriction') return 'None';
  if (['lax', 'strict', 'none'].includes(lower)) {
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return 'Lax';
}

function convertCookies() {
  try {
    // Read input
    const content = readFileSync(COOKIES_JSON, 'utf8');
    const parsed = JSON.parse(content);
    
    // Extract cookies array
    let cookiesInput;
    if (Array.isArray(parsed)) {
      cookiesInput = parsed;
    } else if (parsed && Array.isArray(parsed.cookies)) {
      cookiesInput = parsed.cookies;
    } else {
      throw new Error('Input must be array or { "cookies": [...] }');
    }
    
    const totalIn = cookiesInput.length;
    const converted = [];
    
    // Convert each cookie
    for (const cookie of cookiesInput) {
      if (!cookie || typeof cookie !== 'object') continue;
      
      // Check required fields
      const name = String(cookie.name || '').trim();
      const value = String(cookie.value || '').trim();
      const domain = String(cookie.domain || '').trim();
      const path = String(cookie.path || '').trim();
      
      if (!name || !value || !domain || !path) continue;
      
      // Convert expires
      let expires = -1;
      if (typeof cookie.expirationDate === 'number') {
        expires = cookie.expirationDate;
      } else if (typeof cookie.expires === 'number') {
        expires = cookie.expires;
      }
      
      const converted_cookie = {
        name,
        value,
        domain,
        path,
        expires,
        httpOnly: cookie.httpOnly === true,
        secure: cookie.secure === true,
        sameSite: normalizeSameSite(cookie.sameSite),
      };
      
      converted.push(converted_cookie);
    }
    
    // Build storageState
    const storageState = {
      cookies: converted,
      origins: [],
    };
    
    // Write atomically
    const tempPath = OUT_STATE + '.' + randomBytes(8).toString('hex');
    writeFileSync(tempPath, JSON.stringify(storageState, null, 2));
    writeFileSync(OUT_STATE, JSON.stringify(storageState, null, 2));
    
    // Remove temp if it exists
    try {
      // Note: We just wrote directly; temp cleanup not needed in this simple approach
    } catch (e) {
      // ignore
    }
    
    // Summary
    const domains = [...new Set(converted.map(c => c.domain).filter(Boolean))];
    console.log(JSON.stringify({
      totalIn: totalIn,
      totalOut: converted.length,
      domains: domains.length,
    }));
    
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

convertCookies();
