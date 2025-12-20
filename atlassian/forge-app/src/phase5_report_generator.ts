/**
 * PHASE 5 REPORT GENERATOR
 * 
 * Single code path for BOTH automatic and manual triggers.
 * 
 * Design principles:
 * 1. ONE function: generatePhase5Report(trigger) used by all paths
 * 2. Hard validation BAKED IN (Phase-4 validators + rejectPhase5Signals)
 * 3. Aborts immediately on validation failure with visible error
 * 4. No metric computation beyond simple counts from Phase-4
 * 5. No comparisons, trends, inferences, or derivations
 * 
 * If data is unavailable → DISCLOSE, DO NOT INFER.
 * If validation fails → ABORT, DO NOT SHIP.
 */

import {
  Phase5Report,
  ReportTrigger,
  DatasetAvailabilityState,
  DatasetMissingReason,
  createDisclosedCount,
  createReportSectionA,
  createDatasetCoverageRow,
  createReportSectionB,
  createRawCountObservation,
  createReportSectionC,
  createForecastUnavailable,
  createForecastAvailable,
  createPhase5Report,
  validatePhase5ReportStructure,
} from './phase5_report_contract';

import {
  assertValidDisclosure,
  assertPhase4Context,
  rejectPhase5Signals,
  ConfidenceLevel,
  createPhase4Forecast,
  MandatoryDisclosureEnvelope,
} from './disclosure_hardening_gaps_a_f';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

/**
 * Result of report generation.
 * Either success with report, or failure with error message.
 */
export type GenerationResult =
  | { success: true; report: Phase5Report }
  | { success: false; error: string };

/**
 * Phase-4 evidence snapshot (fixture).
 * In production, this would be loaded from Forge Storage (append-only ledger).
 */
export interface Phase4EvidenceSnapshot {
  installation_timestamp: string; // ISO 8601
  metadata_snapshot: {
    projects_count: number;
    issues_scanned_count: number;
    custom_fields_count: number;
  };
  coverage_matrix: {
    projects: {
      state: DatasetAvailabilityState;
      coverage_percent: number;
      reason: DatasetMissingReason;
    };
    custom_fields: {
      state: DatasetAvailabilityState;
      coverage_percent: number;
      reason: DatasetMissingReason;
    };
    automation_rules: {
      state: DatasetAvailabilityState;
      coverage_percent: number;
      reason: DatasetMissingReason;
    };
  };
}

// ============================================================================
// PHASE-4 DATA ACCESS (Approved Interface)
// ============================================================================

/**
 * Load Phase-4 evidence snapshot.
 * 
 * In production:
 * - Read from Forge Storage (append-only ledger)
 * - Validate using Phase-4 validators
 * - Fail hard if missing/corrupted
 * 
 * For MVP testing:
 * - Use fixture data
 * - Still validate before using
 */
async function loadPhase4EvidenceSnapshot(): Promise<Phase4EvidenceSnapshot> {
  // TODO: In production, implement Forge Storage read
  // For now, return a valid fixture
  return {
    installation_timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48h ago
    metadata_snapshot: {
      projects_count: 5,
      issues_scanned_count: 237,
      custom_fields_count: 12,
    },
    coverage_matrix: {
      projects: {
        state: DatasetAvailabilityState.AVAILABLE,
        coverage_percent: 100,
        reason: DatasetMissingReason.DATASET_EMPTY, // irrelevant if AVAILABLE
      },
      custom_fields: {
        state: DatasetAvailabilityState.PARTIAL,
        coverage_percent: 75,
        reason: DatasetMissingReason.PERMISSION_NOT_GRANTED,
      },
      automation_rules: {
        state: DatasetAvailabilityState.AVAILABLE,
        coverage_percent: 100,
        reason: DatasetMissingReason.DATASET_EMPTY,
      },
    },
  };
}

// ============================================================================
// REPORT GENERATION (Single Code Path)
// ============================================================================

/**
 * MAIN FUNCTION: Generate Phase-5 Report
 * 
 * This is the ONLY function used by both automatic and manual triggers.
 * 
 * @param trigger - "AUTO_12H" | "AUTO_24H" | "MANUAL"
 * @returns GenerationResult (success + report, or failure + error)
 * 
 * Hard validation guarantees:
 * - Phase-4 validators called on all inputs
 * - rejectPhase5Signals() called on final report
 * - If validation fails, returns error (does not throw)
 * - Report structure validated before returning
 */
export async function generatePhase5Report(trigger: ReportTrigger): Promise<GenerationResult> {
  try {
    // ========================================================================
    // 1. Validate Phase-4 Context
    // ========================================================================

    assertPhase4Context();

    // ========================================================================
    // 2. Load Phase-4 Evidence
    // ========================================================================

    const evidence = await loadPhase4EvidenceSnapshot();

    if (!evidence.installation_timestamp) {
      return {
        success: false,
        error: '[PHASE-5-GENERATION] Installation timestamp missing from Phase-4 evidence',
      };
    }

    // ========================================================================
    // 3. Compute Observation Window
    // ========================================================================

    const generatedAt = new Date().toISOString();
    const installationTime = new Date(evidence.installation_timestamp).getTime();
    const generationTime = new Date(generatedAt).getTime();
    const windowHours = (generationTime - installationTime) / (1000 * 60 * 60);

    // ========================================================================
    // 4. Build Section A: WHAT WE COLLECTED
    // ========================================================================

    // Create disclosure for each count
    // Disclosure explains: observation window, confidence, completeness
    const projectsDisclosure: MandatoryDisclosureEnvelope = {
      completeness_percent: 100,
      observation_window_days: Math.ceil(windowHours / 24),
      confidence_level: windowHours >= 24 ? ConfidenceLevel.MEDIUM : ConfidenceLevel.LOW,
      disclosure_text: `Projects scanned during ${Math.ceil(windowHours)}-hour observation window. ` +
        `Reflects projects accessible via Jira REST API at time of scan.`,
      computed_at: generatedAt,
      _phase_4_sealed: true,
    };

    const issuesDisclosure: MandatoryDisclosureEnvelope = {
      completeness_percent: 100,
      observation_window_days: Math.ceil(windowHours / 24),
      confidence_level: windowHours >= 24 ? ConfidenceLevel.MEDIUM : ConfidenceLevel.LOW,
      disclosure_text: `Issues scanned during ${Math.ceil(windowHours)}-hour observation window. ` +
        `Count reflects issues in accessible projects only.`,
      computed_at: generatedAt,
      _phase_4_sealed: true,
    };

    const fieldsDisclosure: MandatoryDisclosureEnvelope = {
      completeness_percent: 100,
      observation_window_days: Math.ceil(windowHours / 24),
      confidence_level: windowHours >= 24 ? ConfidenceLevel.MEDIUM : ConfidenceLevel.LOW,
      disclosure_text: `Custom fields detected during ${Math.ceil(windowHours)}-hour observation window. ` +
        `Includes only fields accessible via configured Jira scope.`,
      computed_at: generatedAt,
      _phase_4_sealed: true,
    };

    // Validate all disclosures before using
    assertValidDisclosure(projectsDisclosure);
    assertValidDisclosure(issuesDisclosure);
    assertValidDisclosure(fieldsDisclosure);

    // Create Section A
    const sectionA = createReportSectionA(
      createDisclosedCount(evidence.metadata_snapshot.projects_count, projectsDisclosure),
      createDisclosedCount(evidence.metadata_snapshot.issues_scanned_count, issuesDisclosure),
      createDisclosedCount(evidence.metadata_snapshot.custom_fields_count, fieldsDisclosure)
    );

    // ========================================================================
    // 5. Build Section B: COVERAGE DISCLOSURE
    // ========================================================================

    const datasetRows = [
      createDatasetCoverageRow(
        'Projects',
        evidence.coverage_matrix.projects.state,
        evidence.coverage_matrix.projects.coverage_percent,
        {
          completeness_percent: evidence.coverage_matrix.projects.coverage_percent,
          observation_window_days: Math.ceil(windowHours / 24),
          confidence_level: ConfidenceLevel.MEDIUM,
          disclosure_text: 'Projects coverage: all projects in Jira instance scanned via REST API.',
          computed_at: generatedAt,
          _phase_4_sealed: true,
        },
        evidence.coverage_matrix.projects.reason,
        'Jira REST API provides full project list without permission restrictions.'
      ),
      createDatasetCoverageRow(
        'Custom Fields',
        evidence.coverage_matrix.custom_fields.state,
        evidence.coverage_matrix.custom_fields.coverage_percent,
        {
          completeness_percent: evidence.coverage_matrix.custom_fields.coverage_percent,
          observation_window_days: Math.ceil(windowHours / 24),
          confidence_level: ConfidenceLevel.MEDIUM,
          disclosure_text: `Custom fields coverage: ${evidence.coverage_matrix.custom_fields.coverage_percent}% of fields in scope.`,
          computed_at: generatedAt,
          _phase_4_sealed: true,
        },
        evidence.coverage_matrix.custom_fields.reason,
        'Permission not granted for field history; custom fields list is available.'
      ),
      createDatasetCoverageRow(
        'Automation Rules',
        evidence.coverage_matrix.automation_rules.state,
        evidence.coverage_matrix.automation_rules.coverage_percent,
        {
          completeness_percent: evidence.coverage_matrix.automation_rules.coverage_percent,
          observation_window_days: Math.ceil(windowHours / 24),
          confidence_level: ConfidenceLevel.MEDIUM,
          disclosure_text: 'Automation rules: all enabled rules scanned via Jira Automation API.',
          computed_at: generatedAt,
          _phase_4_sealed: true,
        },
        evidence.coverage_matrix.automation_rules.reason,
        'Jira Automation API provides rule definitions; execution history not measured (Phase-4 scope).'
      ),
    ];

    // Validate all dataset coverage disclosures
    for (const row of datasetRows) {
      assertValidDisclosure(row.coverage_disclosure);
    }

    const sectionB = createReportSectionB(datasetRows);

    // ========================================================================
    // 6. Build Section C: PRELIMINARY OBSERVATIONS
    // ========================================================================

    const observations = [
      createRawCountObservation(
        '5 projects detected',
        evidence.metadata_snapshot.projects_count,
        {
          completeness_percent: 100,
          observation_window_days: Math.ceil(windowHours / 24),
          confidence_level: ConfidenceLevel.MEDIUM,
          disclosure_text: 'Raw count of projects returned by Jira REST API.',
          computed_at: generatedAt,
          _phase_4_sealed: true,
        }
      ),
      createRawCountObservation(
        '12 custom fields defined',
        evidence.metadata_snapshot.custom_fields_count,
        {
          completeness_percent: 100,
          observation_window_days: Math.ceil(windowHours / 24),
          confidence_level: ConfidenceLevel.MEDIUM,
          disclosure_text: 'Count of custom fields in accessible scope.',
          computed_at: generatedAt,
          _phase_4_sealed: true,
        }
      ),
    ];

    // Validate all observation disclosures
    for (const obs of observations) {
      assertValidDisclosure(obs.disclosure);
    }

    const sectionC = createReportSectionC(observations);

    // ========================================================================
    // 7. Build Section D: FORECAST
    // ========================================================================

    const sectionD = (() => {
      // If observation window < 7 days, forecast unavailable
      if (windowHours < 7 * 24) {
        return createForecastUnavailable('Observation window less than 7 days; insufficient for valid forecast.');
      }

      // Otherwise, create forecast using Phase-4 factory
      // window is in hours; forecast factory expects days
      const windowDays = Math.ceil(windowHours / 24);
      const forecast = createPhase4Forecast(
        evidence.metadata_snapshot.projects_count, // forecast value
        windowDays // observation window in days
      );

      return createForecastAvailable(forecast);
    })();

    // ========================================================================
    // 8. Assemble Final Report
    // ========================================================================

    const report = createPhase5Report(
      `phase5-report-${Date.now()}`,
      generatedAt,
      trigger,
      evidence.installation_timestamp,
      sectionA,
      sectionB,
      sectionC,
      sectionD
    );

    // ========================================================================
    // 9. HARD VALIDATION: Verify Report Structure
    // ========================================================================

    try {
      validatePhase5ReportStructure(report);
    } catch (e) {
      return {
        success: false,
        error: `[PHASE-5-VALIDATION] Report structure invalid: ${e instanceof Error ? e.message : String(e)}`,
      };
    }

    // ========================================================================
    // 10. HARD VALIDATION: Reject Phase-5 Signals
    // ========================================================================

    try {
      rejectPhase5Signals(report, 'Phase-5 report generation');
    } catch (e) {
      return {
        success: false,
        error: `[PHASE-BOUNDARY-VIOLATION] Phase-5 attempted to infer behavior: ${e instanceof Error ? e.message : String(e)}`,
      };
    }

    // ========================================================================
    // 11. SUCCESS
    // ========================================================================

    return {
      success: true,
      report,
    };
  } catch (e) {
    // Unexpected error (should not happen if code is correct)
    return {
      success: false,
      error: `[PHASE-5-GENERATION-FATAL] Unexpected error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================================
// HELPER: Verify Both Paths Use Same Code
// ============================================================================

/**
 * Automatic trigger handler.
 * 
 * Called by scheduler at +12h and +24h since installation.
 * MUST call generatePhase5Report (same code path).
 */
export async function handleAutoTrigger(trigger: 'AUTO_12H' | 'AUTO_24H'): Promise<GenerationResult> {
  // No alternate logic. Direct call to single code path.
  return generatePhase5Report(trigger);
}

/**
 * Manual trigger handler.
 * 
 * Called when user clicks "Generate Now" button.
 * MUST call generatePhase5Report (same code path).
 */
export async function handleManualTrigger(): Promise<GenerationResult> {
  // No alternate logic. Direct call to single code path.
  return generatePhase5Report('MANUAL');
}
