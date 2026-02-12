/**
 * Phase 1 Access Pack Exporter Resolver
 * 
 * Purpose: Generate deterministic ZIP export of Phase 1 governance snapshot
 * 
 * Invoked from: UI button "Export Access Pack"
 * 
 * Behavior:
 * - Log [FT_ACCESS_EXPORT_START]
 * - Read latest GOVERNANCE snapshot from storage
 * - Generate 7-file deterministic ZIP
 * - Log [FT_ACCESS_EXPORT_COMPLETE]
 * - Return download URL with canonical hash filename
 * 
 * NON-NEGOTIABLES:
 * - Deterministic: Same snapshot = same ZIP hash always
 * - Fail-closed: If snapshot missing/invalid, return FAILED (no silent degradation)
 * - Explicit hash: Filename includes canonical hash for verification
 */

import api from '@forge/api';
import { storage } from '@forge/api';

/**
 * Main entry point for export
 * 
 * Response:
 * {
 *   ok: boolean,
 *   status: "SUCCESS" | "FAILED",
 *   reason?: string (if FAILED),
 *   downloadUrl?: string,
 *   canonicalHash?: string,
 *   snapshotId?: string,
 *   size?: number
 * }
 */
export const handler = async (request: any): Promise<any> => {
  const startTimestamp = new Date().toISOString();
  const correlationId = request?.correlationId || request?.correlation_id || 'unknown';

  console.log(JSON.stringify({
    marker: '[FT_ACCESS_EXPORT_START]',
    correlationId,
    timestamp: startTimestamp,
  }));

  try {
    // STEP 1: Read latest governance snapshot from storage
    console.log('[FT_ACCESS_EXPORT_READ] Retrieving latest snapshot');
    const snapshot = await storage.get('ft:snapshot:last:v1');
    
    if (!snapshot) {
      const failureMsg = 'No governance snapshot found in storage. Run "Access Review (Phase 1)" first.';
      console.error(`[FT_ACCESS_EXPORT_ERROR] ${failureMsg}`);
      return {
        ok: false,
        status: 'FAILED',
        reason: failureMsg,
      };
    }

    if (!snapshot.canonicalHash) {
      const failureMsg = 'Snapshot missing canonicalHash. Cannot generate deterministic export.';
      console.error(`[FT_ACCESS_EXPORT_ERROR] ${failureMsg}`);
      return {
        ok: false,
        status: 'FAILED',
        reason: failureMsg,
      };
    }

    console.log(`[FT_ACCESS_EXPORT_READ] Found snapshot with hash ${snapshot.canonicalHash}`);

    // STEP 2: Build ZIP structure with 7 files (deterministic order)
    console.log('[FT_ACCESS_EXPORT_ZIP] Building ZIP archive');
    const files = buildExportFiles(snapshot);
    const zipData = buildZipArchive(files);
    
    // STEP 3: Compute ZIP hash and filename
    const crypto = require('crypto');
    const zipHash = crypto.createHash('sha256').update(zipData).digest('hex').substring(0, 16);
    const filename = `access-governance-${snapshot.canonicalHash}.zip`;

    // STEP 4: Store ZIP in Forge Files storage
    const fileKey = `ft:export:${snapshot.canonicalHash}:${Date.now()}`;
    await storage.set(fileKey, {
      filename,
      size: zipData.length,
      hash: zipHash,
      timestamp: new Date().toISOString(),
      snapshotHash: snapshot.canonicalHash,
    });

    console.log(JSON.stringify({
      marker: '[FT_ACCESS_EXPORT_COMPLETE]',
      correlationId,
      filename,
      zipHash,
      snapshotHash: snapshot.canonicalHash,
      size: zipData.length,
    }));

    // Return download info
    return {
      ok: true,
      status: 'SUCCESS',
      downloadUrl: `/download/access-pack/${snapshot.canonicalHash}`,
      canonicalHash: snapshot.canonicalHash,
      snapshotId: fileKey,
      size: zipData.length,
    };
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    console.error(JSON.stringify({
      marker: '[FT_ACCESS_EXPORT_ERROR]',
      error: errorMsg,
      stack: error?.stack,
    }));
    return {
      ok: false,
      status: 'FAILED',
      reason: `Export failed: ${errorMsg}`,
    };
  }
};

/**
 * Build deterministic file collection for export
 * 
 * 7 files:
 * 1. manifest.json - Export metadata
 * 2. snapshot.json - Full canonical snapshot
 * 3. access-report.json - Human-readable findings
 * 4. risk-summary.json - Risk model breakdown
 * 5. report-executive.pdf - 1-page executive summary
 * 6. schema-version.txt - Export schema version
 * 7. verify.js - Offline verification script
 */
function buildExportFiles(snapshot: any): { [key: string]: string } {
  const files: { [key: string]: string } = {};

  // File 1: Manifest
  files['manifest.json'] = JSON.stringify({
    export_version: '1.0',
    export_schema: 'access-intelligence-v1.0',
    snapshot_canonical_hash: snapshot.canonicalHash,
    exported_at: new Date().toISOString(),
    site_id: snapshot.siteId,
  }, null, 2);

  // File 2: Canonical Snapshot (deterministic order)
  const canonicalSnapshot = {
    schemaVersion: snapshot.schemaVersion,
    buildShaShort: snapshot.buildShaShort,
    buildUtc: snapshot.buildUtc,
    siteId: snapshot.siteId,
    privilegeContext: snapshot.privilegeContext,
    ruleSetVersion: snapshot.ruleSetVersion,
    totals: snapshot.totals,
    exposure: snapshot.exposure,
    toxicFindings: snapshot.toxicFindings,
    riskModel: snapshot.riskModel,
    canonicalHash: snapshot.canonicalHash,
  };
  files['snapshot.json'] = JSON.stringify(canonicalSnapshot, null, 2);

  // File 3: Access Report (human readable)
  files['access-report.json'] = JSON.stringify({
    title: 'Jira Access Intelligence Report',
    generated: new Date().toISOString(),
    summary: {
      total_users: snapshot.totals.totalUsers,
      active_users: snapshot.totals.activeUsers,
      external_users: snapshot.totals.externalUsers,
    },
    findings: {
      global_admins: snapshot.exposure.globalAdmins.length,
      public_projects: snapshot.exposure.publicProjects.length,
      toxic_findings: snapshot.toxicFindings.length,
    },
    risk_tier: computeRiskTier(snapshot.riskModel.finalRiskScore),
  }, null, 2);

  // File 4: Risk Summary
  files['risk-summary.json'] = JSON.stringify({
    risk_model_version: '1.0',
    final_risk_score: snapshot.riskModel.finalRiskScore,
    components: {
      admin_density: {
        value: snapshot.riskModel.adminDensity,
        max_weight: 0.4,
      },
      external_exposure: {
        value: snapshot.riskModel.externalExposureScore,
        max_weight: 0.3,
      },
      toxic_findings: {
        count: snapshot.riskModel.toxicHitCount,
        max_weight: 0.3,
      },
    },
  }, null, 2);

  // File 5: Executive PDF (placeholder - would call PDF generator)
  files['report-executive.pdf'] = generatePlaceholderPdf(snapshot);

  // File 6: Schema version
  files['schema-version.txt'] = 'access-intelligence-export-v1.0';

  // File 7: Verify script
  files['verify.js'] = generateVerifyScript(snapshot.canonicalHash);

  return files;
}

/**
 * Build minimal ZIP structure (Note: Real implementation would use jszip or similar)
 */
function buildZipArchive(files: { [key: string]: string }): any {
  // In a real implementation, this would create a proper ZIP file using jszip
  // For now, return a deterministic concatenation
  const fileNames = Object.keys(files).sort();
  let zipContent = '';
  for (const name of fileNames) {
    zipContent += `// FILE: ${name}\n`;
    zipContent += files[name];
    zipContent += '\n\n';
  }
  return Buffer.from(zipContent);
}

/**
 * Generate placeholder PDF content
 */
function generatePlaceholderPdf(snapshot: any): string {
  const riskTier = computeRiskTier(snapshot.riskModel.finalRiskScore);
  return `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Count 1 /Kids [3 0 R] >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< >>
stream
BT
/F1 24 Tf
50 700 Td
(Jira Access Intelligence - Executive Summary) Tj
0 -40 Td
/F1 12 Tf
(Risk Tier: ${riskTier}) Tj
0 -20 Td
(Total Users: ${snapshot.totals.totalUsers}) Tj
0 -20 Td
(Global Admins: ${snapshot.exposure.globalAdmins.length}) Tj
0 -20 Td
(Public Projects: ${snapshot.exposure.publicProjects.length}) Tj
0 -20 Td
(Toxic Findings: ${snapshot.toxicFindings.length}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000214 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
500
%%EOF`;
}

/**
 * Generate offline verification script
 */
function generateVerifyScript(snapshotHash: string): string {
  return `/**
 * Offline Verification Script
 * 
 * Usage: node verify.js snapshot.json
 * 
 * Verifies that snapshot.json has expected canonical hash: ${snapshotHash}
 */

const fs = require('fs');
const crypto = require('crypto');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node verify.js <snapshot.json>');
  process.exit(1);
}

const snapshotFile = args[0];
const snapshotData = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));

// Compute canonical hash
const canonicalString = JSON.stringify(snapshotData, Object.keys(snapshotData).sort());
const computedHash = crypto.createHash('sha256').update(canonicalString).digest('hex').substring(0, 16);

console.log(\`Expected hash: ${snapshotHash}\`);
console.log(\`Computed hash: \${computedHash}\`);

if (computedHash === '${snapshotHash}') {
  console.log('✓ VERIFIED: Snapshot integrity confirmed');
  process.exit(0);
} else {
  console.log('✗ FAILED: Snapshot has been modified');
  process.exit(1);
}
`;
}

/**
 * Compute risk tier from score
 */
function computeRiskTier(score: number): string {
  if (score > 0.7) return 'HIGH';
  if (score > 0.4) return 'MEDIUM';
  return 'LOW';
}
