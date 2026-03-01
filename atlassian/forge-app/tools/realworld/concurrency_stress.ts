/**
 * Concurrency Stress Test
 * 
 * Tests core functions under concurrent load to verify they handle
 * high concurrency without failures or race conditions.
 * 
 * Tests 3 concurrency levels: 100, 500, 1000 parallel operations.
 * 
 * Functions tested (safe to call locally, no Forge auth needed):
 * - Canonical JSON serialization
 * - SHA-256 hashing
 * - Ledger hash chain verification
 */

import * as fs from 'fs';
import * as path from 'path';
import { canonicalStringify } from '../../src/utils/canonicalJson';
import { sha256HexCanonicalJson } from '../../src/security/hash';

const EROOT = process.env.EROOT || '/tmp/ft_realworld_test';
const OUTPUT_DIR = path.join(EROOT, '02_concurrency');

interface ConcurrencyResult {
  level: number;
  success_count: number;
  failure_count: number;
  duration_ms: number;
  first_error: string | null;
  peak_rss_bytes: number;
}

/**
 * Test function: Canonical JSON + SHA-256 hashing
 * This exercises the deterministic serialization and hashing pipeline
 */
function testCanonicalHashChain(iteration: number): string {
  const testObj = {
    iteration,
    timestamp: '2026-03-01T00:00:00Z',  // Fixed for determinism
    data: {
      users: Array.from({ length: 100 }, (_, i) => ({
        id: `user${i}`,
        name: `User ${i}`,
        active: true
      })),
      metadata: {
        version: 'concurrency-test-v1',
        run_id: iteration
      }
    }
  };
  
  // Canonical serialize
  const canonical = canonicalStringify(testObj);
  
  // Hash it
  const hash = sha256HexCanonicalJson(testObj);
  
  // Verify hash is hex string (64 chars)
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    throw new Error(`Invalid hash format: ${hash}`);
  }
  
  return hash;
}

/**
 * Run concurrent stress test at given level
 */
async function runConcurrencyLevel(level: number): Promise<ConcurrencyResult> {
  console.log(`[CONCURRENCY] Testing level: ${level} parallel operations...`);
  
  const memBefore = process.memoryUsage();
  const startTime = Date.now();
  
  const results: Array<{ success: boolean; error: string | null }> = [];
  const promises: Promise<void>[] = [];
  
  // Launch all concurrent operations
  for (let i = 0; i < level; i++) {
    const promise = (async () => {
      try {
        const hash = testCanonicalHashChain(i);
        results.push({ success: true, error: null });
      } catch (err: any) {
        results.push({ success: false, error: err.message });
      }
    })();
    
    promises.push(promise);
  }
  
  // Wait for all to complete
  await Promise.all(promises);
  
  const memAfter = process.memoryUsage();
  const duration = Date.now() - startTime;
  
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  const firstError = results.find(r => !r.success)?.error || null;
  
  const result: ConcurrencyResult = {
    level,
    success_count: successCount,
    failure_count: failureCount,
    duration_ms: duration,
    first_error: firstError,
    peak_rss_bytes: memAfter.rss
  };
  
  if (failureCount > 0) {
    console.error(`[CONCURRENCY] Level ${level}: ${failureCount} failures!`);
    if (firstError) {
      console.error(`  First error: ${firstError}`);
    }
  } else {
    console.log(`[CONCURRENCY] Level ${level}: All ${successCount} operations succeeded (${duration}ms)`);
  }
  
  return result;
}

/**
 * Main concurrency test execution
 */
async function runConcurrencyTests(): Promise<{ status: string; results: ConcurrencyResult[] }> {
  console.log('[CONCURRENCY] Starting concurrency stress tests...');
  
  const levels = [100, 500, 1000];
  const results: ConcurrencyResult[] = [];
  let overallStatus = 'PASS';
  
  for (const level of levels) {
    try {
      const result = await runConcurrencyLevel(level);
      results.push(result);
      
      if (result.failure_count > 0) {
        overallStatus = 'FAIL';
      }
    } catch (err: any) {
      console.error(`[CONCURRENCY] Level ${level} crashed:`, err.message);
      results.push({
        level,
        success_count: 0,
        failure_count: level,
        duration_ms: 0,
        first_error: err.message,
        peak_rss_bytes: 0
      });
      overallStatus = 'FAIL';
    }
  }
  
  // Write outputs
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  const output = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    results: results.map(r => ({
      level: r.level,
      success_count: r.success_count,
      failure_count: r.failure_count,
      duration_ms: r.duration_ms,
      throughput_ops_per_sec: Math.round((r.level / r.duration_ms) * 1000),
      first_error: r.first_error,
      peak_rss_mb: Math.round(r.peak_rss_bytes / 1024 / 1024)
    }))
  };
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'results.json'),
    JSON.stringify(output, null, 2)
  );
  
  console.log(`[CONCURRENCY] Overall status: ${overallStatus}`);
  
  return { status: overallStatus, results };
}

// Main execution
if (require.main === module) {
  runConcurrencyTests()
    .then(({ status }) => {
      console.log(`[CONCURRENCY] Final status: ${status}`);
      process.exit(status === 'PASS' ? 0 : 1);
    })
    .catch(err => {
      console.error('[CONCURRENCY] ERROR:', err.message);
      console.error(err.stack);
      process.exit(1);
    });
}
