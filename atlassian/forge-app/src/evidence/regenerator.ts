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

  // GATE: Pre-regeneration compatibility checks (fail-closed)
  try {
    gatePreRegenerationValidation(bundle);
  } catch (error) {
    if (error instanceof CompatibilityGateError) {
      throw new RulesetInvariantError(
        bundle.rulesetVersion,
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

  // PINNED RULESET: Get the ruleset version that was used at evidence generation time
  // NEVER use current ruleset for historical regeneration
  const pinnedRuleset = getRuleset(bundle.rulesetVersion);
  
  if (!pinnedRuleset) {
    throw new RulesetInvariantError(
      bundle.rulesetVersion,
      'NOT_FOUND',
      `Pinned ruleset ${bundle.rulesetVersion} not found in registry`
    );
  }

  // Prepare inputs for pinned ruleset
  const computeInputs: RulesetComputeInputs = {
    generatedAtISO: workingBundle.generatedAtISO,
    snapshotId: workingBundle.snapshotRefs[0]?.snapshotId || 'unknown',
    rulesetVersion: bundle.rulesetVersion, // Keep pinned version (not current)
    completenessPercent: workingBundle.outputTruthMetadata.completenessPercent,
    confidenceLevel: workingBundle.outputTruthMetadata.confidenceLevel,
    validityStatus: workingBundle.outputTruthMetadata.validityStatus,
    driftStatus: workingBundle.driftStatusAtGeneration.driftStatusSummary,
    missingData: workingBundle.missingData.map(md => md.datasetName),
    nowISO: workingBundle.generatedAtISO, // Use generation time, not current time
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
