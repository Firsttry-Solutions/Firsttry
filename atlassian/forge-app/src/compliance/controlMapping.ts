/**
 * Control Mapping Engine — ECL Enterprise Hardening
 *
 * Deterministic control status mapping from drift + review seal + snapshot freshness.
 *
 * Mapping is a static object literal.
 * Status rules (strict):
 * - PASS:    no critical drift, review sealed, snapshot fresh (< threshold)
 * - PARTIAL: medium drift present (no critical/high)
 * - FAIL:    critical drift OR unsealed review OR missing data
 *
 * If data missing → THROW (fail-closed).
 *
 * // FT_ECL_ENGINE: CONTROL_MAPPING_V1
 */

// FT_ECL_ENGINE: CONTROL_MAPPING_V1

import { DriftResult } from '../drift/riskEngine';

/** Version of this control mapping engine */
export const CONTROL_MAPPING_VERSION = 'ecl.controlMapping@1' as const;

/** Snapshot freshness threshold — 24 hours in milliseconds */
const SNAPSHOT_FRESHNESS_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/** Control status values */
export type ControlStatus = 'PASS' | 'PARTIAL' | 'FAIL';

/** A single control evaluation result */
export interface ControlEvaluation {
  readonly controlId: string;
  readonly controlName: string;
  readonly framework: string;
  readonly status: ControlStatus;
  readonly reason: string;
}

/**
 * Static control reference table.
 * Mapping is by static rule only — NOT a certification claim.
 * Order is deterministic by declaration.
 */
const STATIC_CONTROL_REFERENCE: ReadonlyArray<{
  readonly controlId: string;
  readonly controlName: string;
  readonly framework: string;
}> = Object.freeze([
  { controlId: 'CC6.1', controlName: 'Logical and Physical Access Controls', framework: 'SOC2' },
  { controlId: 'CC6.2', controlName: 'Privileged Account Management', framework: 'SOC2' },
  { controlId: 'CC6.3', controlName: 'Access Restriction (Need-to-Know)', framework: 'SOC2' },
  { controlId: 'CC7.1', controlName: 'Monitoring of Security Events', framework: 'SOC2' },
  { controlId: 'CC7.2', controlName: 'Anomaly and Threat Detection', framework: 'SOC2' },
  { controlId: 'A.5.1',  controlName: 'Policies for Information Security', framework: 'ISO27001' },
  { controlId: 'A.8.9',  controlName: 'Configuration Management', framework: 'ISO27001' },
  { controlId: 'A.8.12', controlName: 'Data Leakage Prevention', framework: 'ISO27001' },
  { controlId: 'A.8.15', controlName: 'Logging', framework: 'ISO27001' },
  { controlId: 'A.8.24', controlName: 'Use of Cryptography', framework: 'ISO27001' },
  { controlId: 'A.8.32', controlName: 'Change Management', framework: 'ISO27001' },
]) as ReadonlyArray<{ controlId: string; controlName: string; framework: string }>;

/** Input parameters for control mapping */
export interface ControlMappingInput {
  readonly driftResult: DriftResult;
  readonly reviewSealed: boolean;
  readonly snapshotGeneratedUtc: string;   // ISO 8601 string
  readonly evaluatedUtc: string;           // ISO 8601 string
}

/** Result of control mapping evaluation */
export interface ControlMappingResult {
  readonly controls: ReadonlyArray<ControlEvaluation>;
  readonly overallStatus: ControlStatus;
  readonly evaluatedUtc: string;
  readonly controlCount: number;
  readonly passCount: number;
  readonly partialCount: number;
  readonly failCount: number;
}

/**
 * Determine if a snapshot is fresh (within the freshness threshold).
 */
function isSnapshotFresh(snapshotGeneratedUtc: string, evaluatedUtc: string): boolean {
  const snapshotMs = new Date(snapshotGeneratedUtc).getTime();
  const evaluatedMs = new Date(evaluatedUtc).getTime();
  if (!Number.isFinite(snapshotMs) || !Number.isFinite(evaluatedMs)) {
    throw new Error(
      '[FT_ECL_ENGINE:CONTROL_MAPPING_V1] FAIL-CLOSED: invalid date strings for freshness check'
    );
  }
  return (evaluatedMs - snapshotMs) < SNAPSHOT_FRESHNESS_THRESHOLD_MS;
}

/**
 * Determine control status using strict rules:
 * - FAIL: critical drift OR unsealed review
 * - PARTIAL: medium drift (no critical/high)
 * - PASS: no critical drift, review sealed, snapshot fresh
 */
function evaluateControlStatus(
  driftResult: DriftResult,
  reviewSealed: boolean,
  snapshotFresh: boolean
): { status: ControlStatus; reason: string } {
  if (driftResult.hasCritical) {
    return {
      status: 'FAIL',
      reason: 'Critical drift detected (role or admin group changes)',
    };
  }

  if (!reviewSealed) {
    return {
      status: 'FAIL',
      reason: 'Review cycle not sealed',
    };
  }

  if (driftResult.hasHigh) {
    return {
      status: 'FAIL',
      reason: 'High-severity drift detected (permission widening)',
    };
  }

  if (driftResult.hasMedium) {
    return {
      status: 'PARTIAL',
      reason: 'Medium-severity drift present',
    };
  }

  if (!snapshotFresh) {
    return {
      status: 'PARTIAL',
      reason: 'Snapshot exceeds freshness threshold (> 24h old)',
    };
  }

  return {
    status: 'PASS',
    reason: 'No critical drift, review sealed, snapshot fresh',
  };
}

/**
 * Evaluate all controls deterministically.
 *
 * @param input - Drift result, seal status, timestamps
 * @returns Complete control mapping result
 * @throws {Error} if any required input is missing
 */
export function evaluateControls(input: ControlMappingInput): ControlMappingResult {
  if (!input) {
    throw new Error(
      '[FT_ECL_ENGINE:CONTROL_MAPPING_V1] FAIL-CLOSED: input is required'
    );
  }

  const { driftResult, reviewSealed, snapshotGeneratedUtc, evaluatedUtc } = input;

  // Validate required fields
  if (!driftResult) {
    throw new Error(
      '[FT_ECL_ENGINE:CONTROL_MAPPING_V1] FAIL-CLOSED: driftResult is required'
    );
  }
  if (typeof reviewSealed !== 'boolean') {
    throw new Error(
      '[FT_ECL_ENGINE:CONTROL_MAPPING_V1] FAIL-CLOSED: reviewSealed must be a boolean'
    );
  }
  if (typeof snapshotGeneratedUtc !== 'string' || snapshotGeneratedUtc.length === 0) {
    throw new Error(
      '[FT_ECL_ENGINE:CONTROL_MAPPING_V1] FAIL-CLOSED: snapshotGeneratedUtc must be a non-empty string'
    );
  }
  if (typeof evaluatedUtc !== 'string' || evaluatedUtc.length === 0) {
    throw new Error(
      '[FT_ECL_ENGINE:CONTROL_MAPPING_V1] FAIL-CLOSED: evaluatedUtc must be a non-empty string'
    );
  }
  for (const key of ['severity', 'hasCritical', 'hasHigh', 'hasMedium', 'findings'] as const) {
    if ((driftResult as any)[key] === undefined) {
      throw new Error(
        `[FT_ECL_ENGINE:CONTROL_MAPPING_V1] FAIL-CLOSED: driftResult.${key} is required`
      );
    }
  }

  const snapshotFresh = isSnapshotFresh(snapshotGeneratedUtc, evaluatedUtc);
  const { status: overallStatus, reason: overallReason } = evaluateControlStatus(
    driftResult,
    reviewSealed,
    snapshotFresh
  );

  // All controls receive the same deterministic status and reason
  const controls: ControlEvaluation[] = STATIC_CONTROL_REFERENCE.map((ref) => ({
    controlId: ref.controlId,
    controlName: ref.controlName,
    framework: ref.framework,
    status: overallStatus,
    reason: overallReason,
  }));

  const passCount = controls.filter((c) => c.status === 'PASS').length;
  const partialCount = controls.filter((c) => c.status === 'PARTIAL').length;
  const failCount = controls.filter((c) => c.status === 'FAIL').length;

  return {
    controls,
    overallStatus,
    evaluatedUtc,
    controlCount: controls.length,
    passCount,
    partialCount,
    failCount,
  };
}

// FT_ECL_ENGINE: CONTROL_MAPPING_V1 END

// =============================================================================
// BACKWARD COMPATIBILITY SHIM (FT_BACKWARD_COMPAT_V1)
// These exports preserve the pre-ECL-ENTERPRISE API used by existing consumers.
// Do not remove; do not change keys.
// =============================================================================

/** @deprecated Use evaluateControls() instead. Preserved for backward compatibility. */
export type DriftCategory = string;

/** @deprecated Use ControlEvaluation instead. Preserved for backward compatibility. */
export type ControlMapping = Readonly<{
  control: string;
  explanation: string;
}>;

/**
 * DRIFT_TO_SOC2:
 * Static mapping from drift category -> SOC 2 style control reference.
 * Mapping is by static rule only; NOT a certification claim.
 * @deprecated Preserved for backward compatibility with existing consumers.
 */
export const DRIFT_TO_SOC2: Readonly<Record<string, ControlMapping>> = Object.freeze({
  'PERMISSION_CHANGE':  Object.freeze({ control: 'CC6.1', explanation: 'Mapped by static rule.' }),
  'ADMIN_GRANTED':      Object.freeze({ control: 'CC6.2', explanation: 'Mapped by static rule.' }),
  'ADMIN_REVOKED':      Object.freeze({ control: 'CC6.2', explanation: 'Mapped by static rule.' }),
  'PROJECT_VISIBILITY': Object.freeze({ control: 'CC6.3', explanation: 'Mapped by static rule.' }),
  'GROUP_MEMBERSHIP':   Object.freeze({ control: 'CC6.1', explanation: 'Mapped by static rule.' }),
  'ROLE_CHANGE':        Object.freeze({ control: 'CC6.2', explanation: 'Mapped by static rule.' }),
  'ADMIN_GROUP_CHANGE': Object.freeze({ control: 'CC6.2', explanation: 'Mapped by static rule.' }),
  'PERMISSION_WIDENING':  Object.freeze({ control: 'CC6.1', explanation: 'Mapped by static rule.' }),
  'PERMISSION_NARROWING': Object.freeze({ control: 'CC6.1', explanation: 'Mapped by static rule.' }),
  'WORKFLOW_CHANGE':    Object.freeze({ control: 'CC6.3', explanation: 'Mapped by static rule.' }),
  'APP_INSTALL_CHANGE': Object.freeze({ control: 'CC6.1', explanation: 'Mapped by static rule.' }),
  'USER_CHANGE':        Object.freeze({ control: 'CC6.1', explanation: 'Mapped by static rule.' }),
});

/**
 * REVIEWFAIL_TO_ISO27001:
 * Static mapping from reviewer-style finding -> ISO/IEC 27001 Annex A reference.
 * Mapping is by static rule only; NOT a certification claim.
 * @deprecated Preserved for backward compatibility with existing consumers.
 */
export const REVIEWFAIL_TO_ISO27001: Readonly<Record<string, ControlMapping>> = Object.freeze({
  'NO_OUTBOUND_NETWORKING': Object.freeze({ control: 'A.8.24', explanation: 'Mapped by static rule.' }),
  'NO_SCOPE_CHANGES':       Object.freeze({ control: 'A.5.1',  explanation: 'Mapped by static rule.' }),
  'NO_SECRET_IN_SOURCE':    Object.freeze({ control: 'A.8.12', explanation: 'Mapped by static rule.' }),
  'READ_ONLY_APP':          Object.freeze({ control: 'A.8.9',  explanation: 'Mapped by static rule.' }),
  'AUDIT_LOG_INTEGRITY':    Object.freeze({ control: 'A.8.15', explanation: 'Mapped by static rule.' }),
  'CHANGE_CONTROL':         Object.freeze({ control: 'A.8.32', explanation: 'Mapped by static rule.' }),
});

// BACKWARD_COMPAT_SHIM END
// =============================================================================
// COMPLIANCE EVIDENCE GENERATOR (FT_EVIDENCE_GENERATOR_V1)
// Generates deterministic evidence artifacts from review workflow data.
// NOT a certification or attestation claim — evidence artifact only.
// =============================================================================

/**
 * A deterministic compliance evidence artifact.
 */
export interface ComplianceEvidence {
  readonly generatedUtc: string;
  readonly reviewId: string;
  readonly controlEvaluations: ReadonlyArray<{
    controlId: string;
    controlName: string;
    framework: string;
    status: string;
    evidence: string;
  }>;
  readonly disclaimers: string[];
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * ComplianceEvidenceGenerator — deterministic evidence artifact builder.
 *
 * Rules:
 * - Output is deterministic: same input → same output (no random, no Date.now unless
 *   generatedAt is omitted for non-test contexts).
 * - Output text must NEVER contain certification/attestation language.
 * - Disclaimers are always present.
 * - FAIL-CLOSED: throws if workflow is missing.
 */
export class ComplianceEvidenceGenerator {
  /**
   * Generate a compliance evidence artifact from a review workflow.
   *
   * @param workflow - The review workflow state object
   * @param generatedAt - Optional deterministic timestamp (for test reproducibility)
   * @returns A ComplianceEvidence object
   * @throws {Error} if workflow is missing
   */
  static generateEvidence(workflow: any, generatedAt?: string): ComplianceEvidence {
    if (!workflow) {
      throw new Error('FT_REVIEW_EVIDENCE_GENERATOR_MISSING: workflow is required');
    }

    console.log('[FT_PROOF_REVIEW_EVIDENCE_GENERATOR_PRESENT]=1');

    const generatedUtc = generatedAt || new Date().toISOString();
    const reviewId = workflow.reviewId || 'unknown';

    const controlEvaluations = STATIC_CONTROL_REFERENCE.map(ref => ({
      controlId: ref.controlId,
      controlName: ref.controlName,
      framework: ref.framework,
      status: workflow.sealed === true ? 'OBSERVED' : 'PENDING',
      evidence: `Evidence artifact: ${ref.controlId} evaluated for review ${reviewId}`,
    }));

    return {
      generatedUtc,
      reviewId,
      controlEvaluations,
      disclaimers: [
        'This is an evidence artifact generated automatically by FirstTry. It is NOT a certification or attestation.',
        'Control status reflects observations at the time of review only.',
      ],
      metadata: {
        schemaVersion: CONTROL_MAPPING_VERSION,
        generatorVersion: '1.0.0',
      },
    };
  }

  /**
   * Export evidence as deterministic canonical JSON string.
   * Keys are sorted for reproducible output.
   *
   * @param evidence - The ComplianceEvidence object
   * @returns A JSON string
   */
  static exportEvidenceJSON(evidence: ComplianceEvidence): string {
    // Sort top-level keys for canonical output
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(evidence).sort()) {
      sorted[key] = (evidence as any)[key];
    }
    return JSON.stringify(sorted, null, 2);
  }

  /**
   * Generate a human-readable evidence report.
   * Text NEVER contains certification/attestation language.
   *
   * @param evidence - The ComplianceEvidence object
   * @returns A plain-text report string
   */
  static generateEvidenceReport(evidence: ComplianceEvidence): string {
    const lines: string[] = [
      `Evidence artifact generated automatically for review ${evidence.reviewId}`,
      `Generated: ${evidence.generatedUtc}`,
      '',
      'Control Observations:',
      ...evidence.controlEvaluations.map(ce =>
        `  ${ce.controlId} (${ce.framework}): ${ce.status} — ${ce.evidence}`
      ),
      '',
      'Disclaimers:',
      ...evidence.disclaimers.map(d => `  - ${d}`),
    ];
    return lines.join('\n');
  }
}

// COMPLIANCE_EVIDENCE_GENERATOR END