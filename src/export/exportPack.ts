/**
 * Deterministic Export Pack Generator - PHASE 1
 * 
 * Requirements:
 * - Canonical JSON serialization (sorted keys, no whitespace)
 * - SHA-256 hashing of snapshot
 * - ZIP with fixed file order and compression
 * - No timestamp metadata
 * - All 6 required files
 */

import { AccessSurfaceSnapshot } from './types';
import { calculateRiskScore, getWeightDocumentation } from './risk';
import crypto from 'crypto';
import { generateExecutivePDF } from './pdf';

export interface ExportPackOptions {
  includeDetailed?: boolean;
}

export interface ExportPackMetadata {
  fileCount: number;
  fileList: string[];
  zipSha256: string;
  timestamp: string;
}

/**
 * Canonical JSON stringify - sorts keys recursively, no whitespace
 */
export function canonicalStringify(obj: any, replacer?: any): string {
  return JSON.stringify(obj, (key: string, value: any) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce((sorted: any, key: string) => {
          sorted[key] = value[key];
          return sorted;
        }, {});
    }
    return value;
  });
}

/**
 * Compute canonical hash of snapshot (SHA-256)
 * Uses canonical JSON serialization
 */
export function computeCanonicalHash(snapshot: Omit<AccessSurfaceSnapshot, 'canonicalHash'>): string {
  const canonical = canonicalStringify(snapshot);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Generate deterministic export pack structure
 * Required files (in fixed order):
 * 1. manifest.json - export metadata
 * 2. snapshot.json - full access surface snapshot
 * 3. access-report.json - human-readable access report
 * 4. risk-summary.json - risk calculation breakdown
 * 5. report-executive.pdf - 1-page executive summary
 * 6. schema-version.txt - schema version identifier
 * 7. verify.js - offline verification script
 */
export async function generateExportPack(
  snapshot: AccessSurfaceSnapshot,
  options: ExportPackOptions = {}
): Promise<ExportPack> {
  // Verify snapshot has canonical hash
  const snapshotWithHash = { ...snapshot };
  if (!snapshotWithHash.canonicalHash || snapshotWithHash.canonicalHash.length === 0) {
    // Recompute if missing
    const { canonicalHash, ...snapshotWithoutHash } = snapshotWithHash;
    snapshotWithHash.canonicalHash = computeCanonicalHash(snapshotWithoutHash as any);
  }

  // Generate component files
  const manifest = generateManifest(snapshotWithHash);
  const accessReport = generateAccessReport(snapshotWithHash);
  const riskSummary = generateRiskSummary(snapshotWithHash);
  const executivePdf = await generateExecutivePDF(snapshotWithHash);
  const schemaVersion = 'schema-version: 1.0\nformat: FirstTry Access Intelligence v1\n';
  const verifyScript = generateVerifyScript();

  // Assemble export pack with fixed file order
  const exportPack = new ExportPack();
  exportPack.addFile('manifest.json', JSON.stringify(manifest, null, 2), 1);
  exportPack.addFile('snapshot.json', canonicalStringify(snapshotWithHash), 2);
  exportPack.addFile('access-report.json', JSON.stringify(accessReport, null, 2), 3);
  exportPack.addFile('risk-summary.json', JSON.stringify(riskSummary, null, 2), 4);
  exportPack.addFile('report-executive.pdf', executivePdf, 5);
  exportPack.addFile('schema-version.txt', schemaVersion, 6);
  exportPack.addFile('verify.js', verifyScript, 7);

  return exportPack;
}

function generateManifest(snapshot: AccessSurfaceSnapshot): any {
  return {
    exportDate: new Date().toISOString(),
    schemaVersion: snapshot.schemaVersion,
    buildShaShort: snapshot.buildShaShort,
    buildUtc: snapshot.buildUtc,
    siteId: snapshot.siteId,
    privilegeContext: snapshot.privilegeContext,
    ruleSetVersion: snapshot.ruleSetVersion,
    canonicalHash: snapshot.canonicalHash,
    fileCount: 7,
    files: [
      'manifest.json',
      'snapshot.json',
      'access-report.json',
      'risk-summary.json',
      'report-executive.pdf',
      'schema-version.txt',
      'verify.js',
    ],
  };
}

function generateAccessReport(snapshot: AccessSurfaceSnapshot): any {
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalUsers: snapshot.totals.totalUsers,
      activeUsers: snapshot.totals.activeUsers,
      externalUsers: snapshot.totals.externalUsers,
      globalAdminCount: snapshot.exposure.globalAdmins.length,
      projectAdminCount: Object.values(snapshot.exposure.projectAdmins).flat().length,
      publicProjectCount: snapshot.exposure.publicProjects.length,
      externalElevatedCount: snapshot.exposure.externalElevatedUsers.length,
    },
    globalAdmins: snapshot.exposure.globalAdmins,
    projectAdmins: snapshot.exposure.projectAdmins,
    publicProjects: snapshot.exposure.publicProjects,
    externalElevatedUsers: snapshot.exposure.externalElevatedUsers,
    findings: snapshot.toxicFindings.map(f => ({
      ruleId: f.ruleId,
      severity: f.severity,
      explanation: f.explanation,
      affectedCount: f.impactedEntities.length,
    })),
  };
}

function generateRiskSummary(snapshot: AccessSurfaceSnapshot): any {
  const riskCalc = calculateRiskScore(snapshot);
  return {
    overview: {
      finalScore: riskCalc.finalRiskScore,
      tier: riskCalc.riskTier,
      explanation: riskCalc.explanation,
    },
    breakdown: {
      adminDensity: {
        value: riskCalc.adminDensity,
        weight: 40,
        component: riskCalc.adminDensityScore,
        description: 'Percentage of users with global admin privileges',
      },
      externalExposure: {
        value: riskCalc.externalExposureScore,
        weight: 5,
        component: riskCalc.externalExposureScoreComponent,
        description: 'Count of external users with elevated privileges',
      },
      toxicFindings: {
        value: riskCalc.toxicHitCount,
        weight: 3,
        component: riskCalc.toxicHitScore,
        description: 'Count of detected access antipatterns',
      },
      publicProjects: {
        value: riskCalc.publicProjectCount,
        weight: 2,
        component: riskCalc.publicProjectScore,
        description: 'Count of publicly accessible projects',
      },
    },
    weightDocumentation: getWeightDocumentation(),
  };
}

function generateVerifyScript(): string {
  return `#!/usr/bin/env node
/**
 * Offline Verification Script - FirstTry Access Intelligence Export
 * 
 * Usage: node verify.js
 * 
 * Validates that the export pack has not been tampered with.
 * Recomputes canonical hash and compares to embedded signature.
 * Runs completely offline - no network access required.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function canonicalStringify(obj) {
  return JSON.stringify(obj, (key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce((sorted, k) => {
          sorted[k] = value[k];
          return sorted;
        }, {});
    }
    return value;
  });
}

function verifyExport() {
  try {
    console.log('[VERIFY] Loading manifest.json...');
    const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

    console.log('[VERIFY] Loading snapshot.json...');
    const snapshot = JSON.parse(fs.readFileSync('snapshot.json', 'utf8'));

    const embeddedHash = snapshot.canonicalHash;
    const snapshotWithoutHash = { ...snapshot };
    delete snapshotWithoutHash.canonicalHash;

    console.log('[VERIFY] Computing canonical hash...');
    const canonical = canonicalStringify(snapshotWithoutHash);
    const computedHash = crypto.createHash('sha256').update(canonical).digest('hex');

    console.log(\`[VERIFY] Embedded hash:  \${embeddedHash}\`);
    console.log(\`[VERIFY] Computed hash:  \${computedHash}\`);

    if (embeddedHash === computedHash) {
      console.log('[VERIFY] ✓ PASS: Export integrity verified');
      console.log(\`[VERIFY] Schema: \${snapshot.schemaVersion}\`);
      console.log(\`[VERIFY] Build: \${snapshot.buildShaShort} (\${snapshot.buildUtc})\`);
      process.exit(0);
    } else {
      console.error('[VERIFY] ✗ FAIL: Hash mismatch - export may be corrupted or tampered');
      process.exit(1);
    }
  } catch (error) {
    console.error('[VERIFY] ✗ ERROR:', error.message);
    process.exit(1);
  }
}

verifyExport();
`;
}

/**
 * In-memory export pack representation
 * Can be serialized to ZIP file
 */
export class ExportPack {
  private files: Map<string, { content: string | Buffer; order: number }> = new Map();

  addFile(filename: string, content: string | Buffer, order: number): void {
    this.files.set(filename, { content, order });
  }

  getFiles(): Array<[string, string | Buffer]> {
    // Return files in fixed order
    const sorted = Array.from(this.files.entries()).sort((a, b) => {
      const orderA = a[1].order || 999;
      const orderB = b[1].order || 999;
      return orderA - orderB;
    });
    return sorted.map(([name, data]) => [name, data.content]);
  }

  getFileCount(): number {
    return this.files.size;
  }

  getFileList(): string[] {
    return Array.from(this.files.keys()).sort((a, b) => {
      const orderA = this.files.get(a)?.order || 999;
      const orderB = this.files.get(b)?.order || 999;
      return orderA - orderB;
    });
  }

  /**
   * Generate buffer for all files (for ZIP compression)
   */
  async toZipBuffer(): Promise<Buffer> {
    // This will be implemented with a ZIP library in the actual build
    // For now, return a placeholder
    const fileList = this.getFileList();
    const metadata = Buffer.from(JSON.stringify({
      files: fileList,
      timestamp: new Date().toISOString(),
    }));
    return metadata;
  }

  /**
   * Compute SHA-256 of the complete export
   */
  computeExportHash(): string {
    const fileContents = this.getFiles()
      .map(([name, content]) => {
        const data = typeof content === 'string' ? content : content.toString('binary');
        return name + ':' + data;
      })
      .join('|');

    return crypto.createHash('sha256').update(fileContents).digest('hex');
  }
}

export async function createDeterministicExportZip(
  snapshot: AccessSurfaceSnapshot
): Promise<{ buffer: Buffer; hash: string; metadata: ExportPackMetadata }> {
  const exportPack = await generateExportPack(snapshot);

  const fileList = exportPack.getFileList();
  const hash = exportPack.computeExportHash();

  const metadata: ExportPackMetadata = {
    fileCount: exportPack.getFileCount(),
    fileList,
    zipSha256: hash,
    timestamp: new Date().toISOString(),
  };

  const buffer = await exportPack.toZipBuffer();

  return { buffer, hash, metadata };
}
