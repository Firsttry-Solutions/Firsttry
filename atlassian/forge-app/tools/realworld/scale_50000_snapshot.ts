/**
 * Scale Test: 50,000-Entity Snapshot
 * 
 * Generates synthetic evidence-like data with 50,000 total entities distributed
 * across arrays and exercises the real HTML report generator.
 * 
 * Entity distribution:
 * - 10,000 globalAdmins
 * - 10,000 shadowAdmins (high volume shadow detection)
 * - 10,000 projects
 * - 20,000 diff items (10k added, 10k removed)
 * 
 * Deterministic: Run twice and compare SHA-256 hashes to verify determinism.
 * 
 * NO DEPENDENCIES: Uses existing canonicalization and hashing utilities.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { canonicalStringify } from '../../src/utils/canonicalJson';
import { sha256HexCanonicalJson } from '../../src/security/hash';
import { generateSmartHtmlReport } from '../../src/export/auditor/htmlReport';

// Evidence directory from environment
const EROOT = process.env.EROOT || '/tmp/ft_realworld_test';
const OUTPUT_DIR = path.join(EROOT, '01b_scale_50k');

interface ScaleTestMetrics {
  duration_ms: number;
  output_bytes: number;
  heap_used_bytes: number;
  determinism: 'PASS' | 'FAIL';
  hash_runA: string;
  hash_runB: string;
  entity_count: number;
}

/**
 * Generate deterministic synthetic evidence object with 50,000 total entities
 */
function generateSyntheticEvidence(): any {
  const globalAdmins = [];
  const shadowAdmins = [];
  const projects = [];
  const diffAdded = [];
  const diffRemoved = [];
  const remediation = [];
  
  // 10,000 global admins
  for (let i = 1; i <= 10000; i++) {
    const paddedId = String(i).padStart(6, '0');
    globalAdmins.push({
      accountId: `acct${paddedId}`,
      email: `user${paddedId}@example.com`,
      displayName: `Test User ${paddedId}`,
      active: true
    });
  }
  
  // 10,000 shadow admins (high-volume shadow detection scenario)
  for (let i = 1; i <= 10000; i++) {
    const paddedId = String(i).padStart(6, '0');
    shadowAdmins.push({
      accountId: `shadow${paddedId}`,
      reasonCodes: ['UNUSUAL_PATTERN', 'PERMISSION_ESCALATION'],
      evidence: [`evidence-${paddedId}-a`, `evidence-${paddedId}-b`],
      riskScore: 0.75
    });
  }
  
  // 10,000 projects
  for (let i = 1; i <= 10000; i++) {
    const paddedId = String(i).padStart(6, '0');
    projects.push({
      id: paddedId,
      key: `PROJ${paddedId}`,
      name: `Project ${paddedId}`,
      lead: `acct${paddedId}`,
      type: i % 3 === 0 ? 'software' : 'business'
    });
  }
  
  // 10,000 diff added
  for (let i = 1; i <= 10000; i++) {
    const paddedId = String(i).padStart(6, '0');
    diffAdded.push({
      accountId: `new${paddedId}`,
      email: `newuser${paddedId}@example.com`,
      addedAt: '2026-03-01T00:00:00Z'
    });
  }
  
  // 10,000 diff removed
  for (let i = 1; i <= 10000; i++) {
    const paddedId = String(i).padStart(6, '0');
    diffRemoved.push({
      accountId: `removed${paddedId}`,
      email: `olduser${paddedId}@example.com`,
      removedAt: '2026-03-01T00:00:00Z'
    });
  }
  
  // 500 remediation items (realistic for enterprise audit)
  for (let i = 1; i <= 500; i++) {
    const paddedId = String(i).padStart(6, '0');
    remediation.push({
      title: `Remediation ${paddedId}`,
      description: `Fix issue ${paddedId}`,
      priority: i % 3 === 0 ? 'HIGH' : i % 5 === 0 ? 'CRITICAL' : 'MEDIUM'
    });
  }
  
  return {
    schemaVersion: 'realworld-test-v2',
    createdAtUtc: '2026-03-01T00:00:00Z',  // Fixed for determinism
    globalAdmins,
    shadowAdmins,
    projects,
    diff: {
      addedGlobalAdmins: diffAdded,
      removedGlobalAdmins: diffRemoved
    },
    remediation,
    metadata: {
      testRun: 'scale_50k',
      entityCount: 50000
    }
  };
}

/**
 * Run HTML report generation with synthetic evidence
 */
function runHtmlReportGeneration(evidence: any): { html: string; size: number; hash: string } {
  // Build manifest (minimal)
  const manifest = {
    schemaVersion: 'realworld-test-v2',
    buildShaShort: 'realworld50k',
    buildUtc: '2026-03-01T00:00:00Z',
    siteId: 'test-scale-50k',
    ruleSetVersion: 'test-v2',
    privilegeContext: 'test',
    evidenceSha256: sha256HexCanonicalJson(evidence).substring(0, 16)
  };
  
  const evidenceJson = canonicalStringify(evidence);
  
  // Generate HTML using real function
  const html = generateSmartHtmlReport({
    evidenceJsonString: evidenceJson,
    manifestJson: manifest,
    verifyShScript: '#!/bin/bash\necho "test-50k"',
    verifyPs1Script: '# test-50k'
  });
  
  const size = Buffer.from(html, 'utf-8').length;
  const hash = crypto.createHash('sha256').update(html, 'utf-8').digest('hex');
  
  return { html, size, hash };
}

/**
 * Main scale test execution
 */
async function runScaleTest(): Promise<ScaleTestMetrics> {
  console.log('[SCALE_TEST_50K] Starting 50,000-entity scale test...');
  
  // Measure initial memory
  const memBefore = process.memoryUsage();
  const startTime = Date.now();
  
  // Generate synthetic evidence (deterministic)
  console.log('[SCALE_TEST_50K] Generating synthetic evidence (50k entities)...');
  const evidence = generateSyntheticEvidence();
  
  // Count entities
  const entityCount = 
    evidence.globalAdmins.length + 
    evidence.shadowAdmins.length +
    evidence.projects.length +
    evidence.diff.addedGlobalAdmins.length +
    evidence.diff.removedGlobalAdmins.length +
    evidence.remediation.length;
  
  console.log(`[SCALE_TEST_50K] Generated ${entityCount} entities`);
  
  // RUN A: First execution
  console.log('[SCALE_TEST_50K] Run A: Generating HTML report...');
  const resultA = runHtmlReportGeneration(evidence);
  
  // RUN B: Second execution (determinism check)
  console.log('[SCALE_TEST_50K] Run B: Generating HTML report (determinism check)...');
  const resultB = runHtmlReportGeneration(evidence);
  
  // Measure final memory
  const memAfter = process.memoryUsage();
  const duration = Date.now() - startTime;
  
  // Check determinism
  const determinism = resultA.hash === resultB.hash ? 'PASS' : 'FAIL';
  
  if (determinism === 'FAIL') {
    console.error('[SCALE_TEST_50K] DETERMINISM FAILURE!');
    console.error(`  Run A hash: ${resultA.hash}`);
    console.error(`  Run B hash: ${resultB.hash}`);
  } else {
    console.log(`[SCALE_TEST_50K] Determinism: PASS (identical hashes)`);
  }
  
  const metrics: ScaleTestMetrics = {
    duration_ms: duration,
    output_bytes: resultA.size,
    heap_used_bytes: memAfter.heapUsed,
    determinism,
    hash_runA: resultA.hash,
    hash_runB: resultB.hash,
    entity_count: entityCount
  };
  
  // Write outputs
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  // Save hashes
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'output_hashes.json'),
    JSON.stringify({
      runA: resultA.hash,
      runB: resultB.hash,
      match: determinism === 'PASS'
    }, null, 2)
  );
  
  // Save metrics
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'metrics.json'),
    JSON.stringify(metrics, null, 2)
  );
  
  // Save small snippet of HTML (first 2KB only as specified)
  const snippetSize = Math.min(2 * 1024, resultA.html.length);
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'html_snippet.txt'),
    resultA.html.substring(0, snippetSize) + '\n\n[TRUNCATED - Full size: ' + resultA.size + ' bytes]'
  );
  
  console.log(`[SCALE_TEST_50K] Complete: ${duration}ms, ${resultA.size} bytes, ${determinism}`);
  console.log(`[SCALE_TEST_50K] Heap used: ${Math.round(memAfter.heapUsed / 1024 / 1024)} MB`);
  
  return metrics;
}

// Main execution
if (require.main === module) {
  runScaleTest()
    .then(metrics => {
      console.log('[SCALE_TEST_50K] Metrics:', JSON.stringify(metrics));
      process.exit(metrics.determinism === 'PASS' ? 0 : 1);
    })
    .catch(err => {
      console.error('[SCALE_TEST_50K] ERROR:', err.message);
      console.error(err.stack);
      process.exit(1);
    });
}
