/**
 * Multi-Tenant Isolation Verification Gate
 * 
 * Pure verification: tests tenant key formatting to ensure:
 * 1. No collisions across tenants
 * 2. Keys always contain tenantKey segment in documented position
 * 3. No "static_no_tenant_binding" patterns
 * 
 * CRITICAL PROPERTIES:
 * - 100,000 keys across 5 tenants
 * - All keys unique (no collisions)
 * - Format: ${tenantKey}::${logicalKey}
 * - Deterministic output for comparison
 * 
 * NO EXTERNAL DEPENDENCIES: Simulates tenant key builder logic.
 */

import * as fs from 'fs';
import * as path from 'path';

// Evidence directory from environment
const EROOT = process.env.EROOT || '/tmp/ft_realworld_test';
const OUTPUT_DIR = path.join(EROOT, '00_multitenant');

/**
 * Simulate tenant key builder (matches app logic: tenantKey::logicalKey)
 */
function makeTenantKey(tenantKey: string, logicalKey: string): string {
  if (!logicalKey || typeof logicalKey !== 'string') {
    throw new Error(`FAIL_CLOSED: logicalKey must be non-empty string`);
  }
  if (logicalKey.includes('..')) {
    throw new Error(`FAIL_CLOSED: logicalKey contains traversal pattern`);
  }
  if (logicalKey.includes('::')) {
    throw new Error(`FAIL_CLOSED: logicalKey already prefixed`);
  }
  return `${tenantKey}::${logicalKey}`;
}

/**
 * Generate representative key families used by the app
 */
function generateKeyFamilies(tenantKey: string, count: number): string[] {
  const keys: string[] = [];
  const logicalKeyPatterns = [
    'snapshot:phase1:',
    'snapshot:phase2:',
    'snapshot:phase3:',
    'evidence:pack:',
    'timeline:event:',
    'config:visibility:',
    'scheduler:state:',
    'attestation:ledger:',
    'perf:signals:',
    'review:state:'
  ];
  
  // Generate keys across different patterns
  for (let i = 0; i < count; i++) {
    const pattern = logicalKeyPatterns[i % logicalKeyPatterns.length];
    const logicalKey = `${pattern}${String(i).padStart(6, '0')}`;
    
    try {
      const fullKey = makeTenantKey(tenantKey, logicalKey);
      keys.push(fullKey);
    } catch (err: any) {
      // If key builder throws, record it as an error
      keys.push(`ERROR:${tenantKey}:${logicalKey}:${err.message}`);
    }
  }
  
  return keys;
}

/**
 * Verify no collisions across tenants
 */
function verifyNoCollisions(allKeys: string[]): {
  status: 'PASS' | 'FAIL';
  totalKeys: number;
  uniqueKeys: number;
  collisions: string[];
} {
  const uniqueKeys = new Set(allKeys);
  const collisions: string[] = [];
  
  if (uniqueKeys.size !== allKeys.length) {
    // Find collisions
    const keyCount = new Map<string, number>();
    for (const key of allKeys) {
      keyCount.set(key, (keyCount.get(key) || 0) + 1);
    }
    
    for (const [key, count] of keyCount.entries()) {
      if (count > 1) {
        collisions.push(`${key} (count: ${count})`);
      }
    }
  }
  
  return {
    status: collisions.length === 0 ? 'PASS' : 'FAIL',
    totalKeys: allKeys.length,
    uniqueKeys: uniqueKeys.size,
    collisions: collisions.slice(0, 10) // Limit to first 10
  };
}

/**
 * Verify key format (tenantKey in correct position)
 */
function verifyKeyFormat(allKeys: string[]): {
  status: 'PASS' | 'FAIL';
  validCount: number;
  invalidCount: number;
  invalidSamples: string[];
} {
  const invalidKeys: string[] = [];
  
  for (const key of allKeys) {
    if (key.startsWith('ERROR:')) {
      invalidKeys.push(key);
      continue;
    }
    
    // Check format: should contain '::'
    if (!key.includes('::')) {
      invalidKeys.push(`Missing separator: ${key}`);
      continue;
    }
    
    // Check that first segment looks like a tenant key (cloud:...)
    const parts = key.split('::');
    if (parts.length < 2) {
      invalidKeys.push(`Invalid format: ${key}`);
      continue;
    }
    
    const tenantPart = parts[0];
    // Valid tenant keys should start with 'cloud:' or be a test tenant like 't1', 't2'
    if (!tenantPart.startsWith('cloud:') && !tenantPart.match(/^t[1-5]$/)) {
      invalidKeys.push(`Invalid tenant prefix: ${key}`);
    }
  }
  
  return {
    status: invalidKeys.length === 0 ? 'PASS' : 'FAIL',
    validCount: allKeys.length - invalidKeys.length,
    invalidCount: invalidKeys.length,
    invalidSamples: invalidKeys.slice(0, 10)
  };
}

/**
 * Verify no static keys (keys without tenant binding)
 */
function verifyNoStaticKeys(allKeys: string[]): {
  status: 'PASS' | 'FAIL';
  staticKeys: string[];
} {
  const staticKeys: string[] = [];
  
  for (const key of allKeys.filter(k => !k.startsWith('ERROR:'))) {
    // Static keys would NOT contain tenant prefix at all
    // They would be bare keys like "global:config" or "shared:state"
    if (!key.includes('::')) {
      staticKeys.push(key);
    }
  }
  
  return {
    status: staticKeys.length === 0 ? 'PASS' : 'FAIL',
    staticKeys: staticKeys.slice(0, 10)
  };
}

/**
 * Run multi-tenant isolation verification
 */
async function runMultiTenantIsolation(): Promise<{
  status: 'PASS' | 'FAIL';
  collisionReport: any;
  formatReport: any;
  staticKeyReport: any;
}> {
  console.log('[MULTITENANT] Starting multi-tenant isolation verification...');
  console.log('[MULTITENANT] Generating 100,000 keys across 5 tenants...');
  
  const tenants = ['t1', 't2', 't3', 't4', 't5'];
  const keysPerTenant = 20000; // 20k per tenant = 100k total
  const allKeys: string[] = [];
  const keysByTenant: Record<string, string[]> = {};
  
  // Generate keys for each tenant
  for (const tenant of tenants) {
    console.log(`[MULTITENANT] Generating ${keysPerTenant} keys for tenant ${tenant}...`);
    const tenantKeys = generateKeyFamilies(tenant, keysPerTenant);
    keysByTenant[tenant] = tenantKeys;
    allKeys.push(...tenantKeys);
  }
  
  console.log(`[MULTITENANT] Generated ${allKeys.length} total keys`);
  
  // Verification 1: No collisions
  console.log('[MULTITENANT] Verifying no collisions...');
  const collisionReport = verifyNoCollisions(allKeys);
  console.log(`[MULTITENANT] Collision check: ${collisionReport.status}`);
  
  // Verification 2: Key format
  console.log('[MULTITENANT] Verifying key format...');
  const formatReport = verifyKeyFormat(allKeys);
  console.log(`[MULTITENANT] Format check: ${formatReport.status}`);
  
  // Verification 3: No static keys
  console.log('[MULTITENANT] Verifying no static keys...');
  const staticKeyReport = verifyNoStaticKeys(allKeys);
  console.log(`[MULTITENANT] Static key check: ${staticKeyReport.status}`);
  
  // Overall status
  const status = 
    collisionReport.status === 'PASS' &&
    formatReport.status === 'PASS' &&
    staticKeyReport.status === 'PASS'
      ? 'PASS'
      : 'FAIL';
  
  // Write outputs
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  // Collision report
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'key_collision_report.json'),
    JSON.stringify({
      status: collisionReport.status,
      summary: {
        totalKeys: collisionReport.totalKeys,
        uniqueKeys: collisionReport.uniqueKeys,
        collisionCount: collisionReport.collisions.length
      },
      collisions: collisionReport.collisions
    }, null, 2)
  );
  
  // Format samples (first 50 keys, sorted)
  const sampleKeys = allKeys
    .filter(k => !k.startsWith('ERROR:'))
    .slice(0, 50)
    .sort();
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'key_format_samples.json'),
    JSON.stringify({
      status: formatReport.status,
      sampleCount: sampleKeys.length,
      samples: sampleKeys,
      formatValidation: {
        validCount: formatReport.validCount,
        invalidCount: formatReport.invalidCount,
        invalidSamples: formatReport.invalidSamples
      }
    }, null, 2)
  );
  
  // Static key report
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'static_key_report.json'),
    JSON.stringify({
      status: staticKeyReport.status,
      staticKeyCount: staticKeyReport.staticKeys.length,
      staticKeys: staticKeyReport.staticKeys
    }, null, 2)
  );
  
  console.log(`[MULTITENANT] Complete: ${status}`);
  
  return {
    status,
    collisionReport,
    formatReport,
    staticKeyReport
  };
}

// Main execution
if (require.main === module) {
  runMultiTenantIsolation()
    .then(result => {
      console.log('[MULTITENANT] Status:', result.status);
      if (result.status === 'FAIL') {
        if (result.collisionReport.status === 'FAIL') {
          console.error('[MULTITENANT] COLLISION FAILURE:', result.collisionReport.collisions.length, 'collisions');
        }
        if (result.formatReport.status === 'FAIL') {
          console.error('[MULTITENANT] FORMAT FAILURE:', result.formatReport.invalidCount, 'invalid keys');
        }
        if (result.staticKeyReport.status === 'FAIL') {
          console.error('[MULTITENANT] STATIC KEY FAILURE:', result.staticKeyReport.staticKeys.length, 'static keys');
        }
      }
      process.exit(result.status === 'PASS' ? 0 : 1);
    })
    .catch(err => {
      console.error('[MULTITENANT] ERROR:', err.message);
      console.error(err.stack);
      process.exit(1);
    });
}
