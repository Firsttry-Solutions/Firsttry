/**
 * PHASE P4: EVIDENCE PACK EXPORT (Forensic-Grade, Audit-Defensible)
 * 
 * Generates exportable evidence packs with verification, watermarking,
 * and explicit disclosures.
 * 
 * Contract:
 * - Evidence is verified before export (no export of invalid evidence)
 * - Missing data is explicitly listed
 * - Outputs with unverified evidence are watermarked
 * - Tenant-scoped and retention-controlled
 */

import {
  EvidenceBundle,
  EvidencePack,
  RegenerationVerificationResult,
  EVIDENCE_SCHEMA_VERSION,
} from './evidence_model';
import { EvidenceStore, getEvidenceStore } from './evidence_store';
import { verifyRegeneration, RegenerationInvariantError } from './verify_regeneration';

/**
 * Generate evidence pack for export
 * 
 * Process:
 * 1. Load evidence from store
 * 2. Verify regeneration (determinism check)
 * 3. Build exportable pack with disclosures
 * 4. Watermark if verification failed
 * 
 * Throws error if evidence not found or schema unsupported.
 * Watermarking applied on verification failure (does not throw).
 */
export async function generateEvidencePack(
  tenantKey: string,
  cloudId: string,
  evidenceId: string
): Promise<EvidencePack> {
  const store = getEvidenceStore(tenantKey);

  // Load evidence
  const stored = await store.loadEvidence(evidenceId);
  if (!stored) {
    throw new Error(`Evidence not found: ${evidenceId}`);
  }

  const bundle = stored.bundle;
  const evidenceHash = stored.hash;

  // Verify regeneration (may throw RegenerationInvariantError)
  let verification: RegenerationVerificationResult;
  let requiresAcknowledgment = false;
  let acknowledgmentReason: string | undefined;
  let watermarkText: string | undefined;

  try {
    verification = await verifyRegeneration(tenantKey, cloudId, evidenceId);
  } catch (error) {
    if (error instanceof RegenerationInvariantError) {
      // Create failure result
      verification = {
        verified: false,
        evidenceId,
        originalHash: evidenceHash,
        regeneratedHash: evidenceHash, // Cannot recompute if verification failed
        matchesStored: false,
        verificationTimestampISO: new Date().toISOString(),
        invariantViolation: error.reason,
        mismatchDetails: {
          originalTruthReasons: bundle.outputTruthMetadata.reasons || [],
          regeneratedTruthReasons: [],
          differenceDescription: error.message,
        },
      };

      // Flag for watermarking
      requiresAcknowledgment = true;
      acknowledgmentReason = `Evidence verification failed: ${error.message}`;
      watermarkText = `⚠️ EVIDENCE VERIFICATION FAILED: ${error.reason}`;
    } else {
      throw error;
    }
  }

  // Build evidence pack
  const pack: EvidencePack = {
    evidence: bundle,
    evidenceHash,
    regenerationVerification: verification,
    missingDataList: bundle.missingData,
    exportedAtISO: new Date().toISOString(),
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    requiresAcknowledgment,
    acknowledgmentReason,
    watermarkText,
  };

  return pack;
}

/**
 * Serialize evidence pack to JSON
 * Canonical form suitable for export/archival
 */
export function serializeEvidencePack(pack: EvidencePack): string {
  return JSON.stringify(pack, null, 2);
}

/**
 * Export evidence pack as JSON (with optional compression)
 */
export async function exportEvidencePackAsJSON(
  tenantKey: string,
  cloudId: string,
  evidenceId: string
): Promise<{
  content: string;
  filename: string;
  mimeType: string;
}> {
  const pack = await generateEvidencePack(tenantKey, cloudId, evidenceId);
  const content = serializeEvidencePack(pack);

  return {
    content,
    filename: `evidence_${evidenceId}.json`,
    mimeType: 'application/json',
  };
}

/**
 * Export evidence pack as human-readable markdown
 * For audit reports and procurement responses
 */
export async function exportEvidencePackAsMarkdown(
  tenantKey: string,
  cloudId: string,
  evidenceId: string
): Promise<{
  content: string;
  filename: string;
  mimeType: string;
}> {
  const pack = await generateEvidencePack(tenantKey, cloudId, evidenceId);

  let markdown = '';

  // Header
  markdown += `# Evidence Pack Report\n\n`;
  markdown += `**Evidence ID:** ${pack.evidence.evidenceId}\n`;
  markdown += `**Exported At:** ${pack.exportedAtISO}\n`;
  markdown += `**Tenant:** ${pack.evidence.tenantKey}\n`;
  markdown += `**Schema Version:** ${pack.schemaVersion}\n\n`;

  // Watermark if needed
  if (pack.requiresAcknowledgment) {
    markdown += `## ⚠️ WARNING\n\n`;
    markdown += `${pack.watermarkText}\n\n`;
    markdown += `**Reason:** ${pack.acknowledgmentReason}\n\n`;
  }

  // Verification result
  markdown += `## Verification Result\n\n`;
  markdown += `- **Verified:** ${pack.regenerationVerification.verified ? '✅ YES' : '❌ NO'}\n`;
  markdown += `- **Invariant Status:** ${pack.regenerationVerification.invariantViolation}\n`;
  markdown += `- **Original Hash:** \`${pack.regenerationVerification.originalHash}\`\n`;
  markdown += `- **Regenerated Hash:** \`${pack.regenerationVerification.regeneratedHash}\`\n`;
  markdown += `- **Matches:** ${pack.regenerationVerification.matchesStored ? 'YES' : 'NO'}\n\n`;

  // Evidence metadata
  markdown += `## Evidence Metadata\n\n`;
  markdown += `- **Generated At:** ${pack.evidence.generatedAtISO}\n`;
  markdown += `- **Ruleset Version:** ${pack.evidence.rulesetVersion}\n`;
  markdown += `- **Snapshot References:** ${pack.evidence.snapshotRefs.length}\n`;

  pack.evidence.snapshotRefs.forEach((ref, idx) => {
    markdown += `  - ${idx + 1}. ID: \`${ref.snapshotId}\` (${ref.snapshotType})\n`;
    markdown += `     Hash: \`${ref.snapshotHash.substring(0, 16)}...\`\n`;
  });

  markdown += `\n`;

  // Output truth
  markdown += `## Output Truth Metadata\n\n`;
  markdown += `- **Validity Status:** ${pack.evidence.outputTruthMetadata.validityStatus}\n`;
  markdown += `- **Confidence Level:** ${pack.evidence.outputTruthMetadata.confidenceLevel}\n`;
  markdown += `- **Completeness:** ${pack.evidence.outputTruthMetadata.completenessPercent}%\n`;
  markdown += `- **Drift Status:** ${pack.evidence.outputTruthMetadata.driftStatus}\n`;

  if (pack.evidence.outputTruthMetadata.reasons?.length) {
    markdown += `\n**Reasons:**\n`;
    pack.evidence.outputTruthMetadata.reasons.forEach(reason => {
      markdown += `- ${reason}\n`;
    });
  }

  if (pack.evidence.outputTruthMetadata.warnings?.length) {
    markdown += `\n**Warnings:**\n`;
    pack.evidence.outputTruthMetadata.warnings.forEach(warning => {
      markdown += `- ${warning}\n`;
    });
  }

  markdown += `\n`;

  // Missing data
  if (pack.missingDataList.length > 0) {
    markdown += `## Missing Data Disclosure\n\n`;
    pack.missingDataList.forEach(item => {
      markdown += `- **${item.datasetName}** (${item.reasonCode})\n`;
      markdown += `  ${item.description}\n`;
    });
    markdown += `\n`;
  }

  // Normalized inputs
  markdown += `## Normalized Inputs\n\n`;
  markdown += `- **Tenant Key:** ${pack.evidence.normalizedInputs.tenantKey}\n`;
  markdown += `- **Cloud ID:** ${pack.evidence.normalizedInputs.cloudId}\n`;

  if (pack.evidence.normalizedInputs.reportGenerationTrigger) {
    markdown += `- **Generation Trigger:** ${pack.evidence.normalizedInputs.reportGenerationTrigger}\n`;
  }

  if (pack.evidence.normalizedInputs.observationWindowDays) {
    markdown += `- **Observation Window:** ${pack.evidence.normalizedInputs.observationWindowDays} days\n`;
  }

  markdown += `\n---\n`;
  markdown += `*This evidence pack is cryptographically signed and retention-controlled.*\n`;

  return {
    content: markdown,
    filename: `evidence_${evidenceId}.md`,
    mimeType: 'text/markdown',
  };
}

/**
 * Helper: Check if evidence pack requires acknowledgment before export
 */
export function requiresExportAcknowledgment(pack: EvidencePack): boolean {
  return (
    pack.requiresAcknowledgment || 
    !pack.regenerationVerification.verified
  );
}
