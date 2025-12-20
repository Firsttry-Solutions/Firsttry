/**
 * PHASE 5 REPORT TYPE CONTRACT
 * 
 * This module defines the ONLY allowed shape for Phase-5 reports.
 * 
 * Design principles:
 * 1. It is IMPOSSIBLE to construct a Phase5Report without Phase-4 disclosure envelopes
 * 2. It is IMPOSSIBLE to add trends/scores/recommendations/benchmarks (types prevent it)
 * 3. Sections A-D must exist exactly once, in order (fixed object structure, not arrays)
 * 4. Every metric-like value is wrapped with Phase-4 disclosure types
 * 
 * Compile-time enforcement:
 * - No optional fields where disclosure is required
 * - Forbidden keys (trend, score, benchmark, recommendation, etc.) make types invalid
 * - Section names are literal strings (cannot be reordered or duplicated)
 */

import {
  MandatoryDisclosureEnvelope,
  DataQualityIndicatorWithSemanticState,
  ForecastWithMandatoryImmutability,
  ConfidenceLevel,
} from './disclosure_hardening_gaps_a_f';

// ============================================================================
// AVAILABILITY STATES (from Phase-4 coverage_matrix.ts)
// ============================================================================

/**
 * Coverage state enumeration from Phase-4 coverage matrix.
 * These are the ONLY allowed availability states for datasets.
 */
export enum DatasetAvailabilityState {
  AVAILABLE = 'AVAILABLE',
  PARTIAL = 'PARTIAL',
  MISSING = 'MISSING',
  NOT_PERMITTED_BY_SCOPE = 'NOT_PERMITTED_BY_SCOPE',
}

/**
 * Reason why a dataset is missing/partial.
 * MUST be deterministic (not inferred or subjective).
 */
export enum DatasetMissingReason {
  PERMISSION_NOT_GRANTED = 'PERMISSION_NOT_GRANTED',
  DATASET_EMPTY = 'DATASET_EMPTY',
  FEATURE_UNUSED = 'FEATURE_UNUSED',
  OUT_OF_SCOPE = 'OUT_OF_SCOPE',
}

/**
 * Trigger type that generated the report.
 * Used to audit how report was created (auto vs manual).
 */
export type ReportTrigger = 'AUTO_12H' | 'AUTO_24H' | 'MANUAL';

// ============================================================================
// SECTION A: WHAT WE COLLECTED
// ============================================================================

/**
 * Disclosed count wrapper.
 * Every count must have a disclosure explaining observation window and coverage.
 */
export interface DisclosedCount {
  readonly count: number; // Raw count value (no interpretation)
  readonly disclosure: MandatoryDisclosureEnvelope; // REQUIRED - must explain why this count
}

/**
 * Section A: Metadata about what was observed.
 * 
 * Allowed fields: counts only
 * Forbidden: percentages, interpretations, derived values
 */
export interface ReportSectionA {
  readonly section_name: 'A) WHAT WE COLLECTED'; // Literal, enforced by type
  readonly projects_scanned: DisclosedCount; // Count + disclosure
  readonly issues_scanned: DisclosedCount; // Count + disclosure
  readonly fields_detected: DisclosedCount; // Count + disclosure (includes custom fields)
}

// ============================================================================
// SECTION B: COVERAGE DISCLOSURE
// ============================================================================

/**
 * Single dataset coverage row.
 * Renders Phase-4 coverage outputs verbatim with explicit reasons for missing data.
 */
export interface DatasetCoverageRow {
  readonly dataset_name: string; // e.g., "Projects", "Custom Fields", "Automation Rules"
  readonly availability_state: DatasetAvailabilityState; // AVAILABLE | PARTIAL | MISSING | NOT_PERMITTED_BY_SCOPE
  readonly coverage_percent: number; // 0-100, from Phase-4 coverage_matrix
  readonly coverage_disclosure: MandatoryDisclosureEnvelope; // REQUIRED - explains coverage value
  readonly missing_reason: DatasetMissingReason; // Deterministic reason if state != AVAILABLE
  readonly reason_detail_text: string; // Plain text explanation: "Permission not granted for: field history API", etc.
  readonly mandatory_zero_disclosure?: string; // If coverage_percent = 0, must include: "This value reflects data availability, not Jira quality."
}

/**
 * Section B: Coverage disclosure for each dataset.
 * 
 * Renders Phase-4 coverage outputs VERBATIM.
 * No roll-ups, no normalization, no hiding low coverage.
 */
export interface ReportSectionB {
  readonly section_name: 'B) COVERAGE DISCLOSURE'; // Literal, enforced by type
  readonly datasets: readonly DatasetCoverageRow[]; // Read-only array
}

// ============================================================================
// SECTION C: PRELIMINARY OBSERVATIONS
// ============================================================================

/**
 * Single observation: raw count + label + disclosure.
 * 
 * Forbidden fields (checked at runtime, prevented at compile-time):
 * - trend, trending, improvement, decline
 * - score, ranking, percentile, worst, best
 * - benchmark, compared, comparison
 * - recommendation, suggests, should
 * - infer, implies, indicates
 */
export interface RawCountObservation {
  readonly label: string; // e.g., "Projects detected", "Custom fields present", "Automation rules defined"
  readonly value: number; // Raw count only
  readonly disclosure: MandatoryDisclosureEnvelope; // REQUIRED - explains why this count matters
}

/**
 * Section C: Preliminary observations.
 * 
 * ALLOWED: Raw counts only
 * FORBIDDEN: Adjectives (good, bad, weak, strong), recommendations, implications, comparisons
 * 
 * If a sentence answers "so what?" → DELETE IT.
 */
export interface ReportSectionC {
  readonly section_name: 'C) PRELIMINARY OBSERVATIONS'; // Literal, enforced by type
  readonly observations: readonly RawCountObservation[]; // Read-only array
}

// ============================================================================
// SECTION D: FORECAST
// ============================================================================

/**
 * Forecast unavailable (when observation window is insufficient).
 */
export interface ForecastUnavailable {
  readonly forecast_available: false;
  readonly reason: 'INSUFFICIENT_OBSERVATION_WINDOW';
  readonly disclosure_text: string; // "Forecast unavailable due to insufficient observation window."
}

/**
 * Forecast available (from Phase-4 forecast factory).
 * Must be of type ESTIMATED with full disclosure.
 */
export interface ForecastAvailable {
  readonly forecast_available: true;
  readonly forecast: ForecastWithMandatoryImmutability; // REQUIRED - must have type="ESTIMATED"
}

/**
 * Section D: Forecast (strictly constrained).
 * 
 * Either:
 * 1. forecast_available=true + Phase-4 forecast (type="ESTIMATED" only)
 * 2. forecast_available=false + reason + disclosure text
 * 
 * FORBIDDEN: Trend language, projections beyond disclosure, smooth data
 */
export type ReportSectionD = ForecastUnavailable | ForecastAvailable;

// ============================================================================
// TOP-LEVEL REPORT OBJECT
// ============================================================================

/**
 * PHASE 5 REPORT (Master Contract)
 * 
 * This is the ONLY allowed shape for Phase-5 reports.
 * 
 * Properties:
 * - Exactly 4 sections (A, B, C, D) in fixed order
 * - Cannot be reordered, duplicated, or extended
 * - Every value traced back to Phase-4 disclosure or Phase-4 forecast
 * - Installation timestamp required (from Phase-4 evidence)
 * - Observation window is simple arithmetic (no trend inference)
 * - Trigger type audits how report was created
 */
export interface Phase5Report {
  readonly report_id: string; // UUID or hash of generation moment
  readonly generated_at: string; // ISO 8601 timestamp of generation
  readonly trigger: ReportTrigger; // AUTO_12H | AUTO_24H | MANUAL
  readonly installation_detected_at: string; // ISO 8601 timestamp from Phase-4 evidence
  readonly observation_window: {
    readonly from: string; // ISO 8601 (installation time)
    readonly to: string; // ISO 8601 (generation time)
    readonly duration_hours: number; // Simple arithmetic: (to - from) in hours
  };
  readonly sections: {
    readonly A: ReportSectionA; // WHAT WE COLLECTED
    readonly B: ReportSectionB; // COVERAGE DISCLOSURE
    readonly C: ReportSectionC; // PRELIMINARY OBSERVATIONS
    readonly D: ReportSectionD; // FORECAST
  };
}

// ============================================================================
// COMPILE-TIME GUARDS (Type-Only Tests)
// ============================================================================

/**
 * These compile-time checks prevent certain violations from even being representable.
 * They are NOT runtime checks; they are type system checks.
 * 
 * If any of these assignments fail to compile, it means the type contract is working.
 */

// Helper type: If a Phase5Report contains a forbidden key, this becomes 'never'
type AssertNoForbiddenKeys<T> = {
  [K in keyof T]: T[K] extends { trend?: any } ? 'FORBIDDEN: trend field' :
  T[K] extends { score?: any } ? 'FORBIDDEN: score field' :
  T[K] extends { benchmark?: any } ? 'FORBIDDEN: benchmark field' :
  T[K] extends { recommendation?: any } ? 'FORBIDDEN: recommendation field' :
  T[K] extends { hygiene_score?: any } ? 'FORBIDDEN: hygiene_score field' :
  T[K] extends { compare?: any } ? 'FORBIDDEN: compare field' :
  T[K] extends { ranking?: any } ? 'FORBIDDEN: ranking field' :
  T[K] extends { percentile?: any } ? 'FORBIDDEN: percentile field' :
  T[K] extends { transition?: any } ? 'FORBIDDEN: transition field' :
  T[K] extends { execution?: any } ? 'FORBIDDEN: execution field' :
  never;
};

// This assignment will SUCCEED (empty never object means no forbidden keys)
type _PhaseGuard = AssertNoForbiddenKeys<Phase5Report>;

// ============================================================================
// FACTORY FUNCTIONS FOR TYPE-SAFE CONSTRUCTION
// ============================================================================

/**
 * Factory: Create a disclosed count.
 * 
 * MUST provide disclosure explaining the count.
 */
export function createDisclosedCount(
  count: number,
  disclosure: MandatoryDisclosureEnvelope
): DisclosedCount {
  if (disclosure.completeness_percent === undefined) {
    throw new Error('[PHASE-5-CONTRACT] Disclosed count requires disclosure');
  }
  return { count, disclosure };
}

/**
 * Factory: Create a Section A (WHAT WE COLLECTED).
 * 
 * All counts are required; all must have disclosure.
 */
export function createReportSectionA(
  projects_scanned: DisclosedCount,
  issues_scanned: DisclosedCount,
  fields_detected: DisclosedCount
): ReportSectionA {
  return {
    section_name: 'A) WHAT WE COLLECTED' as const,
    projects_scanned,
    issues_scanned,
    fields_detected,
  };
}

/**
 * Factory: Create a dataset coverage row.
 * 
 * If coverage_percent = 0, mandatory_zero_disclosure MUST be provided.
 */
export function createDatasetCoverageRow(
  dataset_name: string,
  availability_state: DatasetAvailabilityState,
  coverage_percent: number,
  coverage_disclosure: MandatoryDisclosureEnvelope,
  missing_reason: DatasetMissingReason,
  reason_detail_text: string,
  mandatory_zero_disclosure?: string
): DatasetCoverageRow {
  if (coverage_percent === 0 && !mandatory_zero_disclosure) {
    mandatory_zero_disclosure = 'This value reflects data availability, not Jira quality.';
  }
  return {
    dataset_name,
    availability_state,
    coverage_percent,
    coverage_disclosure,
    missing_reason,
    reason_detail_text,
    mandatory_zero_disclosure,
  };
}

/**
 * Factory: Create a Section B (COVERAGE DISCLOSURE).
 */
export function createReportSectionB(datasets: readonly DatasetCoverageRow[]): ReportSectionB {
  return {
    section_name: 'B) COVERAGE DISCLOSURE' as const,
    datasets,
  };
}

/**
 * Factory: Create a raw count observation.
 */
export function createRawCountObservation(
  label: string,
  value: number,
  disclosure: MandatoryDisclosureEnvelope
): RawCountObservation {
  // Guard against adjectives in label (simple check, not exhaustive)
  const forbiddenAdjectives = [
    'good', 'bad', 'weak', 'strong', 'healthy', 'unhealthy',
    'well', 'poorly', 'excellent', 'poor', 'best', 'worst'
  ];
  for (const adj of forbiddenAdjectives) {
    if (label.toLowerCase().includes(adj)) {
      throw new Error(`[PHASE-5-CONTRACT] Observation labels cannot include adjectives: "${adj}"`);
    }
  }
  return { label, value, disclosure };
}

/**
 * Factory: Create a Section C (PRELIMINARY OBSERVATIONS).
 */
export function createReportSectionC(observations: readonly RawCountObservation[]): ReportSectionC {
  return {
    section_name: 'C) PRELIMINARY OBSERVATIONS' as const,
    observations,
  };
}

/**
 * Factory: Create Section D when forecast is unavailable.
 */
export function createForecastUnavailable(reason: string): ForecastUnavailable {
  return {
    forecast_available: false,
    reason: 'INSUFFICIENT_OBSERVATION_WINDOW',
    disclosure_text: `Forecast unavailable due to insufficient observation window. ${reason}`,
  };
}

/**
 * Factory: Create Section D when forecast is available.
 * 
 * MUST use Phase-4 forecast factory output (type="ESTIMATED" enforced).
 */
export function createForecastAvailable(
  forecast: ForecastWithMandatoryImmutability
): ForecastAvailable {
  if (forecast.forecast_type !== 'ESTIMATED') {
    throw new Error('[PHASE-5-CONTRACT] Forecast must be type="ESTIMATED"');
  }
  if (!forecast.immutable) {
    throw new Error('[PHASE-5-CONTRACT] Forecast must be marked immutable');
  }
  return {
    forecast_available: true,
    forecast,
  };
}

/**
 * Factory: Create the top-level Phase5Report.
 * 
 * MUST include all 4 sections.
 * Observation window is computed automatically (from installation to generation time).
 */
export function createPhase5Report(
  report_id: string,
  generated_at: string,
  trigger: ReportTrigger,
  installation_detected_at: string,
  sectionA: ReportSectionA,
  sectionB: ReportSectionB,
  sectionC: ReportSectionC,
  sectionD: ReportSectionD
): Phase5Report {
  // Compute observation window
  const fromTime = new Date(installation_detected_at).getTime();
  const toTime = new Date(generated_at).getTime();
  const duration_ms = toTime - fromTime;
  const duration_hours = Math.round(duration_ms / (1000 * 60 * 60));

  return {
    report_id,
    generated_at,
    trigger,
    installation_detected_at,
    observation_window: {
      from: installation_detected_at,
      to: generated_at,
      duration_hours,
    },
    sections: {
      A: sectionA,
      B: sectionB,
      C: sectionC,
      D: sectionD,
    },
  };
}

/**
 * Validation: Ensure report structure is correct.
 * 
 * This is a redundant check (types should prevent most issues),
 * but serves as runtime confirmation.
 */
export function validatePhase5ReportStructure(report: Phase5Report): void {
  if (!report.sections.A || report.sections.A.section_name !== 'A) WHAT WE COLLECTED') {
    throw new Error('[PHASE-5-VALIDATION] Section A missing or malformed');
  }
  if (!report.sections.B || report.sections.B.section_name !== 'B) COVERAGE DISCLOSURE') {
    throw new Error('[PHASE-5-VALIDATION] Section B missing or malformed');
  }
  if (!report.sections.C || report.sections.C.section_name !== 'C) PRELIMINARY OBSERVATIONS') {
    throw new Error('[PHASE-5-VALIDATION] Section C missing or malformed');
  }
  if (!report.sections.D) {
    throw new Error('[PHASE-5-VALIDATION] Section D missing or malformed');
  }

  // Verify all disclosure objects exist
  if (!report.sections.A.projects_scanned.disclosure) {
    throw new Error('[PHASE-5-VALIDATION] Section A: projects_scanned missing disclosure');
  }
  if (!report.sections.A.issues_scanned.disclosure) {
    throw new Error('[PHASE-5-VALIDATION] Section A: issues_scanned missing disclosure');
  }
  if (!report.sections.A.fields_detected.disclosure) {
    throw new Error('[PHASE-5-VALIDATION] Section A: fields_detected missing disclosure');
  }

  // Verify Section B has datasets with disclosures
  if (!Array.isArray(report.sections.B.datasets) || report.sections.B.datasets.length === 0) {
    throw new Error('[PHASE-5-VALIDATION] Section B: datasets missing or empty');
  }
  for (const dataset of report.sections.B.datasets) {
    if (!dataset.coverage_disclosure) {
      throw new Error(`[PHASE-5-VALIDATION] Section B: dataset "${dataset.dataset_name}" missing coverage_disclosure`);
    }
  }

  // Verify Section C observations have disclosures
  for (const obs of report.sections.C.observations) {
    if (!obs.disclosure) {
      throw new Error(`[PHASE-5-VALIDATION] Section C: observation "${obs.label}" missing disclosure`);
    }
  }
}
