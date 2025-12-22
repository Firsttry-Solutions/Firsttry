/**
 * PHASE P3.4: TRUTH DETERMINISM VERIFICATION
 *
 * Verifies that OutputTruthMetadata is deterministic:
 * - For each output record, recompute its truth metadata
 * - Compare with stored metadata
 * - Record INVARIANT failure if mismatch
 *
 * Determinism is CRITICAL for audit compliance:
 * - Same inputs must always produce same validity status
 * - If recomputed != stored, something is wrong with the rules
 * - Mismatches are treated as INVARIANT failures (critical)
 *
 * Non-negotiable:
 * - No silent failures (record error event if mismatch)
 * - Deterministic comparison (equals on all critical fields)
 * - Metric event recorded for every verification
 */

import { OutputTruthMetadata, computeOutputTruthMetadata } from '../output/output_contract';
import { PersistedOutputRecord } from '../output/output_store';
import { recordMetricEvent, OperationOutcome } from './metrics';
import { TenantContext } from '../security/tenant_context';
import { TraceContext } from './trace';

/**
 * Determinism verification result
 */
export interface DeterminismResult {
  isValid: boolean;           // true if recomputed == stored
  recomputedMetadata: OutputTruthMetadata;
  storedMetadata: OutputTruthMetadata;
  differences: DeterminismDifference[];
}

/**
 * A specific difference between recomputed and stored metadata
 */
export interface DeterminismDifference {
  field: string;              // Field name (e.g., "validityStatus", "warnings")
  recomputed: unknown;        // Recomputed value
  stored: unknown;            // Stored value
}

/**
 * Verify truth determinism for an output record
 * Recomputes metadata and compares with stored
 *
 * @param record - PersistedOutputRecord to verify
 * @returns DeterminismResult with detailed comparison
 */
export function verifyTruthDeterminism(record: PersistedOutputRecord): DeterminismResult {
  const stored = record.truthMetadata;

  // Recompute using same inputs
  const recomputed = computeOutputTruthMetadata({
    generatedAtISO: stored.generatedAtISO,
    snapshotId: stored.snapshotId,
    snapshotCreatedAtISO: stored.snapshotCreatedAtISO,
    rulesetVersion: stored.rulesetVersion,
    driftStatus: stored.driftStatus,
    completenessPercent: stored.completenessPercent,
    missingData: stored.missingData,
    nowISO: stored.generatedAtISO, // Use original generation time for determinism
  });

  // Compare critical fields only (not timestamps which change between runs)
  const differences: DeterminismDifference[] = [];

  // Compare validity status (most critical)
  if (recomputed.validityStatus !== stored.validityStatus) {
    differences.push({
      field: 'validityStatus',
      recomputed: recomputed.validityStatus,
      stored: stored.validityStatus,
    });
  }

  // Compare confidence level
  if (recomputed.confidenceLevel !== stored.confidenceLevel) {
    differences.push({
      field: 'confidenceLevel',
      recomputed: recomputed.confidenceLevel,
      stored: stored.confidenceLevel,
    });
  }

  // Compare completeness percent
  if (recomputed.completenessPercent !== stored.completenessPercent) {
    differences.push({
      field: 'completenessPercent',
      recomputed: recomputed.completenessPercent,
      stored: stored.completenessPercent,
    });
  }

  // Compare missing data arrays
  const missingDataMatch = 
    JSON.stringify(recomputed.missingData?.sort()) === JSON.stringify(stored.missingData?.sort());
  if (!missingDataMatch) {
    differences.push({
      field: 'missingData',
      recomputed: recomputed.missingData,
      stored: stored.missingData,
    });
  }

  // Compare warnings arrays
  const warningsMatch = 
    JSON.stringify(recomputed.warnings?.sort()) === JSON.stringify(stored.warnings?.sort());
  if (!warningsMatch) {
    differences.push({
      field: 'warnings',
      recomputed: recomputed.warnings,
      stored: stored.warnings,
    });
  }

  // Compare reasons arrays
  const reasonsMatch = 
    JSON.stringify(recomputed.reasons?.sort()) === JSON.stringify(stored.reasons?.sort());
  if (!reasonsMatch) {
    differences.push({
      field: 'reasons',
      recomputed: recomputed.reasons,
      stored: stored.reasons,
    });
  }

  // Compare drift status
  if (recomputed.driftStatus !== stored.driftStatus) {
    differences.push({
      field: 'driftStatus',
      recomputed: recomputed.driftStatus,
      stored: stored.driftStatus,
    });
  }

  return {
    isValid: differences.length === 0,
    recomputedMetadata: recomputed,
    storedMetadata: stored,
    differences,
  };
}

/**
 * Verify determinism and record metric event
 * Should be called periodically (e.g., by a scheduled verifier task)
 *
 * @param record - PersistedOutputRecord to verify
 * @param tenantContext - Tenant context for metric scoping
 * @param traceContext - Trace context for correlation
 * @returns DeterminismResult
 */
export async function verifyAndRecordDeterminism(
  record: PersistedOutputRecord,
  tenantContext: TenantContext,
  traceContext: TraceContext
): Promise<DeterminismResult> {
  const result = verifyTruthDeterminism(record);

  // Record metric event
  const outcome: OperationOutcome = result.isValid ? 'SUCCESS' : 'FAIL';
  
  await recordMetricEvent(
    tenantContext,
    {
      tsISO: new Date().toISOString(),
      durationMs: Date.now() - traceContext.startTimeMs,
      tenantToken: '', // Computed by recordMetricEvent
      opName: 'truth_determinism_verification',
      outcome,
      correlationId: traceContext.correlationId,
      flags: result.isValid ? [] : result.differences.map(d => `mismatch_${d.field}`),
    }
  );

  // If mismatch, this is an INVARIANT failure
  if (!result.isValid) {
    console.error(
      '[INVARIANT] Truth determinism verification failed:',
      {
        snapshotId: record.snapshotId,
        outputId: record.outputId,
        differences: result.differences.map(d => `${d.field}: ${JSON.stringify(d.recomputed)} != ${JSON.stringify(d.stored)}`),
        correlationId: traceContext.correlationId,
      }
    );
  }

  return result;
}
