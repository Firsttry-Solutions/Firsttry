/**
 * PHASE P4: REGENERATION VERIFICATION (Invariant Enforcement)
 * 
 * Loads evidence, regenerates truth, compares with stored truth.
 * 
 * Contract:
 * - If mismatch detected → INVARIANT error raised
 * - All mismatches are recorded in audit trail
 * - No silent failures allowed
 * - Determinism metric updated on verification
 */

import {
  EvidenceBundle,
  RegenerationVerificationResult,
} from './evidence_model';
import { EvidenceStore, getEvidenceStore } from './evidence_store';
import { regenerateOutputTruth, verifyRegeneratedTruth, createVerificationResult } from './regenerator';
import { computeEvidenceHash } from './canonicalize';
import { getAuditEventStore } from '../audit/audit_events';

/**
 * Invariant error type
 * Raised when regeneration verification fails
 */
export class RegenerationInvariantError extends Error {
  constructor(
    public readonly evidenceId: string,
    public readonly reason: 'HASH_MISMATCH' | 'MISSING_EVIDENCE' | 'SCHEMA_VERSION_UNSUPPORTED',
    message: string
  ) {
    super(message);
    this.name = 'RegenerationInvariantError';
  }
}

/**
 * Verify regeneration for a single evidence bundle
 * 
 * Returns verification result.
 * Throws RegenerationInvariantError if:
 * - Evidence not found
 * - Regenerated truth doesn't match stored truth
 * - Schema version not supported
 */
export async function verifyRegeneration(
  tenantKey: string,
  cloudId: string,
  evidenceId: string
): Promise<RegenerationVerificationResult> {
  const store = getEvidenceStore(tenantKey);

  // Load evidence
  const stored = await store.loadEvidence(evidenceId);

  if (!stored) {
    const error = new RegenerationInvariantError(
      evidenceId,
      'MISSING_EVIDENCE',
      `Evidence not found: ${evidenceId}`
    );

    // Record audit event
    try {
      const auditStore = getAuditEventStore(tenantKey, cloudId);
      await auditStore.recordFailureEvent(
        'p4_regeneration_verification',
        error.message,
        { evidenceId, reason: 'MISSING_EVIDENCE' }
      );
    } catch (auditError) {
      console.error('[VerifyRegeneration] Failed to record audit event:', auditError);
    }

    throw error;
  }

  const bundle = stored.bundle;

  // Verify schema version support
  if (bundle.schemaVersion !== '1.0.0') {
    const error = new RegenerationInvariantError(
      evidenceId,
      'SCHEMA_VERSION_UNSUPPORTED',
      `Unsupported evidence schema: ${bundle.schemaVersion}`
    );

    try {
      const auditStore = getAuditEventStore(tenantKey, cloudId);
      await auditStore.recordFailureEvent(
        'p4_regeneration_verification',
        error.message,
        { evidenceId, schemaVersion: bundle.schemaVersion }
      );
    } catch (auditError) {
      console.error('[VerifyRegeneration] Failed to record audit event:', auditError);
    }

    throw error;
  }

  // Regenerate truth
  const verificationResult = verifyRegeneratedTruth(bundle);

  // Create verification record
  const originalHash = stored.hash;
  const regeneratedHash = computeEvidenceHash(bundle); // Recompute to verify immutability

  const result: RegenerationVerificationResult = createVerificationResult(
    evidenceId,
    verificationResult.original,
    verificationResult.regenerated,
    verificationResult.matches,
    originalHash,
    regeneratedHash
  );

  // If mismatch, raise INVARIANT error and record audit
  if (!verificationResult.matches) {
    const error = new RegenerationInvariantError(
      evidenceId,
      'HASH_MISMATCH',
      `Regeneration mismatch: ${verificationResult.differences?.join('; ')}`
    );

    try {
      const auditStore = getAuditEventStore(tenantKey, cloudId);
      const auditEventId = `p4_regen_fail_${evidenceId}_${Date.now()}`;
      await auditStore.recordFailureEvent(
        'p4_regeneration_verification',
        `INVARIANT VIOLATION: ${error.message}`,
        {
          evidenceId,
          originalReasons: verificationResult.original.reasons,
          regeneratedReasons: verificationResult.regenerated.reasons,
          originalTruth: verificationResult.original.validityStatus,
          regeneratedTruth: verificationResult.regenerated.validityStatus,
        }
      );
      result.auditEventId = auditEventId;
    } catch (auditError) {
      console.error('[VerifyRegeneration] Failed to record audit event:', auditError);
    }

    throw error;
  }

  // Record successful verification
  try {
    const auditStore = getAuditEventStore(tenantKey, cloudId);
    await auditStore.recordSuccessEvent(
      'p4_regeneration_verification',
      `Evidence ${evidenceId} verified successfully`,
      { evidenceId, hash: originalHash }
    );
  } catch (auditError) {
    console.error('[VerifyRegeneration] Failed to record audit event:', auditError);
    // Non-blocking - verification succeeded even if audit write failed
  }

  return result;
}

/**
 * Batch verify regeneration for multiple evidence bundles
 * Returns results for each, collects errors
 */
export async function verifyRegenerationBatch(
  tenantKey: string,
  cloudId: string,
  evidenceIds: string[]
): Promise<{
  verified: RegenerationVerificationResult[];
  failed: Array<{ evidenceId: string; error: string }>;
  invariantViolations: RegenerationInvariantError[];
}> {
  const results: RegenerationVerificationResult[] = [];
  const failed: Array<{ evidenceId: string; error: string }> = [];
  const invariantViolations: RegenerationInvariantError[] = [];

  for (const evidenceId of evidenceIds) {
    try {
      const result = await verifyRegeneration(tenantKey, cloudId, evidenceId);
      results.push(result);
    } catch (error) {
      if (error instanceof RegenerationInvariantError) {
        invariantViolations.push(error);
        failed.push({
          evidenceId,
          error: error.message,
        });
      } else {
        failed.push({
          evidenceId,
          error: `Unexpected error: ${error}`,
        });
      }
    }
  }

  return {
    verified: results,
    failed,
    invariantViolations,
  };
}

/**
 * Audit helper: Mark output as invalid if evidence verification fails
 * Called during export to ensure only verified outputs are exported
 */
export async function markOutputInvalidIfEvidenceInvalid(
  tenantKey: string,
  cloudId: string,
  evidenceId: string,
  outputId: string
): Promise<{ valid: boolean; reason?: string }> {
  try {
    await verifyRegeneration(tenantKey, cloudId, evidenceId);
    return { valid: true };
  } catch (error) {
    if (error instanceof RegenerationInvariantError) {
      // Mark output as invalid in audit trail
      try {
        const auditStore = getAuditEventStore(tenantKey, cloudId);
        await auditStore.recordFailureEvent(
          'p4_output_validity_check',
          `Output ${outputId} marked invalid due to evidence verification failure: ${error.message}`,
          { evidenceId, outputId, invariantReason: error.reason }
        );
      } catch (auditError) {
        console.error('[MarkOutputInvalid] Failed to record audit event:', auditError);
      }

      return {
        valid: false,
        reason: error.message,
      };
    }

    throw error;
  }
}
