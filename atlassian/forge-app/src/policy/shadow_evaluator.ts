/**
 * PHASE P6: SILENT SHADOW EVALUATION (Internal Only)
 * 
 * Computes how outputs would differ under CURRENT ruleset
 * without changing any runtime behavior.
 * 
 * Rules:
 * - INTERNAL ONLY (never exposed in UI by default)
 * - NEVER changes runtime output
 * - NEVER affects exports without explicit developer action
 * - Results are tenant-scoped and retention-controlled
 * - Used for diagnostics and future engineering insights
 * - No user action or interaction required
 */

import { EvidenceBundle } from '../evidence/evidence_model';
import { OutputTruthMetadata } from '../output/output_contract';
import { getCurrentRulesetVersion, getRuleset, RulesetComputeInputs } from './ruleset_registry';

/**
 * Shadow evaluation result
 * Shows what WOULD change if current rules were applied to historical evidence
 */
export interface ShadowEvaluationResult {
  // Identification
  evidenceId: string;
  tenantKey: string;
  cloudId: string;
  
  // Evaluation timestamp
  evaluatedAtISO: string;
  
  // Current (historical) output
  originalTruthMetadata: OutputTruthMetadata;
  originalRulesetVersion: string;
  
  // What it would be under current ruleset
  shadowTruthMetadata: OutputTruthMetadata;
  currentRulesetVersion: string;
  
  // Differences (if any)
  hasDifferences: boolean;
  differences?: {
    completenessChanged: boolean;
    confidenceLevelChanged: boolean;
    validityStatusChanged: boolean;
    driftStatusChanged: boolean;
    missingDataChanged: boolean;
    warnings: string[];
  };
  
  // Audit metadata
  computationDurationMs: number;
  status: 'success' | 'failed';
  failureReason?: string;
}

/**
 * Shadow store (tenant-scoped, retention-controlled, internal only)
 * 
 * Structure: shadowEvaluations[tenantKey][evidenceId] = ShadowEvaluationResult
 */
const shadowEvaluations = new Map<string, Map<string, ShadowEvaluationResult>>();

/**
 * Compute shadow evaluation for a piece of evidence
 * 
 * Shows: "What would change if we used current ruleset on this evidence?"
 * 
 * RULES:
 * - Does NOT change any outputs or exports
 * - Is NOT exposed in UI by default
 * - Results are stored internally for diagnostics only
 * - Fully deterministic
 * - Tenant-scoped
 * - Retention-controlled (auto-delete per P1 policy)
 * 
 * @param bundle The evidence to evaluate
 * @returns Shadow evaluation result (stored internally)
 */
export function computeShadowEvaluation(bundle: EvidenceBundle): ShadowEvaluationResult {
  const startTime = performance.now();
  const evaluatedAtISO = new Date().toISOString();

  try {
    const currentRulesetVersion = getCurrentRulesetVersion();
    
    // If using current ruleset, shadow equals original
    if (bundle.rulesetVersion === currentRulesetVersion) {
      return {
        evidenceId: bundle.evidenceId,
        tenantKey: bundle.tenantKey,
        cloudId: bundle.cloudId,
        evaluatedAtISO,
        originalTruthMetadata: bundle.outputTruthMetadata,
        originalRulesetVersion: bundle.rulesetVersion,
        shadowTruthMetadata: bundle.outputTruthMetadata,
        currentRulesetVersion,
        hasDifferences: false,
        computationDurationMs: performance.now() - startTime,
        status: 'success',
      };
    }

    // Compute what truth would be under current ruleset
    const currentRuleset = getRuleset(currentRulesetVersion);
    const computeInputs: RulesetComputeInputs = {
      generatedAtISO: bundle.generatedAtISO,
      snapshotId: bundle.snapshotRefs[0]?.snapshotId || 'unknown',
      snapshotCreatedAtISO: bundle.snapshotRefs[0]?.capturedAtISO || bundle.generatedAtISO,
      rulesetVersion: currentRulesetVersion,
      completenessPercent: bundle.outputTruthMetadata.completenessPercent,
      confidenceLevel: bundle.outputTruthMetadata.confidenceLevel,
      validityStatus: bundle.outputTruthMetadata.validityStatus,
      driftStatus: ((): any => {
        const s = bundle.driftStatusAtGeneration.driftStatusSummary;
        switch (s) {
          case 'stable':
            return 'NO_DRIFT';
          case 'detected':
            return 'DRIFT_DETECTED';
          default:
            return 'UNKNOWN';
        }
      })(),
      missingData: bundle.missingData.map((d) => d.datasetName),
      nowISO: evaluatedAtISO,
    };

    const shadowTruth = currentRuleset.computeTruth(computeInputs);

    // Compare original vs shadow
    const differences = {
      completenessChanged:
        bundle.outputTruthMetadata.completenessPercent !== shadowTruth.completenessPercent,
      confidenceLevelChanged:
        bundle.outputTruthMetadata.confidenceLevel !== shadowTruth.confidenceLevel,
      validityStatusChanged:
        bundle.outputTruthMetadata.validityStatus !== shadowTruth.validityStatus,
      driftStatusChanged:
        bundle.outputTruthMetadata.driftStatus !== shadowTruth.driftStatus,
      missingDataChanged:
        JSON.stringify(bundle.outputTruthMetadata.missingData) !==
        JSON.stringify(shadowTruth.missingData),
      warnings: [] as string[],
    };

    if (differences.validityStatusChanged) {
      differences.warnings.push(
        `Validity would change from ${bundle.outputTruthMetadata.validityStatus} to ${shadowTruth.validityStatus}`
      );
    }
    if (differences.confidenceLevelChanged) {
      differences.warnings.push(
        `Confidence would change from ${bundle.outputTruthMetadata.confidenceLevel} to ${shadowTruth.confidenceLevel}`
      );
    }

    const result: ShadowEvaluationResult = {
      evidenceId: bundle.evidenceId,
      tenantKey: bundle.tenantKey,
      cloudId: bundle.cloudId,
      evaluatedAtISO,
      originalTruthMetadata: bundle.outputTruthMetadata,
      originalRulesetVersion: bundle.rulesetVersion,
      shadowTruthMetadata: shadowTruth,
      currentRulesetVersion,
      hasDifferences: Object.values(differences).some((v) => typeof v === 'boolean' && v),
      differences: Object.values(differences).some((v) => typeof v === 'boolean' && v) ? differences : undefined,
      computationDurationMs: performance.now() - startTime,
      status: 'success',
    };

    // Store in shadow store (internal only, tenant-scoped)
    storeShadowEvaluation(result);

    return result;
  } catch (error) {
    const result: ShadowEvaluationResult = {
      evidenceId: bundle.evidenceId,
      tenantKey: bundle.tenantKey,
      cloudId: bundle.cloudId,
      evaluatedAtISO,
      originalTruthMetadata: bundle.outputTruthMetadata,
      originalRulesetVersion: bundle.rulesetVersion,
      shadowTruthMetadata: {} as OutputTruthMetadata, // Placeholder on error
      currentRulesetVersion: getCurrentRulesetVersion(),
      hasDifferences: false,
      computationDurationMs: performance.now() - startTime,
      status: 'failed',
      failureReason: (error as Error).message,
    };

    storeShadowEvaluation(result);
    return result;
  }
}

/**
 * Store shadow evaluation in tenant-scoped internal store
 * 
 * RULES:
 * - Tenant-scoped: no cross-tenant access
 * - Retention-controlled: P1 policy applies (90 days TTL)
 * - Internal only: never exposed in UI without explicit developer action
 * 
 * @param result The shadow evaluation result to store
 */
function storeShadowEvaluation(result: ShadowEvaluationResult): void {
  if (!shadowEvaluations.has(result.tenantKey)) {
    shadowEvaluations.set(result.tenantKey, new Map());
  }

  const tenantEvaluations = shadowEvaluations.get(result.tenantKey)!;
  tenantEvaluations.set(result.evidenceId, result);

  // TODO: In production, also persist to Forge storage with TTL metadata
  // For now, in-memory store for testing
}

/**
 * Retrieve shadow evaluation (internal diagnostics only)
 * 
 * RULES:
 * - Tenant-scoped: cannot access other tenants' evaluations
 * - Never exposed in UI without explicit developer action
 * 
 * @param tenantKey The tenant key
 * @param evidenceId The evidence ID
 * @returns The shadow evaluation, or undefined if not found
 */
export function getShadowEvaluation(
  tenantKey: string,
  evidenceId: string
): ShadowEvaluationResult | undefined {
  const tenantEvaluations = shadowEvaluations.get(tenantKey);
  return tenantEvaluations?.get(evidenceId);
}

/**
 * List all shadow evaluations for a tenant (internal diagnostics)
 * 
 * @param tenantKey The tenant key
 * @param limit Maximum results to return
 * @returns Array of shadow evaluation results
 */
export function listShadowEvaluations(tenantKey: string, limit: number = 100): ShadowEvaluationResult[] {
  const tenantEvaluations = shadowEvaluations.get(tenantKey);
  if (!tenantEvaluations) {
    return [];
  }

  return Array.from(tenantEvaluations.values()).slice(0, limit);
}

/**
 * Clear shadow evaluations (administrative reset, retention cleanup)
 * 
 * @param tenantKey If provided, clear only this tenant's evaluations
 */
export function clearShadowEvaluations(tenantKey?: string): void {
  if (tenantKey) {
    shadowEvaluations.delete(tenantKey);
  } else {
    shadowEvaluations.clear();
  }
}

/**
 * Check if shadow evaluation would change outputs
 * Used by tests and internal diagnostics
 * 
 * IMPORTANT: This does NOT change runtime behavior.
 * Results are informational only.
 * 
 * @param result The shadow evaluation result
 * @returns true if evaluation shows differences, false otherwise
 */
export function shadowEvaluationIndicatesChanges(result: ShadowEvaluationResult): boolean {
  return result.hasDifferences && result.status === 'success';
}
