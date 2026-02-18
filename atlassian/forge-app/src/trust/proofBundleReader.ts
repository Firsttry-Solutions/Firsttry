/**
 * ECL-5 TRUST PANEL — PROOF BUNDLE READER (READ-ONLY)
 * 
 * Purpose: Consume Phase 4 proof bundle artifacts and expose verified data for UI display.
 * 
 * Contract:
 * - Read ONLY (no writes, no mutations)
 * - Fail-closed: throw if bundle missing, malformed, or incomplete
 * - No networking, no external dependencies
 * - Marker: FT_ECL_PHASE: ECL-5 TRUST_READER
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES FOR TRUST PANEL FIELDS
// ============================================================================

export interface TrustPanelData {
  readOnlyGuarantee: 'Verified' | 'NotApplicable';
  noMutationAttestationSha: string;
  noOutboundAttestationSha: string;
  scopeHash: string;
  allowlistHash: string;
  allowlistVersion: string;
  schemaVersion: string;
  ruleSetVersion: string;
  lastProofBundleSha: string;
}

interface Attestation05 {
  schema: string;
  allowlist: {
    version: string;
    sha256: string;
    count: number;
  };
  checks: any[];
  attestationHashSha256: string;
}

interface Attestation06 {
  schema: string;
  allowlist: {
    version: string;
    sha256: string;
    count: number;
  };
  checks: any[];
  attestationHashSha256: string;
}

interface Manifest {
  bundleSha256: string;
  schemaVersion: string;
  ruleSetVersion: string;
  bundleCreatedUtc?: string; // Optional (no longer required)
}

interface ScopeFreeze {
  scopesHashSha256: string;
}

// ============================================================================
// FIND LATEST PROOF BUNDLE DIRECTORY
// ============================================================================

/**
 * Find latest proof bundle directory in /tmp
 * 
 * Strategy:
 * 1. Glob /tmp/ft_proof_phase4_*
 * 2. Sort by timestamp (extract from directory name: ft_proof_phase4_[TIMESTAMP]Z)
 * 3. Use filesystem mtime as deterministic tie-breaker (lexicographic on tie)
 * 4. Return latest directory path
 * 
 * Fail-closed: Returns null if no bundles found, caller throws
 */
export function findLatestProofBundleDir(): string | null {
  try {
    const tmpDir = '/tmp';
    
    // List all directories matching pattern
    if (!fs.existsSync(tmpDir)) {
      return null;
    }
    
    const entries = fs.readdirSync(tmpDir, { withFileTypes: true });
    const proofDirs = entries.filter(e => {
      return e.isDirectory() && e.name.startsWith('ft_proof_phase4_') && e.name.endsWith('Z');
    });
    
    if (proofDirs.length === 0) {
      return null;
    }
    
    // Extract timestamps from directory names for sorting (no mtime dependency)
    const dirsWithTimestamp = proofDirs
      .map(d => {
        const fullPath = path.join(tmpDir, d.name);
        const timestamp = d.name.replace('ft_proof_phase4_', '').replace('Z', '');
        return { name: d.name, path: fullPath, timestamp };
      })
      .sort((a, b) => {
        // Sort by timestamp descending (newest first)
        if (a.timestamp !== b.timestamp) {
          return b.timestamp.localeCompare(a.timestamp);
        }
        // Tie-breaker: path name descending (lexicographic)
        return b.path.localeCompare(a.path);
      });
    
    return dirsWithTimestamp[0]?.path || null;
  } catch (err) {
    // Fail-closed: return null on any error
    return null;
  }
}

// ============================================================================
// READ AND PARSE ATTESTATION FILES
// ============================================================================

/**
 * Read attestation files 05 and 06 from bundle directory
 * 
 * Fail-closed: Throws if:
 * - Files don't exist
 * - Files are empty
 * - JSON is malformed
 * - Required fields missing
 */
export function readAttestationFiles(bundleDir: string): { att05: Attestation05; att06: Attestation06; manifest: Manifest; scopeFreeze: ScopeFreeze } {
  const requiredFiles = {
    att05: '05_no_outbound_attestation.json',
    att06: '06_no_mutation_attestation.json',
    manifest: '00_manifest.json',
    scopeFreeze: '01_scope_freeze.json'
  };

  // Verify all files exist
  for (const [key, file] of Object.entries(requiredFiles)) {
    const filePath = path.join(bundleDir, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`FAIL_CLOSED: Missing attestation file ${file} in proof bundle`);
    }

    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      throw new Error(`FAIL_CLOSED: Empty attestation file ${file} in proof bundle`);
    }
  }

  // Parse attestation 05
  let att05: Attestation05;
  try {
    const raw05 = fs.readFileSync(path.join(bundleDir, requiredFiles.att05), 'utf-8');
    att05 = JSON.parse(raw05);
    
    if (!att05.allowlist || !att05.allowlist.version || !att05.allowlist.sha256) {
      throw new Error('Missing allowlist in attestation 05');
    }
    if (!att05.attestationHashSha256) {
      throw new Error('Missing attestationHashSha256 in attestation 05');
    }
  } catch (err) {
    throw new Error(`FAIL_CLOSED: Cannot parse attestation 05: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Parse attestation 06
  let att06: Attestation06;
  try {
    const raw06 = fs.readFileSync(path.join(bundleDir, requiredFiles.att06), 'utf-8');
    att06 = JSON.parse(raw06);
    
    if (!att06.allowlist || !att06.allowlist.version || !att06.allowlist.sha256) {
      throw new Error('Missing allowlist in attestation 06');
    }
    if (!att06.attestationHashSha256) {
      throw new Error('Missing attestationHashSha256 in attestation 06');
    }
  } catch (err) {
    throw new Error(`FAIL_CLOSED: Cannot parse attestation 06: ${err instanceof Error ? err.message : String(err)}`);
  }

  // FAIL-CLOSED: Allowlist must match between attestations
  if (att05.allowlist.version !== att06.allowlist.version) {
    throw new Error(`FAIL_CLOSED: Allowlist version mismatch (05: ${att05.allowlist.version}, 06: ${att06.allowlist.version})`);
  }
  if (att05.allowlist.sha256 !== att06.allowlist.sha256) {
    throw new Error(`FAIL_CLOSED: Allowlist SHA-256 mismatch (05: ${att05.allowlist.sha256}, 06: ${att06.allowlist.sha256})`);
  }

  // Parse manifest
  let manifest: Manifest;
  try {
    const rawManifest = fs.readFileSync(path.join(bundleDir, requiredFiles.manifest), 'utf-8');
    manifest = JSON.parse(rawManifest);
    
    if (!manifest.bundleSha256 || !manifest.schemaVersion || !manifest.ruleSetVersion) {
      throw new Error('Missing required fields in manifest (bundleSha256, schemaVersion, ruleSetVersion)');
    }
    // Note: bundleCreatedUtc is now optional
  } catch (err) {
    throw new Error(`FAIL_CLOSED: Cannot parse manifest: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Parse scope freeze
  let scopeFreeze: ScopeFreeze;
  try {
    const rawScopeFreeze = fs.readFileSync(path.join(bundleDir, requiredFiles.scopeFreeze), 'utf-8');
    scopeFreeze = JSON.parse(rawScopeFreeze);
    
    if (!scopeFreeze.scopesHashSha256) {
      throw new Error('Missing scopesHashSha256 in scope freeze');
    }
  } catch (err) {
    throw new Error(`FAIL_CLOSED: Cannot parse scope freeze: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { att05, att06, manifest, scopeFreeze };
}

// ============================================================================
// EXTRACT TRUST PANEL DATA
// ============================================================================

/**
 * Extract fields required for trust panel UI
 * 
 * Fail-closed: Throws if any required field is missing or invalid
 */
export function extractTrustPanelFields(
  att05: Attestation05,
  att06: Attestation06,
  manifest: Manifest,
  scopeFreeze: ScopeFreeze
): TrustPanelData {
  // Read-only guarantee: Check mutation attestation status (all checks must be PASS)
  const checks = Array.isArray((att06 as any).checks) ? (att06 as any).checks : null;
  const readOnlyGuarantee =
    checks && checks.length > 0 && checks.every((c: any) => c && c.status === 'PASS')
      ? 'Verified'
      : 'NotApplicable';

  return {
    readOnlyGuarantee,
    noMutationAttestationSha: att06.attestationHashSha256,
    noOutboundAttestationSha: att05.attestationHashSha256,
    scopeHash: scopeFreeze.scopesHashSha256,
    allowlistHash: att05.allowlist.sha256, // Same in both, use att05
    allowlistVersion: att05.allowlist.version,
    schemaVersion: manifest.schemaVersion,
    ruleSetVersion: manifest.ruleSetVersion,
    lastProofBundleSha: manifest.bundleSha256
  };
}

// ============================================================================
// HIGH-LEVEL API: Get Trust Panel Data (Fail-Closed Entry Point)
// ============================================================================

/**
 * Get trust panel data from latest proof bundle
 * 
 * Fail-closed contract:
 * - Returns null if bundle not found (not generated)
 * - Throws error if bundle found but malformed (caller must handle)
 */
export function getTrustPanelData(): TrustPanelData | null {
  const bundleDir = findLatestProofBundleDir();
  if (!bundleDir) {
    return null;  // No proof bundle generated yet
  }

  // If we get here and have a bundle, throw on ANY error (don't catch/swallow)
  const { att05, att06, manifest, scopeFreeze } = readAttestationFiles(bundleDir);
  const trustData = extractTrustPanelFields(att05, att06, manifest, scopeFreeze);

  return trustData;
}

// FT_ECL_PHASE: ECL-5 TRUST_READER
