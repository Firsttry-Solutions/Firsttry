/**
 * PHASE P2: OUTPUT TRUTH GUARANTEE
 *
 * Centralized single source of truth for output validity, completeness, and confidence.
 * 
 * Ensures no output can be misunderstood, reused beyond validity, or exported without
 * explicit truth signals and operator acknowledgment.
 *
 * CORE PRINCIPLE: Validity is deterministic. All truth decisions are computed the same way.
 *
 * Definitions:
 * - VALID: Complete + fresh + no drift (safe to use without warnings)
 * - DEGRADED: Incomplete OR stale (requires operator acknowledgment to export)
 * - EXPIRED: Drift detected after generation OR too old (requires acknowledgment + watermark)
 * - BLOCKED: Cannot compute truth or missing snapshot (export impossible)
 */

/**
 * Output validity status: what state is this output in?
 */
export type OutputValidityStatus = 'VALID' | 'DEGRADED' | 'EXPIRED' | 'BLOCKED';

/**
 * Drift status: has drift been detected?
 */
export type DriftStatus = 'NO_DRIFT' | 'DRIFT_DETECTED' | 'UNKNOWN';

/**
 * Confidence level in the output quality
 */
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Schema version for this output truth metadata
 * Increment when making breaking changes to OutputTruthMetadata structure
 */
export const OUTPUT_TRUTH_SCHEMA_VERSION = '1.0';

/**
 * Maximum age of a snapshot before it is considered stale (in seconds)
 * 7 days = 604800 seconds
 */
export const MAX_SNAPSHOT_AGE_SECONDS = 604800;

/**
 * The definitive metadata for any exported output.
 * This is the SINGLE SOURCE OF TRUTH for whether an output is valid.
 */
export interface OutputTruthMetadata {
  // Schema identity
  schemaVersion: string;
  
  // Temporal context
  generatedAtISO: string; // When this output was generated (ISO 8601)
  snapshotId: string; // What snapshot was used
  snapshotCreatedAtISO: string; // When the snapshot was created
  snapshotAgeSeconds: number; // How old is the snapshot? (now - snapshotCreatedAt)
  
  // Versioning
  rulesetVersion: string; // Drift detection rules version
  
  // Drift status
  driftStatus: DriftStatus; // Has drift been detected for this snapshot?
  
  // Completeness tracking (Phase P1.3)
  completenessPercent: number; // 0-100
  missingData: string[]; // Array of field identifiers that are missing
  completenessStatus: 'COMPLETE' | 'INCOMPLETE';
  
  // Confidence assessment
  confidenceLevel: ConfidenceLevel;
  
  // Validity determination
  validityStatus: OutputValidityStatus;
  validUntilISO: string; // ISO 8601, when this output expires
  
  // User-facing disclosure (REQUIRED for non-VALID)
  warnings: string[]; // Human-readable warnings (MUST be non-empty if validityStatus != VALID)
  reasons: string[]; // Why is this output not VALID? (MUST be non-empty if validityStatus != VALID)
}

/**
 * Arguments to computeOutputTruthMetadata
 */
export interface ComputeOutputTruthArgs {
  generatedAtISO: string;
  snapshotId: string;
  snapshotCreatedAtISO: string;
  rulesetVersion: string;
  driftStatus: DriftStatus;
  completenessPercent: number;
  missingData: string[];
  nowISO: string; // Current timestamp for age calculation
}

/**
 * Compute the definitive truth metadata for an output.
 * 
 * This is deterministic: same inputs always produce same validity status.
 * 
 * VALIDITY RULES (enforced in order):
 * 1. If snapshot is too old (> MAX_SNAPSHOT_AGE_SECONDS) -> EXPIRED
 * 2. If drift was detected after generation -> EXPIRED
 * 3. If completeness < 100% -> DEGRADED + LOW confidence
 * 4. If drift status is UNKNOWN -> confidence cannot be HIGH
 * 5. If all above pass -> VALID + HIGH confidence
 * 
 * CONFIDENCE RULES:
 * - HIGH: Complete + fresh + NO_DRIFT (or UNKNOWN is acceptable if complete)
 * - MEDIUM: Complete but stale, OR driftStatus is UNKNOWN, OR minor missing data
 * - LOW: Incomplete, OR drift detected, OR validation failed
 * 
 * WARNINGS/REASONS:
 * - MUST be non-empty if validityStatus != VALID
 * - MUST be empty if validityStatus == VALID
 */
export function computeOutputTruthMetadata(args: ComputeOutputTruthArgs): OutputTruthMetadata {
  const {
    generatedAtISO,
    snapshotId,
    snapshotCreatedAtISO,
    rulesetVersion,
    driftStatus,
    completenessPercent,
    missingData,
    nowISO,
  } = args;

  // Compute age in seconds
  const generatedAt = new Date(generatedAtISO).getTime();
  const now = new Date(nowISO).getTime();
  const snapshotCreatedAt = new Date(snapshotCreatedAtISO).getTime();

  const snapshotAgeSeconds = Math.floor((now - snapshotCreatedAt) / 1000);
  const isSnapshotTooOld = snapshotAgeSeconds > MAX_SNAPSHOT_AGE_SECONDS;

  // Determine completeness status
  const completenessStatus = completenessPercent === 100 ? 'COMPLETE' : 'INCOMPLETE';

  // Compute validity and confidence deterministically
  let validityStatus: OutputValidityStatus = 'VALID';
  let confidenceLevel: ConfidenceLevel = 'HIGH';
  const warnings: string[] = [];
  const reasons: string[] = [];

  // Rule 1: Snapshot too old -> EXPIRED
  if (isSnapshotTooOld) {
    validityStatus = 'EXPIRED';
    confidenceLevel = 'LOW';
    const daysOld = Math.floor(snapshotAgeSeconds / 86400);
    reasons.push(`Snapshot is ${daysOld} days old (max: ${MAX_SNAPSHOT_AGE_SECONDS / 86400} days)`);
    warnings.push(`⚠️ EXPIRED: Snapshot created ${snapshotCreatedAtISO} (${daysOld} days ago)`);
  }

  // Rule 2: Drift detected after generation -> EXPIRED
  if (driftStatus === 'DRIFT_DETECTED') {
    validityStatus = 'EXPIRED';
    confidenceLevel = 'LOW';
    reasons.push('Policy drift detected after output generation');
    warnings.push('⚠️ EXPIRED: Policy drift detected. Output may not reflect current governance state.');
  }

  // Rule 3: Incomplete data -> DEGRADED (at minimum)
  if (completenessPercent < 100) {
    if (validityStatus === 'VALID') {
      validityStatus = 'DEGRADED';
    }
    confidenceLevel = 'LOW';
    reasons.push(`Data is only ${completenessPercent}% complete (missing: ${missingData.join(', ')})`);
    warnings.push(`⚠️ DEGRADED: Missing ${missingData.length} data fields (${completenessPercent}% complete)`);
  }

  // Rule 4: Unknown drift -> DEGRADED status (cannot verify absence of drift)
  if (driftStatus === 'UNKNOWN') {
    if (validityStatus === 'VALID') {
      validityStatus = 'DEGRADED';
    }
    if (confidenceLevel === 'HIGH') {
      confidenceLevel = 'MEDIUM';
    }
    reasons.push('Drift status is UNKNOWN: no evidence that configuration has not changed.');
    warnings.push('⚠️ DEGRADED: Drift status unknown. Output may not reflect current governance state.');
  }

  // Compute expiry date (1 day from now, or 7 days if VALID)
  const expiryMs = validityStatus === 'VALID'
    ? now + MAX_SNAPSHOT_AGE_SECONDS * 1000
    : now + 86400000; // 1 day for non-VALID
  const validUntilISO = new Date(expiryMs).toISOString();

  // Validate invariants
  if (validityStatus !== 'VALID') {
    if (warnings.length === 0 || reasons.length === 0) {
      throw new Error(
        `OutputTruthMetadata invariant violation: non-VALID status (${validityStatus}) ` +
        `must have non-empty warnings and reasons`
      );
    }
  } else {
    if (warnings.length > 0 || reasons.length > 0) {
      throw new Error(
        `OutputTruthMetadata invariant violation: VALID status cannot have warnings or reasons`
      );
    }
  }

  return {
    schemaVersion: OUTPUT_TRUTH_SCHEMA_VERSION,
    generatedAtISO,
    snapshotId,
    snapshotCreatedAtISO,
    snapshotAgeSeconds,
    rulesetVersion,
    driftStatus,
    completenessPercent,
    missingData,
    completenessStatus,
    confidenceLevel,
    validityStatus,
    validUntilISO,
    warnings,
    reasons,
  };
}

/**
 * Error thrown when export is blocked due to lack of truth
 */
export class ExportBlockedError extends Error {
  constructor(
    public readonly validityStatus: OutputValidityStatus,
    public readonly reasons: string[]
  ) {
    const message = `Export blocked: ${validityStatus}. Reasons: ${reasons.join('; ')}`;
    super(message);
    this.name = 'ExportBlockedError';
  }
}

/**
 * Verify an output has explicit truth signals.
 * Throws ExportBlockedError if output is not VALID and acknowledgment is not provided.
 * 
 * REQUIREMENTS:
 * - VALID outputs can always be exported
 * - DEGRADED/EXPIRED outputs require explicit acknowledgment to export
 * - BLOCKED outputs cannot be exported under any circumstances
 * 
 * @throws ExportBlockedError if export should be blocked
 */
export function requireValidForExport(
  meta: OutputTruthMetadata,
  acknowledgedByOperator: boolean = false
): void {
  if (meta.validityStatus === 'VALID') {
    // Always allow VALID exports
    return;
  }

  if (meta.validityStatus === 'BLOCKED') {
    // BLOCKED can never be exported
    throw new ExportBlockedError(
      'BLOCKED',
      ['Output is blocked. Cannot compute truth or snapshot is missing.']
    );
  }

  // DEGRADED or EXPIRED require acknowledgment
  if (!acknowledgedByOperator) {
    throw new ExportBlockedError(
      meta.validityStatus,
      [
        ...meta.reasons,
        `Explicit acknowledgment required to export ${meta.validityStatus} output.`,
      ]
    );
  }

  // Acknowledgment provided; export allowed but must be watermarked
  // (Caller must apply watermark in exported content)
}

/**
 * Serialize OutputTruthMetadata to JSON
 */
export function serializeTruthMetadata(meta: OutputTruthMetadata): string {
  return JSON.stringify(meta, null, 2);
}

/**
 * Deserialize OutputTruthMetadata from JSON
 * Validates schema version matches
 */
export function deserializeTruthMetadata(json: string): OutputTruthMetadata {
  const meta = JSON.parse(json) as OutputTruthMetadata;

  // Validate schema version
  if (meta.schemaVersion !== OUTPUT_TRUTH_SCHEMA_VERSION) {
    throw new Error(
      `OutputTruthMetadata schema mismatch: expected ${OUTPUT_TRUTH_SCHEMA_VERSION}, ` +
      `got ${meta.schemaVersion}`
    );
  }

  return meta;
}
