/**
 * Scale Test: 5000-Object Snapshot
 * 
 * Generates synthetic evidence-like data with 5000 objects and exercises
 * the real HTML report generator and diagnostic bundle functions.
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
import { buildAuditorManifest } from '../../src/export/auditor/manifest';

// Evidence directory from environment
const EROOT = process.env.EROOT || '/tmp/ft_realworld_test';
const OUTPUT_DIR = path.join(EROOT, '01_scale');

interface ScaleTestMetrics {
  duration_ms: number;
  output_bytes: number;
  rss_bytes_before: number;
  rss_bytes_after: number;
  determinism: 'PASS' | 'FAIL';
  hash_runA: string;
  hash_runB: string;
}

/**
 * Generate deterministic synthetic evidence object with 5000 entries
 */
function generateSyntheticEvidence(size: number): any {
  const globalAdmins = [];
  const projects = [];
  const diffAdded = [];
  const diffRemoved = [];
  const remediation = [];
  
  for (let i = 1; i <= size; i++) {
    const paddedId = String(i).padStart(6, '0');
    
    // Global admins
    globalAdmins.push({
      accountId: `acct${paddedId}`,
      email: `user${paddedId}@example.com`,
      displayName: `Test User ${paddedId}`,
      active: true
    });
    
    // Projects
    projects.push({
      id: paddedId,
      key: `PROJ${paddedId}`,
      name: `Project ${paddedId}`,
      lead: `acct${paddedId}`
    });
    
    // Diff added (half of size)
    if (i <= size / 2) {
      diffAdded.push({
        accountId: `acct${paddedId}`,
        email: `user${paddedId}@example.com`
      });
    }
    
    // Diff removed (half of size)
    if (i > size / 2) {
      diffRemoved.push({
        accountId: `acct${paddedId}`,
        email: `user${paddedId}@example.com`
      });
    }
    
    // Remediation
    if (i % 100 === 0) {
      remediation.push({
        title: `Remediation ${paddedId}`,
        description: `Fix issue ${paddedId}`,
        priority: i % 3 === 0 ? 'HIGH' : 'MEDIUM'
      });
    }
  }
  
  return {
    schemaVersion: 'realworld-test-v1',
    createdAtUtc: '2026-03-01T00:00:00Z',  // Fixed for determinism
    globalAdmins,
    projects,
    diff: {
      addedGlobalAdmins: diffAdded,
      removedGlobalAdmins: diffRemoved
    },
    remediation,
    shadowAdmins: [
      {
        accountId: 'shadow001',
        reasonCodes: ['UNUSUAL_PATTERN'],
        evidence: ['test-evidence']
      }
    ]
  };
}

/**
 * Run HTML report generation with synthetic evidence
 */
function runHtmlReportGeneration(evidence: any): { html: string; size: number; hash: string } {
  // Build manifest (minimal)
  const manifest = {
    schemaVersion: 'realworld-test-v1',
    buildShaShort: 'realworld',
    buildUtc: '2026-03-01T00:00:00Z',
    siteId: 'test-scale',
    ruleSetVersion: 'test-v1',
    privilegeContext: 'test',
    evidenceSha256: sha256HexCanonicalJson(evidence).substring(0, 16)
  };
  
  const evidenceJson = canonicalStringify(evidence);
  
  // Generate HTML using real function
  const html = generateSmartHtmlReport({
    evidenceJsonString: evidenceJson,
    manifestJson: manifest,
    verifyShScript: '#!/bin/bash\necho "test"',
    verifyPs1Script: '# test'
  });
  
  const size = Buffer.from(html, 'utf-8').length;
  const hash = crypto.createHash('sha256').update(html, 'utf-8').digest('hex');
  
  return { html, size, hash };
}

/**
 * Main scale test execution
 */
async function runScaleTest(): Promise<ScaleTestMetrics> {
  console.log('[SCALE_TEST] Starting 5000-object scale test...');
  
  // Measure initial memory
  const memBefore = process.memoryUsage();
  const startTime = Date.now();
  
  // Generate synthetic evidence (deterministic)
  console.log('[SCALE_TEST] Generating synthetic evidence...');
  const evidence = generateSyntheticEvidence(5000);
  
  // RUN A: First execution
  console.log('[SCALE_TEST] Run A: Generating HTML report...');
  const resultA = runHtmlReportGeneration(evidence);
  
  // RUN B: Second execution (determinism check)
  console.log('[SCALE_TEST] Run B: Generating HTML report (determinism check)...');
  const resultB = runHtmlReportGeneration(evidence);
  
  // Measure final memory
  const memAfter = process.memoryUsage();
  const duration = Date.now() - startTime;
  
  // Check determinism
  const determinism = resultA.hash === resultB.hash ? 'PASS' : 'FAIL';
  
  if (determinism === 'FAIL') {
    console.error('[SCALE_TEST] DETERMINISM FAILURE!');
    console.error(`  Run A hash: ${resultA.hash}`);
    console.error(`  Run B hash: ${resultB.hash}`);
  } else {
    console.log(`[SCALE_TEST] Determinism: PASS (identical hashes)`);
  }
  
  const metrics: ScaleTestMetrics = {
    duration_ms: duration,
    output_bytes: resultA.size,
    rss_bytes_before: memBefore.rss,
    rss_bytes_after: memAfter.rss,
    determinism,
    hash_runA: resultA.hash,
    hash_runB: resultB.hash
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
  
  // Save small snippet of HTML (first 50KB only, rest is huge)
  const snippetSize = Math.min(50 * 1024, resultA.html.length);
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'html_snippet.txt'),
    resultA.html.substring(0, snippetSize) + '\n\n[TRUNCATED - Full size: ' + resultA.size + ' bytes]'
  );
  
  console.log(`[SCALE_TEST] Complete: ${duration}ms, ${resultA.size} bytes, ${determinism}`);
  
  return metrics;
}

// Main execution
if (require.main === module) {
  runScaleTest()
    .then(metrics => {
      console.log('[SCALE_TEST] Metrics:', JSON.stringify(metrics));
      process.exit(metrics.determinism === 'PASS' ? 0 : 1);
    })
    .catch(err => {
      console.error('[SCALE_TEST] ERROR:', err.message);
      console.error(err.stack);
      process.exit(1);
    });
}
