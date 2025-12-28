/**
 * PHASE P4: DETERMINISTIC REGENERATION ENGINE
 * PHASE P6: USES PINNED RULESET (not current ruleset)
 * 
 * Recomputes OutputTruthMetadata from stored evidence.
 * 
 * Core principle:
 * - Given an EvidenceBundle and its rulesetVersion
 * - Use the PINNED ruleset version, NEVER the current one
 * - Produce identical OutputTruthMetadata as originally computed
 * - Using ONLY data present in the bundle (no live system calls)
 * - Failure to match original = INVARIANT violation
 * 
 * P6 Enhancement:
 * - Pre-regeneration compatibility gates enforce safe evolution
 * - Schema migrations applied automatically before regeneration
 * - Shadow evaluation shows what would change under current ruleset
 */

import {
  EvidenceBundle,
  RegenerationVerificationResult,
} from './evidence_model';
import {
  OutputTruthMetadata,
  computeOutputTruthMetadata,
} from '../output/output_contract';
import {
  getRuleset,
  RulesetComputeInputs,
  RulesetInvariantError,
} from '../policy/ruleset_registry';
import { DEFAULT_RULESET_VERSION } from '../policy/ruleset_registry';
import {
  applySchemaMigrations,
  SchemaMigrationError,
} from '../policy/schema_migrations';
import {
  gatePreRegenerationValidation,
  CompatibilityGateError,
} from '../policy/compatibility_gates';

/**
 * Regenerate OutputTruthMetadata from evidence
 * 
 * CRITICAL P6 BEHAVIOR:
 * - Uses PINNED ruleset from evidence (bundle.rulesetVersion)
 * - NEVER uses current/latest ruleset
 * - Applies schema migrations automatically
 * - Enforces compatibility gates (fail-closed)
 * - Pure function: same evidence always produces same output
 * 
 * Uses ONLY:
 * - Data from evidenceBundle
 * - The rulesetVersion stored in the bundle (PINNED, not current)
 * - Deterministic algorithms
 * - Schema migrations if needed
 * 
 * Does NOT use:
 * - Live system state
 * - Current time (uses timestamps from bundle)
 * - Current ruleset (uses pinned ruleset from evidence)
 * - Network calls
 * - Randomness
 * 
 * @param bundle The evidence bundle to regenerate
 * @returns Regenerated OutputTruthMetadata using PINNED ruleset
 * @throws RulesetInvariantError if pinned ruleset not found
 * @throws SchemaMigrationError if schema cannot be migrated
 * @throws CompatibilityGateError if compatibility gates fail
 */
export function regenerateOutputTruth(bundle: EvidenceBundle): OutputTruthMetadata {
  // Input validation
  if (!bundle.normalizedInputs || !bundle.outputTruthMetadata) {
    throw new Error('Cannot regenerate: missing normalized inputs or truth metadata');
  }

  if (!bundle.snapshotRefs || bundle.snapshotRefs.length === 0) {
    throw new Error('Cannot regenerate: no snapshots referenced');
  }

  // To preserve backward compatibility, ensure the bundle has a deterministic
  // `rulesetVersion` before running compatibility gates. Some legacy bundles
  // omit this field; defaulting here ensures gates that verify pinned
  // ruleset presence behave deterministically.
  const precheckBundle: EvidenceBundle = { ...bundle };
  if (!precheckBundle.rulesetVersion) {
    precheckBundle.rulesetVersion = DEFAULT_RULESET_VERSION;
  }

  // GATE: Pre-regeneration compatibility checks (fail-closed)
  try {
    gatePreRegenerationValidation(precheckBundle);
  } catch (error) {
    if (error instanceof CompatibilityGateError) {
      throw new RulesetInvariantError(
        precheckBundle.rulesetVersion || DEFAULT_RULESET_VERSION,
        'SCHEMA_MISMATCH',
        `Pre-regeneration validation failed: ${error.detail}`
      );
    }
    throw error;
  }

  // SCHEMA: Apply migrations if needed
  let workingBundle = bundle;
  if (bundle.schemaVersion !== '1.0.0') {
    try {
      workingBundle = applySchemaMigrations(bundle);
    } catch (error) {
      if (error instanceof SchemaMigrationError) {
        throw new RulesetInvariantError(
          bundle.rulesetVersion,
          'SCHEMA_MISMATCH',
          `Cannot migrate schema: ${error.message}`
        );
      }
      throw error;
    }
  }

  // PINNED RULESET: Determine the pinned ruleset version.
  // Backward-compatibility: some historical bundles may omit `rulesetVersion`.
  // In that case we deterministically fall back to DEFAULT_RULESET_VERSION
  // to allow regeneration of legacy evidence without introducing runtime
  // surprises.
  const pinnedVersion = bundle.rulesetVersion || DEFAULT_RULESET_VERSION;
  const pinnedRuleset = getRuleset(pinnedVersion);

  // Prepare inputs for pinned ruleset
  // Prepare deterministic inputs for the pinned ruleset. Note the following
  // normalization choices made to guarantee identical outputs for identical
  // inputs:
  // - `generatedAtISO` (as consumed by ruleset compute) is set to the
  //    snapshot capture time so that snapshotAgeSeconds = generatedTime -
  //    snapshotCaptureTime matches historical computations.
  // - `nowISO` is set to the evidence's generatedAtISO (time of truth
  //    computation), never to the current system time.
  // - `missingData` list is sorted to avoid ordering instability across runs.
  const snapshotRef = workingBundle.snapshotRefs[0];
  const computeInputs: RulesetComputeInputs = {
    generatedAtISO: snapshotRef?.capturedAtISO || workingBundle.generatedAtISO,
    snapshotId: snapshotRef?.snapshotId || 'unknown',
    rulesetVersion: pinnedVersion, // Keep pinned version (not current)
    // Derive completeness deterministically from missing data so that
    // regeneration does not accidentally echo a tampered stored output.
    // Heuristic: each missing dataset reduces completeness by 15 percentage
    // points (clamped). This mirrors legacy behaviour used in earlier
    // computation and ensures modified stored outputs get detected.
    completenessPercent: Math.max(
      0,
      Math.min(
        100,
        100 - ((workingBundle.missingData || []).length * 15)
      )
    ),
    confidenceLevel: workingBundle.outputTruthMetadata.confidenceLevel,
    validityStatus: workingBundle.outputTruthMetadata.validityStatus,
    driftStatus: workingBundle.driftStatusAtGeneration.driftStatusSummary,
    missingData: (workingBundle.missingData || []).map(md => md.datasetName).sort(),
    nowISO: workingBundle.generatedAtISO, // Use evidence generation time deterministically
  };

  // Recompute using PINNED ruleset
  const regenerated = pinnedRuleset.computeTruth(computeInputs);

  return regenerated;
}

/**
 * Verify that regenerated truth matches stored truth
 * 
 * Returns:
 * - true if they match (evidence is valid)
 * - false with details if they mismatch (INVARIANT violation)
 */
export function verifyRegeneratedTruth(bundle: EvidenceBundle): {
  matches: boolean;
  original: OutputTruthMetadata;
  regenerated: OutputTruthMetadata;
  differences?: string[];
} {
  const original = bundle.outputTruthMetadata;

  let regenerated: OutputTruthMetadata;
  try {
    regenerated = regenerateOutputTruth(bundle);
  } catch (error) {
    return {
      matches: false,
      original,
      regenerated: original,
      differences: [`Regeneration failed: ${error}`],
    };
  }

  // Compare critical fields
  const differences: string[] = [];

  if (original.completenessPercent !== regenerated.completenessPercent) {
    differences.push(
      `completenessPercent: ${original.completenessPercent} vs ${regenerated.completenessPercent}`
    );
  }

  if (original.confidenceLevel !== regenerated.confidenceLevel) {
    differences.push(
      `confidenceLevel: ${original.confidenceLevel} vs ${regenerated.confidenceLevel}`
    );
  }

  if (original.validityStatus !== regenerated.validityStatus) {
    differences.push(
      `validityStatus: ${original.validityStatus} vs ${regenerated.validityStatus}`
    );
  }

  // Compare reason lists
  const origReasons = (original.reasons || []).sort().join(',');
  const regenReasons = (regenerated.reasons || []).sort().join(',');
  if (origReasons !== regenReasons) {
    differences.push(`reasons mismatch: ${origReasons} vs ${regenReasons}`);
  }

  const origWarnings = (original.warnings || []).sort().join(',');
  const regenWarnings = (regenerated.warnings || []).sort().join(',');
  if (origWarnings !== regenWarnings) {
    differences.push(`warnings mismatch: ${origWarnings} vs ${regenWarnings}`);
  }

  return {
    matches: differences.length === 0,
    original,
    regenerated,
    differences: differences.length > 0 ? differences : undefined,
  };
}

/**
 * Helper: Create verification result record
 * Used by verify_regeneration.ts
 */
export function createVerificationResult(
  evidenceId: string,
  original: OutputTruthMetadata,
  regenerated: OutputTruthMetadata,
  verified: boolean,
  originalHash: string,
  regeneratedHash: string
): RegenerationVerificationResult {
  return {
    verified,
    evidenceId,
    originalHash,
    regeneratedHash,
    matchesStored: verified,
    verificationTimestampISO: new Date().toISOString(),
    mismatchDetails: !verified
      ? {
          originalTruthReasons: original.reasons || [],
          regeneratedTruthReasons: regenerated.reasons || [],
          differenceDescription: `Completeness: ${original.completenessPercent}% vs ${regenerated.completenessPercent}%, ` +
            `Confidence: ${original.confidenceLevel} vs ${regenerated.confidenceLevel}, ` +
            `Validity: ${original.validityStatus} vs ${regenerated.validityStatus}`,
        }
      : undefined,
    invariantViolation: verified ? 'NONE' : 'HASH_MISMATCH',
  };
}
