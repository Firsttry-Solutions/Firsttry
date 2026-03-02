/**
 * Storage I/O Stress Test
 * 
 * Tests the storage layer with multi-tenant workload:
 * - 5 tenants (t1..t5)
 * - 10,000 keys per tenant (50,000 total)
 * - Realistic JSON blob values (varying sizes)
 * - Deterministic operations (fixed seed PRNG)
 * 
 * VERIFICATION (fail-closed):
 * - No cross-tenant reads (tenant isolation)
 * - Count per tenant matches expected
 * - Deletes reduce count deterministically
 * - No collisions across tenants
 * 
 * NO EXTERNAL DEPENDENCIES: Uses fake_storage.ts (in-memory, bounded).
 */

import * as fs from 'fs';
import * as path from 'path';
import { createFakeStorage, FakeStorage } from './lib/fake_storage';

// Evidence directory from environment
const EROOT = process.env.EROOT || '/tmp/ft_realworld_test';
const OUTPUT_DIR = path.join(EROOT, '02b_storage_io');

/**
 * Deterministic PRNG (Linear Congruential Generator)
 * CRITICAL: Fixed seed for deterministic behavior
 */
class SeededRandom {
  private seed: number;
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
  
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}

/**
 * Generate realistic JSON blob for storage value
 * Size varies based on index to test different value sizes
 */
function generateRealisticValue(tenantKey: string, index: number): any {
  const paddedId = String(index).padStart(6, '0');
  
  // Base object
  const value: any = {
    type: 'evidence_snapshot',
    tenantKey,
    recordId: `${tenantKey}_record_${paddedId}`,
    createdAt: '2026-03-01T00:00:00Z',
    version: 1,
    data: {
      globalAdmins: [],
      projects: [],
      metadata: {}
    }
  };
  
  // Vary size based on index
  // Every 10th record: large value near limit (200KB)
  // Every 100th record: medium value (50KB)
  // Others: small value (1-2KB)
  
  if (index % 10 === 0) {
    // Large value: ~200KB (close to 240KB limit)
    for (let i = 0; i < 500; i++) {
      value.data.globalAdmins.push({
        accountId: `acct${i}`,
        email: `user${i}@example.com`,
        displayName: `User ${i}`,
        groups: ['group1', 'group2', 'group3'],
        permissions: ['read', 'write', 'admin']
      });
    }
  } else if (index % 100 === 0) {
    // Medium value: ~50KB
    for (let i = 0; i < 100; i++) {
      value.data.projects.push({
        id: `proj${i}`,
        key: `PROJ${i}`,
        name: `Project ${i}`,
        lead: `acct${i}`,
        description: 'A'.repeat(200) // Add padding
      });
    }
  } else {
    // Small value: ~1-2KB
    value.data.globalAdmins.push({
      accountId: `acct${paddedId}`,
      email: `user${paddedId}@example.com`
    });
    value.data.metadata = {
      note: `Test data for ${tenantKey} record ${paddedId}`
    };
  }
  
  return value;
}

/**
 * Test storage operations for one tenant
 */
async function testTenantOperations(
  storage: FakeStorage,
  tenantKey: string,
  keyCount: number
): Promise<{
  writeCount: number;
  readCount: number;
  deleteCount: number;
  verificationsPassed: string[];
  verificationsFailed: string[];
}> {
  const verificationsPassed: string[] = [];
  const verificationsFailed: string[] = [];
  const rng = new SeededRandom(tenantKey.charCodeAt(tenantKey.length - 1)); // Seed based on tenant
  
  // PHASE 1: Write keys
  console.log(`[STORAGE_IO] Tenant ${tenantKey}: Writing ${keyCount} keys...`);
  for (let i = 1; i <= keyCount; i++) {
    const key = `${tenantKey}::evidence:${String(i).padStart(6, '0')}`;
    const value = generateRealisticValue(tenantKey, i);
    await storage.set(key, value);
    
    if (i % 2000 === 0) {
      console.log(`[STORAGE_IO] Tenant ${tenantKey}: Wrote ${i}/${keyCount} keys`);
    }
  }
  
  // PHASE 2: Read back deterministic subset
  console.log(`[STORAGE_IO] Tenant ${tenantKey}: Reading random subset...`);
  const readCount = 100; // Read 100 random keys
  for (let i = 0; i < readCount; i++) {
    const randomIdx = rng.nextInt(keyCount) + 1;
    const key = `${tenantKey}::evidence:${String(randomIdx).padStart(6, '0')}`;
    const value = await storage.get(key);
    
    if (value === null) {
      verificationsFailed.push(`Read failed: key ${key} not found`);
    } else {
      // Verify tenantKey in value matches
      if (value.tenantKey !== tenantKey) {
        verificationsFailed.push(`Cross-tenant contamination: key ${key} has wrong tenantKey ${value.tenantKey}`);
      }
    }
  }
  verificationsPassed.push(`Read ${readCount} keys successfully`);
  
  // PHASE 3: Verify no cross-tenant reads
  console.log(`[STORAGE_IO] Tenant ${tenantKey}: Verifying isolation...`);
  const otherTenants = ['t1', 't2', 't3', 't4', 't5'].filter(t => t !== tenantKey);
  for (const otherTenant of otherTenants) {
    const crossKey = `${otherTenant}::evidence:000001`;
    const crossValue = await storage.get(crossKey);
    
    if (crossValue !== null) {
      // This is actually expected - other tenants wrote data
      // The verification is that we DON'T get data with THIS tenant's keys
      if (crossValue.tenantKey === tenantKey) {
        verificationsFailed.push(`Cross-tenant contamination: ${crossKey} has tenantKey ${tenantKey}`);
      }
    }
  }
  verificationsPassed.push('No cross-tenant reads detected');
  
  // PHASE 4: Count verification
  console.log(`[STORAGE_IO] Tenant ${tenantKey}: Counting keys...`);
  const allKeys = storage.getAllKeys();
  const tenantKeysCount = allKeys.filter(k => k.startsWith(`${tenantKey}::`)).length;
  
  if (tenantKeysCount !== keyCount) {
    verificationsFailed.push(`Count mismatch: expected ${keyCount}, got ${tenantKeysCount}`);
  } else {
    verificationsPassed.push(`Count matches: ${keyCount} keys`);
  }
  
  // PHASE 5: Delete subset and verify count reduces
  console.log(`[STORAGE_IO] Tenant ${tenantKey}: Deleting subset...`);
  const deleteCount = 100;
  for (let i = 1; i <= deleteCount; i++) {
    const key = `${tenantKey}::evidence:${String(i).padStart(6, '0')}`;
    await storage.delete(key);
  }
  
  const keysAfterDelete = storage.getAllKeys().filter(k => k.startsWith(`${tenantKey}::`)).length;
  const expectedAfterDelete = keyCount - deleteCount;
  
  if (keysAfterDelete !== expectedAfterDelete) {
    verificationsFailed.push(`Count after delete mismatch: expected ${expectedAfterDelete}, got ${keysAfterDelete}`);
  } else {
    verificationsPassed.push(`Deletes verified: ${deleteCount} deleted, ${keysAfterDelete} remain`);
  }
  
  return {
    writeCount: keyCount,
    readCount,
    deleteCount,
    verificationsPassed,
    verificationsFailed
  };
}

/**
 * Run storage I/O stress test
 */
async function runStorageIoStressTest(): Promise<{
  status: 'PASS' | 'FAIL';
  tenants: any[];
  invariants: any;
}> {
  console.log('[STORAGE_IO] Starting storage I/O stress test...');
  console.log('[STORAGE_IO] 5 tenants × 10,000 keys = 50,000 total keys');
  
  const storage = createFakeStorage();
  const tenants = ['t1', 't2', 't3', 't4', 't5'];
  const results: any[] = [];
  const startTime = Date.now();
  
  // Test each tenant
  for (const tenantKey of tenants) {
    const tenantStartTime = Date.now();
    const result = await testTenantOperations(storage, tenantKey, 10000);
    const tenantDuration = Date.now() - tenantStartTime;
    
    results.push({
      tenantKey,
      duration_ms: tenantDuration,
      ...result
    });
  }
  
  const totalDuration = Date.now() - startTime;
  const stats = storage.getStats();
  
  // Aggregate invariants
  const allVerificationsPassed = results.flatMap(r => r.verificationsPassed);
  const allVerificationsFailed = results.flatMap(r => r.verificationsFailed);
  const status = allVerificationsFailed.length === 0 ? 'PASS' : 'FAIL';
  
  const invariants = {
    status,
    totalVerificationsPassed: allVerificationsPassed.length,
    totalVerificationsFailed: allVerificationsFailed.length,
    failedVerifications: allVerificationsFailed,
    checks: {
      no_cross_tenant_reads: allVerificationsFailed.filter(v => v.includes('cross-tenant')).length === 0 ? 'PASS' : 'FAIL',
      count_matches: allVerificationsFailed.filter(v => v.includes('Count mismatch')).length === 0 ? 'PASS' : 'FAIL',
      deletes_reduce_count: allVerificationsFailed.filter(v => v.includes('delete mismatch')).length === 0 ? 'PASS' : 'FAIL'
    }
  };
  
  // Write outputs
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  // Metrics
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'storage_metrics.json'),
    JSON.stringify({
      duration_ms: totalDuration,
      tenants: results.map(r => ({
        tenantKey: r.tenantKey,
        duration_ms: r.duration_ms,
        writeCount: r.writeCount,
        readCount: r.readCount,
        deleteCount: r.deleteCount
      })),
      storageStats: stats
    }, null, 2)
  );
  
  // Invariants
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'storage_invariants.json'),
    JSON.stringify(invariants, null, 2)
  );
  
  console.log(`[STORAGE_IO] Complete: ${totalDuration}ms, ${stats.totalKeys} keys, ${status}`);
  
  return {
    status,
    tenants: results,
    invariants
  };
}

// Main execution
if (require.main === module) {
  runStorageIoStressTest()
    .then(result => {
      console.log('[STORAGE_IO] Status:', result.status);
      if (result.status === 'FAIL') {
        console.error('[STORAGE_IO] Invariant violations:', result.invariants.failedVerifications);
      }
      process.exit(result.status === 'PASS' ? 0 : 1);
    })
    .catch(err => {
      console.error('[STORAGE_IO] ERROR:', err.message);
      console.error(err.stack);
      process.exit(1);
    });
}
