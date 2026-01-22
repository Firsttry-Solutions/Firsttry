#!/usr/bin/env node
/**
 * verify_no_global_auth_injection.mjs
 * 
 * Security gate to prevent regressions in Authorization header handling.
 * 
 * Fails if:
 * - playwright.config.ts has global extraHTTPHeaders with Authorization
 * - Scripts attach Authorization headers without shouldAttachAuth() check
 * 
 * Exit codes:
 *   0 - OK: No unsafe global auth injection detected
 *   1 - FAIL: Unsafe pattern detected
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');

function checkFile(filePath, rules) {
  console.log(`\n[VERIFY_AUTH] Checking: ${filePath}`);
  
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch (e) {
    console.error(`[VERIFY_AUTH] ❌ File not readable: ${e.message}`);
    return false;
  }
  
  for (const rule of rules) {
    console.log(`[VERIFY_AUTH]   Rule: ${rule.description}`);
    
    if (rule.shouldNotContain) {
      for (const pattern of rule.shouldNotContain) {
        const regex = typeof pattern === 'string' ? new RegExp(pattern, 'gi') : pattern;
        const matches = content.match(regex);
        
        if (matches && matches.length > 0) {
          console.error(`[VERIFY_AUTH]   ❌ FAIL: Found unsafe pattern: ${pattern}`);
          for (let i = 0; i < matches.length && i < 3; i++) {
            console.error(`[VERIFY_AUTH]      Match ${i + 1}: "${matches[i]}"`);
          }
          return false;
        }
      }
    }
    
    if (rule.mustContain) {
      const regex = typeof rule.mustContain === 'string' ? new RegExp(rule.mustContain) : rule.mustContain;
      if (!regex.test(content)) {
        console.error(`[VERIFY_AUTH]   ❌ FAIL: Required pattern not found: ${rule.mustContain}`);
        return false;
      }
    }
    
    console.log(`[VERIFY_AUTH]   ✓ Pass`);
  }
  
  return true;
}

async function main() {
  console.log('[VERIFY_AUTH] ═══════════════════════════════════════════════════════════');
  console.log('[VERIFY_AUTH] Security Gate: No Global Authorization Injection');
  console.log('[VERIFY_AUTH] ═══════════════════════════════════════════════════════════');
  
  let allPass = true;
  
  // Rule 1: playwright.config.ts must NOT have global extraHTTPHeaders with Authorization
  const playwrightConfigPath = resolve(REPO_ROOT, 'e2e/playwright.config.ts');
  allPass &= checkFile(playwrightConfigPath, [
    {
      description: 'No global extraHTTPHeaders with Authorization',
      shouldNotContain: [
        /extraHTTPHeaders\s*:\s*\{[\s\S]*?Authorization[\s\S]*?\}/,
        /'Authorization'\s*:\s*'Basic/,
        /"Authorization"\s*:\s*"Basic/,
      ],
    },
    {
      description: 'Should mention safe per-route injection',
      mustContain: /createAuthRouteHandler|per-route/,
    },
  ]);
  
  // Rule 2: auth_preflight_check.mjs must NOT have global context.setExtraHTTPHeaders with auth
  const preflightPath = resolve(REPO_ROOT, 'e2e/scripts/auth_preflight_check.mjs');
  allPass &= checkFile(preflightPath, [
    {
      description: 'No context.setExtraHTTPHeaders with Authorization',
      shouldNotContain: [
        /context\.setExtraHTTPHeaders.*Authorization/,
      ],
    },
    {
      description: 'Should use createAuthRouteHandler',
      mustContain: /createAuthRouteHandler/,
    },
  ]);
  
  // Rule 3: auth_smoke_strict.mjs must NOT have global context.setExtraHTTPHeaders with auth
  const smokeTestPath = resolve(REPO_ROOT, 'e2e/scripts/auth_smoke_strict.mjs');
  allPass &= checkFile(smokeTestPath, [
    {
      description: 'No context.setExtraHTTPHeaders with Authorization',
      shouldNotContain: [
        /context\.setExtraHTTPHeaders.*Authorization/,
      ],
    },
    {
      description: 'Should use createAuthRouteHandler',
      mustContain: /createAuthRouteHandler/,
    },
  ]);
  
  // Rule 4: Verify _auth_headers.mjs exists and has shouldAttachAuth
  const authHeadersPath = resolve(REPO_ROOT, 'e2e/scripts/_auth_headers.mjs');
  allPass &= checkFile(authHeadersPath, [
    {
      description: 'Exports shouldAttachAuth function',
      mustContain: /export\s+function\s+shouldAttachAuth/,
    },
    {
      description: 'Exports createAuthRouteHandler function',
      mustContain: /export\s+.*createAuthRouteHandler/,
    },
    {
      description: 'Checks hostname === firsttry.atlassian.net',
      mustContain: /firsttry\.atlassian\.net/,
    },
    {
      description: 'Checks path starts with /rest/api/',
      mustContain: /\/rest\/api\//,
    },
    {
      description: 'Has AUTH_GUARD check',
      mustContain: /AUTH_GUARD|prevent.*leak|off-domain/i,
    },
  ]);
  
  console.log('\n[VERIFY_AUTH] ═══════════════════════════════════════════════════════════');
  
  if (allPass) {
    console.log('[VERIFY_AUTH] ✅ ALL CHECKS PASSED - No unsafe auth injection detected');
    console.log('[VERIFY_AUTH] ═══════════════════════════════════════════════════════════');
    process.exit(0);
  } else {
    console.error('[VERIFY_AUTH] ❌ SECURITY GATE FAILED - Unsafe patterns detected');
    console.error('[VERIFY_AUTH] ═══════════════════════════════════════════════════════════');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[VERIFY_AUTH] Fatal error:', err.message);
  process.exit(1);
});
