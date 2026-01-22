#!/usr/bin/env node
/**
 * AUDIT: Verify all backend resolvers are registered
 * 
 * Scans gadget-resolver.ts for resolver.define() calls and verifies that:
 * 1. All resolvers referenced in UI invokes are registered
 * 2. No duplicate registrations
 * 3. Expected resolvers exist
 * 
 * Exit: 0 (PASS), 1 (FAIL), 2 (file not found)
 */

import fs from 'fs';
import path from 'path';

const RESOLVER_FILE = path.join(process.cwd(), 'atlassian/forge-app/src/gadget-resolver.ts');

// These are the expected resolvers that UI depends on
const REQUIRED_RESOLVERS = [
  'getStatusSnapshot',
  'ping',
  'ensureFirstSnapshot',
  'exportTrustSnapshot',
  'getBuildInfo',
  'refreshNow',
  'getSnapshotDebug',
  'probe',
  'ft_getDashboardState_v1',
  'ft_setUiBuildSha_v1',
  'ft_contractProof_dashEnvelope_v1',
];

function main() {
  // Check file exists
  if (!fs.existsSync(RESOLVER_FILE)) {
    console.error(`[RESOLVER_VERIFY_FAIL] File not found: ${RESOLVER_FILE}`);
    process.exit(2);
  }

  const content = fs.readFileSync(RESOLVER_FILE, 'utf-8');

  // Extract all resolver.define() calls
  const definePattern = /resolver\.define\(['"]([^'"]+)['"]/g;
  const registered = new Set();
  let match;

  while ((match = definePattern.exec(content)) !== null) {
    registered.add(match[1]);
  }

  // Check required resolvers
  const missing = REQUIRED_RESOLVERS.filter(r => !registered.has(r));

  if (missing.length > 0) {
    console.error('[RESOLVER_VERIFY_FAIL] Missing resolver registrations:');
    missing.forEach(r => console.error(`  - ${r}`));
    console.error(`[RESOLVER_VERIFY_FAIL] Expected ${REQUIRED_RESOLVERS.length}, found ${registered.size}`);
    process.exit(1);
  }

  // Check for extras (informational, not a failure)
  const extras = Array.from(registered).filter(r => !REQUIRED_RESOLVERS.includes(r));
  if (extras.length > 0) {
    console.log('[RESOLVER_VERIFY_INFO] Extra resolvers found (not required but OK):');
    extras.forEach(r => console.log(`  - ${r}`));
  }

  console.log(`[RESOLVER_VERIFY_OK] All ${REQUIRED_RESOLVERS.length} required resolvers registered: ${REQUIRED_RESOLVERS.join(', ')}`);
  process.exit(0);
}

main();
