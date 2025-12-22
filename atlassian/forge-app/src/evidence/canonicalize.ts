/**
 * PHASE P4: EVIDENCE CANONICALIZATION & HASHING
 * 
 * Deterministic serialization and cryptographic hashing of evidence bundles.
 * 
 * Core principle:
 * - Identical semantic evidence MUST produce identical hashes
 * - Any modification, no matter how small, changes the hash
 * - Hashing is deterministic across systems and time
 */

import { createHash } from 'crypto';
import { EvidenceBundle, EvidenceHash } from './evidence_model';

/**
 * Canonicalize an evidence bundle into deterministic JSON
 * 
 * Rules:
 * 1. Fields in canonical order (defined below)
 * 2. No extra whitespace
 * 3. Keys alphabetically sorted within each object
 * 4. Arrays sorted deterministically
 * 5. Null values preserved as JSON
 * 6. Numbers with stable precision
 * 7. Booleans as lowercase true/false
 */
export function canonicalizeEvidenceBundle(bundle: EvidenceBundle): string {
  // Custom replacer that ensures canonical form
  const canonical = {
    // Required fields in canonical order
    evidenceId: bundle.evidenceId,
    schemaVersion: bundle.schemaVersion,
    tenantKey: bundle.tenantKey,
    cloudId: bundle.cloudId,
    createdAtISO: bundle.createdAtISO,
    generatedAtISO: bundle.generatedAtISO,
    rulesetVersion: bundle.rulesetVersion,
    
    // Snapshot references (sorted by ID for determinism)
    snapshotRefs: bundle.snapshotRefs
      .map(ref => ({
        capturedAtISO: ref.capturedAtISO,
        snapshotHash: ref.snapshotHash,
        snapshotId: ref.snapshotId,
        snapshotType: ref.snapshotType,
      }))
      .sort((a, b) => a.snapshotId.localeCompare(b.snapshotId)),
    
    // Drift state
    driftStatusAtGeneration: {
      driftDetectedCount: bundle.driftStatusAtGeneration.driftDetectedCount,
      driftStatusSummary: bundle.driftStatusAtGeneration.driftStatusSummary,
      lastDriftComputeISO: bundle.driftStatusAtGeneration.lastDriftComputeISO || null,
    },
    
    // Normalized inputs
    normalizedInputs: {
      cloudId: bundle.normalizedInputs.cloudId,
      computedAtISO: bundle.normalizedInputs.computedAtISO,
      observationWindowDays: bundle.normalizedInputs.observationWindowDays || null,
      reportGenerationTrigger: bundle.normalizedInputs.reportGenerationTrigger || null,
      rulesetVersionUsed: bundle.normalizedInputs.rulesetVersionUsed,
      tenantKey: bundle.normalizedInputs.tenantKey,
    },
    
    // Output truth metadata (preserve exactly as stored)
    outputTruthMetadata: canonicalizeOutputTruthMetadata(bundle.outputTruthMetadata),
    
    // Environment facts
    environmentFacts: {
      driftDetectionEnabled: bundle.environmentFacts.driftDetectionEnabled,
      evidenceSchemaVersion: bundle.environmentFacts.evidenceSchemaVersion,
      outputSchemaVersion: bundle.environmentFacts.outputSchemaVersion,
      snapshotLedgerEnabled: bundle.environmentFacts.snapshotLedgerEnabled,
      truthRulesetVersion: bundle.environmentFacts.truthRulesetVersion,
    },
    
    // Missing data (sorted by dataset name for determinism)
    missingData: bundle.missingData
      .map(item => ({
        datasetName: item.datasetName,
        description: item.description,
        reasonCode: item.reasonCode,
      }))
      .sort((a, b) => a.datasetName.localeCompare(b.datasetName)),
  };
  
  // Serialize with no whitespace, stable key ordering
  return JSON.stringify(canonical, (key, value) => {
    if (value === null) return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value;
    
    // Objects: sort keys alphabetically
    if (typeof value === 'object') {
      const sorted: Record<string, any> = {};
      Object.keys(value)
        .sort()
        .forEach(k => {
          sorted[k] = value[k];
        });
      return sorted;
    }
    
    return value;
  });
}

/**
 * Canonicalize OutputTruthMetadata
 * (Reused from P2 output contract)
 */
function canonicalizeOutputTruthMetadata(metadata: any): any {
  return {
    completenessPercent: metadata.completenessPercent,
    confidenceLevel: metadata.confidenceLevel,
    driftStatus: metadata.driftStatus,
    generatedAtISO: metadata.generatedAtISO,
    missingData: (metadata.missingData || []).sort(),
    reasons: (metadata.reasons || []).sort(),
    snapshotAgeSeconds: metadata.snapshotAgeSeconds,
    snapshotId: metadata.snapshotId,
    validityStatus: metadata.validityStatus,
    validUntilISO: metadata.validUntilISO,
    warnings: (metadata.warnings || []).sort(),
  };
}

/**
 * Compute SHA-256 hash of evidence bundle
 * 
 * Returns lowercase hex string (64 characters for SHA-256)
 */
export function computeEvidenceHash(bundle: EvidenceBundle): EvidenceHash {
  const canonical = canonicalizeEvidenceBundle(bundle);
  const hash = createHash('sha256').update(canonical, 'utf8').digest('hex');
  
  // Validate hash format (SHA-256 = 64 hex chars)
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    throw new Error(`Invalid evidence hash format: ${hash}`);
  }
  
  return hash;
}

/**
 * Verify that a bundle matches its stored hash
 * Used for integrity checking
 */
export function verifyEvidenceHash(
  bundle: EvidenceBundle,
  storedHash: EvidenceHash
): boolean {
  const recomputedHash = computeEvidenceHash(bundle);
  return recomputedHash === storedHash;
}

/**
 * Test helper: Verify determinism
 * Same bundle computed twice should produce identical hash
 */
export function testEvidenceDeterminism(bundle: EvidenceBundle): {
  hash1: EvidenceHash;
  hash2: EvidenceHash;
  isDeterministic: boolean;
} {
  const hash1 = computeEvidenceHash(bundle);
  const hash2 = computeEvidenceHash(bundle);
  
  return {
    hash1,
    hash2,
    isDeterministic: hash1 === hash2,
  };
}
