/**
 * MILESTONE 1 ENGINE 6A: Governance Pack Export (ZIP)
 * 
 * ZIP structure (exact order):
 * /manifest.json
 * /manifest.sig
 * /snapshot.json
 * /ledger.json (ONLY if exists)
 * /access-report.json
 * /dependency-graph.json
 * /audit-coverage.json
 * /privilege-boundary.json
 * /platform-features.json
 * /report.pdf
 * /verify.js
 * /schema-version.txt
 * 
 * Rules:
 * - ZIP entry ordering must be deterministic
 * - ZIP entry timestamps must be fixed (epoch)
 * - Binary output must be reproducible
 * - manifest.json lists all files with SHA256
 * - manifest.sig = SHA256(manifest.json bytes)
 * - verify.js runs offline
 */

import type {
  Snapshot,
  AccessReport,
  ConfigInventory,
  DependencyGraph,
  AuditCoverage,
  PrivilegeBoundary,
  PlatformFeatures,
  ExportManifest,
} from '../models';
import { canonicalJsonString, sha256Hex } from '../canonicalize';
import { generateDeterministicPdfBytes } from '../utils/deterministic-pdf';
import { buildDeterministicZip } from '../utils/deterministic-zip';

// Embedded verify.js script (runs offline, no network)
const VERIFY_JS_CONTENT = `#!/usr/bin/env node
/**
 * Offline ZIP Verification Script
 * 
 * Usage: node verify.js
 * 
 * Reads all files in the pack directory, recomputes SHA256 hashes,
 * and verifies against manifest.json and manifest.sig
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

function sha256Hex(data) {
  const input = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function verify() {
  try {
    const packDir = __dirname;

    // Read manifest.json
    const manifestPath = path.join(packDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      console.error('FAIL: manifest.json not found');
      process.exit(1);
    }

    const manifestBytes = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestBytes);

    // Verify manifest.sig
    const manifestSigPath = path.join(packDir, 'manifest.sig');
    if (!fs.existsSync(manifestSigPath)) {
      console.error('FAIL: manifest.sig not found');
      process.exit(1);
    }

    const manifestSig = fs.readFileSync(manifestSigPath, 'utf-8').trim();
    const computedSig = sha256Hex(manifestBytes);

    if (manifestSig !== computedSig) {
      console.error(\`FAIL: manifest.sig mismatch. Expected \${computedSig}, got \${manifestSig}\`);
      process.exit(1);
    }

    // Verify each file hash
    for (const fileEntry of manifest.files) {
      const filePath = path.join(packDir, fileEntry.path);
      
      if (!fs.existsSync(filePath)) {
        console.error(\`FAIL: File not found: \${fileEntry.path}\`);
        process.exit(1);
      }

      const fileBytes = fs.readFileSync(filePath, 'utf-8');
      const fileHash = sha256Hex(fileBytes);

      if (fileHash !== fileEntry.sha256) {
        console.error(\`FAIL: Hash mismatch for \${fileEntry.path}. Expected \${fileEntry.sha256}, got \${fileHash}\`);
        process.exit(1);
      }
    }

    console.log('PASS');
    process.exit(0);
  } catch (error) {
    console.error(\`FAIL: \${error.message}\`);
    process.exit(1);
  }
}

verify();
`;

/**
 * Build export manifest (NOT sorting by path - must preserve order)
 */
function buildManifest(
  snapshot: Snapshot,
  files: Map<string, Buffer | string>
): ExportManifest {
  const fileEntries = [];

  // Files in REQUIRED deterministic order (no sorting allowed)
  const fileOrder = [
    'manifest.json', // Will add with sig at end
    'manifest.sig',
    'snapshot.json',
    'ledger.json', // Only if exists
    'access-report.json',
    'dependency-graph.json',
    'audit-coverage.json',
    'privilege-boundary.json',
    'platform-features.json',
    'report.pdf',
    'verify.js',
    'schema-version.txt',
  ];

  for (const filename of fileOrder) {
    const filePath = `/${filename}`;
    if (!files.has(filePath)) {
      continue;
    }

    const content = files.get(filePath);
    const contentBytes =
      typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
    const hash = sha256Hex(contentBytes);

    fileEntries.push({
      path: filePath,
      sha256: hash,
    });
  }

  // IMPORTANT: Do NOT sort. Preserve exact order above.
  // Sorting would break determinism across different systems.

  return {
    schemaVersion: '1.0.0',
    snapshotId: snapshot.id,
    siteId: snapshot.siteId,
    createdAtUtc: snapshot.createdAtUtc,
    buildShaShort: snapshot.buildShaShort,
    buildUtc: snapshot.buildUtc,
    files: fileEntries,
  };
}

/**
 * Export governance pack as ZIP (byte-for-byte reproducible)
 * 
 * Returns:
 * {
 *   success: boolean
 *   zipBuffer?: Buffer (the ZIP file bytes)
 *   error?: string
 * }
 */
export async function exportGovernancePack(
  snapshot: Snapshot,
  accessReport: AccessReport,
  dependencyGraph: DependencyGraph,
  auditCoverage: AuditCoverage,
  privilegeBoundary: PrivilegeBoundary,
  platformFeatures: PlatformFeatures,
  ledgerJson?: string // Optional, only if exists
): Promise<{
  success: boolean;
  zipBuffer?: Buffer;
  error?: string;
}> {
  try {
    // Prepare file contents
    const files = new Map<string, Buffer | string>();

    // Add all JSON files (as canonical strings)
    files.set('/snapshot.json', canonicalJsonString(snapshot));
    files.set('/access-report.json', canonicalJsonString(accessReport));
    files.set('/dependency-graph.json', canonicalJsonString(dependencyGraph));
    files.set('/audit-coverage.json', canonicalJsonString(auditCoverage));
    files.set('/privilege-boundary.json', canonicalJsonString(privilegeBoundary));
    files.set('/platform-features.json', canonicalJsonString(platformFeatures));

    // Optional ledger
    if (ledgerJson) {
      files.set('/ledger.json', ledgerJson);
    }

    // PDF (deterministic, throws if non-deterministic)
    try {
      const pdfInput = {
        snapshotId: snapshot.id,
        siteId: snapshot.siteId,
        createdAtUtc: snapshot.createdAtUtc,
        canonicalHash: snapshot.canonicalHash,
        buildShaShort: snapshot.buildShaShort,
        buildUtc: snapshot.buildUtc,
        schemaVersion: snapshot.schemaVersion,
        accessCount: accessReport.access.length,
        dependencyNodeCount: dependencyGraph.dependencyGraph.nodes.length,
        dependencyEdgeCount: dependencyGraph.dependencyGraph.edges.length,
        inventoryCount: 0, // Would be ConfigInventory.items.length if available
        auditCoverageNotes:
          auditCoverage.auditCoverage.disclaimers.join(' ') ||
          'Audit coverage disclosure included',
        accessibleScopes: privilegeBoundary.privilegeBoundary.accessibleScopes,
        inaccessibleScopes:
          privilegeBoundary.privilegeBoundary.inaccessibleScopes,
      };

      const pdfBuffer = generateDeterministicPdfBytes(pdfInput);
      files.set('/report.pdf', pdfBuffer);
    } catch (pdfError) {
      // PDF generation failed - fail closed
      return {
        success: false,
        error: `PDF_GENERATION_FAILED: ${String(pdfError)}`,
      };
    }

    // verify.js
    files.set('/verify.js', VERIFY_JS_CONTENT);

    // schema-version.txt
    files.set('/schema-version.txt', '1.0.0');

    // Build manifest
    const manifest = buildManifest(snapshot, files);
    const manifestJson = canonicalJsonString(manifest);
    files.set('/manifest.json', manifestJson);

    // manifest.sig = SHA256(manifest.json)
    const manifestSig = sha256Hex(manifestJson);
    files.set('/manifest.sig', manifestSig);

    // Build ZIP with deterministic structure
    try {
      const zipEntries = [
        { path: 'manifest.json', data: Buffer.from(manifestJson, 'utf-8') },
        { path: 'manifest.sig', data: Buffer.from(manifestSig, 'utf-8') },
        {
          path: 'snapshot.json',
          data: Buffer.from(canonicalJsonString(snapshot), 'utf-8'),
        },
        {
          path: 'access-report.json',
          data: Buffer.from(canonicalJsonString(accessReport), 'utf-8'),
        },
        {
          path: 'dependency-graph.json',
          data: Buffer.from(canonicalJsonString(dependencyGraph), 'utf-8'),
        },
        {
          path: 'audit-coverage.json',
          data: Buffer.from(canonicalJsonString(auditCoverage), 'utf-8'),
        },
        {
          path: 'privilege-boundary.json',
          data: Buffer.from(
            canonicalJsonString(privilegeBoundary),
            'utf-8'
          ),
        },
        {
          path: 'platform-features.json',
          data: Buffer.from(canonicalJsonString(platformFeatures), 'utf-8'),
        },
        {
          path: 'report.pdf',
          data: files.get('/report.pdf') as Buffer,
        },
        {
          path: 'verify.js',
          data: Buffer.from(VERIFY_JS_CONTENT, 'utf-8'),
        },
        {
          path: 'schema-version.txt',
          data: Buffer.from('1.0.0', 'utf-8'),
        },
      ];

      // Add ledger if exists
      if (ledgerJson) {
        zipEntries.splice(3, 0, {
          path: 'ledger.json',
          data: Buffer.from(ledgerJson, 'utf-8'),
        });
      }

      const zipBuffer = buildDeterministicZip(zipEntries);
      return {
        success: true,
        zipBuffer,
      };
    } catch (zipError) {
      // ZIP generation failed - fail closed
      return {
        success: false,
        error: `ZIP_GENERATION_FAILED: ${String(zipError)}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Validate export structure
 */
export function validateExportManifest(manifest: ExportManifest): boolean {
  if (
    !manifest.schemaVersion ||
    !manifest.snapshotId ||
    !manifest.siteId ||
    !manifest.createdAtUtc
  ) {
    return false;
  }

  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    return false;
  }

  // Check required files are present
  const paths = new Set(manifest.files.map((f) => f.path));
  const required = [
    '/manifest.json',
    '/manifest.sig',
    '/snapshot.json',
    '/access-report.json',
    '/dependency-graph.json',
    '/audit-coverage.json',
    '/privilege-boundary.json',
    '/platform-features.json',
    '/report.pdf',
    '/verify.js',
    '/schema-version.txt',
  ];

  for (const path of required) {
    if (!paths.has(path)) {
      return false;
    }
  }

  return true;
}
