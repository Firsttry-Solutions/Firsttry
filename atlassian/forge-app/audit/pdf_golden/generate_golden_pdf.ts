/**
 * Golden PDF Harness for Trust Snapshot Export
 * 
 * Paranoid release engineer tool for offline verification:
 * - Generates deterministic sample PDF twice
 * - Validates byte-for-byte determinism (SHA256 match required)
 * - Validates PDF structure (header, EOF, size)
 * - Saves artifacts for manual inspection
 * - No Jira/Forge API calls (safe for CI/CD and local development)
 * 
 * Usage:
 *   npx ts-node audit/pdf_golden/generate_golden_pdf.ts
 * 
 * Expected output:
 *   - audit/pdf_golden/out/sample_snapshot.json (input)
 *   - audit/pdf_golden/out/sample_snapshot.pdf (generated)
 *   - Determinism verification: ✓ PASS (both runs identical)
 *   - Structure validation: ✓ PASS (header, EOF, size)
 */

import { generateTrustSnapshotPdf } from '../../src/core/audit_snapshot/exportPdf';
import { TrustSnapshot, SnapshotRecord } from '../../src/core/audit_snapshot/types';
import { createHash } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// ============================================================================
// DETERMINISTIC SAMPLE DATA
// ============================================================================

const SAMPLE_SNAPSHOT: TrustSnapshot = {
  generatedAtISO: '2026-01-08T14:30:00Z',
  window: 'point-in-time',
  versioning: {
    appVersion: '1.0.0',
    environment: 'production',
    deployedAtISO: '2025-11-15T10:00:00Z',
  },
  operationalState: {
    status: 'RUNNING',
    lastSuccessfulRunAtISO: '2026-01-08T14:25:00Z',
    consecutiveDaysOperational: 45,
  },
  monitoringContinuity: {
    schedulerActive: true,
    lastRunAtISO: '2026-01-08T14:25:00Z',
    dataCompleteness: 'COMPLETE',
  },
  configurationRiskSummary: {
    riskBand: 'LOW',
    metricsIncluded: ['performance', 'stability', 'security'],
    evaluatedAtISO: '2026-01-08T14:30:00Z',
  },
  changeSummary: {
    window: 'last-30d',
    eventCount: 3,
    categoriesPresent: ['deployment', 'configuration'],
    lastChangeAtISO: '2026-01-06T09:15:00Z',
  },
  appBehaviorGuarantees: {
    readOnly: true,
    noJiraWrites: true,
    noConfigChanges: true,
    noEnforcement: true,
  },
  completeness: 'COMPLETE',
  issues: [
    { source: 'monitor', reason: 'Log retention policy old', errorCode: 'WARN_001' },
    { source: 'metrics', reason: 'Consider metrics backfill', errorCode: 'INFO_002' },
  ],
};

const SAMPLE_RECORD: SnapshotRecord = {
  snapshotId: 'snapshot-golden-2026010814',
  generatedAtISO: '2026-01-08T14:30:00Z',
  jsonSha256: '00ec21aac71f551cf94c119ee98719973866d57bd6ec74a24d01d22bfccd815f',
  jsonCanonicalText: JSON.stringify(SAMPLE_SNAPSHOT),
  appVersion: '1.0.0',
  environment: 'production',
};

// ============================================================================
// VERIFICATION HELPERS
// ============================================================================

function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function validatePdfStructure(pdfBuffer: Buffer): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check header
  const headerStr = pdfBuffer.slice(0, 4).toString('latin1');
  if (headerStr !== '%PDF') {
    errors.push(`Invalid PDF header: expected '%PDF', got '${headerStr}'`);
  }

  // Check EOF marker
  const endStr = pdfBuffer.slice(-10).toString('latin1');
  if (!endStr.includes('%%EOF')) {
    errors.push('Missing EOF marker (%%EOF)');
  }

  // Check size limit
  const LIMIT_BYTES = 921600; // 900 KB
  if (pdfBuffer.length > LIMIT_BYTES) {
    errors.push(`PDF exceeds 900 KB limit: ${pdfBuffer.length} bytes`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// MAIN HARNESS
// ============================================================================

async function runGoldenHarness(): Promise<void> {
  console.log('[INFO] Golden PDF Harness - Trust Snapshot Export Verification');
  
  const outDir = `${__dirname}/out`;
  mkdirSync(outDir, { recursive: true });
  console.log(`[INFO] Output directory: ${outDir}`);

  try {
    // STEP 1: Generate PDF (first pass)
    console.log('[INFO] Step 1: Generating PDF (first pass)...');
    const pdfRun1 = await generateTrustSnapshotPdf(SAMPLE_SNAPSHOT, SAMPLE_RECORD);
    const sha1 = sha256(pdfRun1);
    console.log(`✓ PDF generated (${pdfRun1.length} bytes, SHA256: ${sha1.substring(0, 12)}...)`);

    // STEP 2: Generate PDF (second pass - determinism check)
    console.log('[INFO] Step 2: Generating PDF (second pass - determinism check)...');
    const pdfRun2 = await generateTrustSnapshotPdf(SAMPLE_SNAPSHOT, SAMPLE_RECORD);
    const sha2 = sha256(pdfRun2);
    console.log(`✓ PDF generated (${pdfRun2.length} bytes, SHA256: ${sha2.substring(0, 12)}...)`);

    // STEP 3: Verify determinism
    if (sha1 !== sha2) {
      console.log(`✗ Determinism FAILED: Run 1 (${sha1}) != Run 2 (${sha2})`);
      process.exit(1);
    }
    console.log(`✓ Determinism verified: both PDF runs produced identical bytes`);

    // STEP 4: Write artifacts
    console.log('[INFO] Step 3: Writing artifacts...');
    writeFileSync(`${outDir}/sample_snapshot.json`, JSON.stringify(SAMPLE_SNAPSHOT, null, 2));
    console.log(`✓ JSON snapshot written: ${outDir}/sample_snapshot.json`);
    
    writeFileSync(`${outDir}/sample_snapshot.pdf`, pdfRun1);
    console.log(`✓ PDF written: ${outDir}/sample_snapshot.pdf`);

    // STEP 5: Validate structure
    console.log('[INFO] Step 4: Verifying PDF structure...');
    const structureCheck = validatePdfStructure(pdfRun1);
    if (!structureCheck.valid) {
      console.log(`✗ PDF Structure FAILED:`);
      structureCheck.errors.forEach(err => console.log(`  - ${err}`));
      process.exit(1);
    }
    console.log(`✓ PDF header valid: starts with "%PDF-"`);
    console.log(`✓ PDF EOF marker present`);
    console.log(`✓ PDF size within limit: ${pdfRun1.length} / 921600 bytes`);

    // STEP 6: Compute and display checksums
    console.log('[INFO] Step 5: Computing checksums...');
    const jsonSha = sha256(Buffer.from(SAMPLE_RECORD.jsonCanonicalText));
    const pdfSha = sha256(pdfRun1);
    console.log(`[INFO] JSON SHA256: ${jsonSha}`);
    console.log(`[INFO] PDF SHA256:  ${pdfSha}`);

    // FINAL REPORT
    console.log('');
    console.log('GOLDEN PDF VERIFICATION REPORT');
    console.log('==============================');
    console.log(`Snapshot ID:          ${SAMPLE_RECORD.snapshotId}`);
    console.log(`Generated At:         ${SAMPLE_RECORD.generatedAtISO}`);
    console.log(`PDF Size:             ${pdfRun1.length} bytes`);
    console.log(`JSON SHA256:          ${jsonSha}`);
    console.log(`PDF SHA256:           ${pdfSha}`);
    console.log(`Determinism:          ✓ PASS (2 runs identical)`);
    console.log(`PDF Structure:        ✓ PASS (header, EOF, size)`);
    console.log('');
    console.log(`✓ Golden PDF harness completed successfully`);
    process.exit(0);
  } catch (error) {
    console.error('✗ Golden harness failed:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

runGoldenHarness();
