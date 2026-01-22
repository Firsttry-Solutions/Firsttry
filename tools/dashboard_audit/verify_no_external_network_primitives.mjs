#!/usr/bin/env node
/**
 * AUDIT: Verify NO external network primitives in gadget UI
 * 
 * Scans gadget-ui sources (index.html and src/*.ts) and verifies:
 * 1. No fetch( calls (except Forge invoke which is allowed)
 * 2. No XMLHttpRequest usage
 * 3. No WebSocket usage
 * 4. No sendBeacon or navigator.sendBeacon usage
 * 
 * These are "accidental connection" guards - should fail if found.
 * Forge invoke() is allowed (it's the correct way to call backend).
 * 
 * Exit: 0 (PASS), 1 (FAIL), 2 (file not found)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const GADGET_UI_DIR = path.join(process.cwd(), 'atlassian/forge-app/src/gadget-ui');

// Forbidden network primitives
const FORBIDDEN_PATTERNS = [
  { name: 'fetch(', pattern: /fetch\s*\(/ },
  { name: 'XMLHttpRequest', pattern: /XMLHttpRequest/ },
  { name: 'WebSocket', pattern: /WebSocket/ },
  { name: 'sendBeacon', pattern: /sendBeacon/ },
];

function main() {
  // Check directory exists
  if (!fs.existsSync(GADGET_UI_DIR)) {
    console.error(`[NETWORK_VERIFY_FAIL] Directory not found: ${GADGET_UI_DIR}`);
    process.exit(2);
  }

  const issues = [];

  // Grep for forbidden patterns
  FORBIDDEN_PATTERNS.forEach(({ name, pattern }) => {
    try {
      // Use grep to find matches (safer than regex in large files)
      // Skip node_modules and build artifacts
      const cmd = `grep -r "${name}" "${GADGET_UI_DIR}" --include="*.ts" --include="*.tsx" --include="*.html" --exclude-dir=node_modules --exclude-dir=dist 2>/dev/null || true`;
      const result = execSync(cmd, { encoding: 'utf-8' });
      
      if (result.trim()) {
        // Found the pattern, check if it's a false positive
        const lines = result.split('\n').filter(l => l.length > 0);
        
        // Common false positives:
        // - Comments mentioning fetch/WebSocket
        // - Import statements that are type-only
        const realMatches = lines.filter(l => {
          // Skip comments and imports
          if (l.includes('//') || l.includes('/*') || l.includes('*')) return false;
          if (l.includes('import') && name === 'XMLHttpRequest') return false;
          return true;
        });

        if (realMatches.length > 0) {
          issues.push(`Found ${name}: ${realMatches[0].substring(0, 100)}`);
        }
      }
    } catch (err) {
      // grep failed, likely no matches (expected for patterns that don't exist)
    }
  });

  if (issues.length > 0) {
    console.error('[NETWORK_VERIFY_FAIL] External network primitives found in gadget-ui:');
    issues.forEach(issue => console.error(`  - ${issue}`));
    process.exit(1);
  }

  console.log('[NETWORK_VERIFY_OK] No external network primitives (fetch, XMLHttpRequest, WebSocket, sendBeacon) found in gadget-ui');
  process.exit(0);
}

main();
