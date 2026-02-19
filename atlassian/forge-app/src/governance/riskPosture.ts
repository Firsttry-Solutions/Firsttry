/**
 * Risk Posture Engine — ECL Enterprise Hardening
 *
 * Computes deterministic overall risk posture from drift result and review seal status.
 *
 * Risk calculation (no weighting, no hidden logic):
 * - CRITICAL: any critical drift finding
 * - HIGH:     high drift present OR review not sealed
 * - MEDIUM:   only medium drift present (no critical/high)
 * - LOW:      no drift and review sealed
 *
 * Rules:
 * - No weighting system
 * - No hidden logic
 * - Throws on missing/incomplete input
 *
 * // FT_ECL_ENGINE: RISK_POSTURE_V1
 */

// FT_ECL_ENGINE: RISK_POSTURE_V1

import { DriftResult, DriftSeverity } from '../drift/riskEngine';

/** Overall risk posture levels */
export type RiskPosture = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/** Risk posture result */
export interface RiskPostureResult {
  readonly posture: RiskPosture;
  readonly reason: string;
  readonly driftSeverity: DriftSeverity;
  readonly reviewSealed: boolean;
  readonly computedUtc: string;
}

/**
 * Compute the overall risk posture.
 *
 * Deterministic computation — no weighting, no hidden logic:
 * - CRITICAL if hasCritical
 * - HIGH if hasHigh OR review not sealed
 * - MEDIUM if only medium drift
 * - LOW if no drift AND sealed
 *
 * @param driftResult - Result from drift risk engine
 * @param reviewSealed - Whether the current review is sealed
 * @param computedUtc - ISO 8601 timestamp
 * @returns RiskPostureResult
 * @throws {Error} if driftResult or computedUtc is missing
 */
export function computeRiskPosture(
  driftResult: DriftResult,
  reviewSealed: boolean,
  computedUtc: string
): RiskPostureResult {
  if (!driftResult) {
    throw new Error(
      '[FT_ECL_ENGINE:RISK_POSTURE_V1] FAIL-CLOSED: driftResult is required'
    );
  }

  if (typeof computedUtc !== 'string' || computedUtc.length === 0) {
    throw new Error(
      '[FT_ECL_ENGINE:RISK_POSTURE_V1] FAIL-CLOSED: computedUtc must be a non-empty ISO string'
    );
  }

  if (typeof reviewSealed !== 'boolean') {
    throw new Error(
      '[FT_ECL_ENGINE:RISK_POSTURE_V1] FAIL-CLOSED: reviewSealed must be a boolean'
    );
  }

  // Validate driftResult structure
  for (const key of ['severity', 'hasCritical', 'hasHigh', 'hasMedium', 'findings'] as const) {
    if ((driftResult as any)[key] === undefined) {
      throw new Error(
        `[FT_ECL_ENGINE:RISK_POSTURE_V1] FAIL-CLOSED: driftResult.${key} is required`
      );
    }
  }

  let posture: RiskPosture;
  let reason: string;

  if (driftResult.hasCritical) {
    posture = 'CRITICAL';
    reason = 'Critical drift detected (role or admin group changes)';
  } else if (driftResult.hasHigh || !reviewSealed) {
    posture = 'HIGH';
    reason = driftResult.hasHigh
      ? 'High-severity drift detected (permission widening)'
      : 'Review cycle not sealed';
    if (driftResult.hasHigh && !reviewSealed) {
      reason = 'High-severity drift detected AND review cycle not sealed';
    }
  } else if (driftResult.hasMedium) {
    posture = 'MEDIUM';
    reason = 'Medium-severity drift detected';
  } else {
    posture = 'LOW';
    reason = 'No drift detected and review cycle is sealed';
  }

  return {
    posture,
    reason,
    driftSeverity: driftResult.severity,
    reviewSealed,
    computedUtc,
  };
}

// FT_ECL_ENGINE: RISK_POSTURE_V1 END
