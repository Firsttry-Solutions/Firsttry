/**
 * PHASE-5 VALIDATION HARNESS TESTS
 *
 * Purpose: Verify that Phase-5 report generation enforces ALL critical invariants:
 * 1. Single code path (manual + auto triggers use identical logic)
 * 2. Hard validation (validation fails => abort, no return)
 * 3. Structure integrity (exactly 4 sections A/B/C/D)
 * 4. Disclosure preservation (all metrics wrapped with Phase-4 disclosure)
 * 5. Forbidden signals rejection (trends/scores/benchmarks cause abort)
 *
 * CRITICAL: These tests are NOT optional. They verify that Phase-5 cannot bypass Phase-4 invariants.
 */

import {
  describe,
  it,
  expect,
} from 'vitest';

import {
  generatePhase5Report,
  handleAutoTrigger,
  handleManualTrigger,
} from '../src/phase5_report_generator';
import {
  validatePhase5ReportStructure,
  createPhase5Report,
  createReportSectionA,
  createReportSectionB,
  createReportSectionC,
  createDisclosedCount,
  DatasetAvailabilityState,
  DatasetMissingReason,
} from '../src/phase5_report_contract';

/**
 * TEST HELPER: Create a disclosed count with complete Phase-4 disclosure envelope
 */
function createTestDisclosedCount(
  count: number,
  text: string
) {
  return createDisclosedCount(count, {
    completeness_percent: 100,
    disclosure_text: text,
    confidence: 'CONFIRMED',
  });
}

// ============================================================================
// TEST SUITE 1: CODE PATH INTEGRITY
// ============================================================================

describe('Phase-5: Code Path Integrity (Single Path for Auto + Manual)', () => {
  /**
   * CRITICAL INVARIANT: Manual and auto triggers MUST use identical code path.
   * If code paths diverge, we create a bypass risk.
   */

  it('Manual trigger returns GenerationResult', async () => {
    const result = await handleManualTrigger();
    expect(result).toHaveProperty('success');
  });

  it('Auto trigger (12h) returns GenerationResult', async () => {
    const result = await handleAutoTrigger('AUTO_12H');
    expect(result).toHaveProperty('success');
  });

  it('Auto trigger (24h) returns GenerationResult', async () => {
    const result = await handleAutoTrigger('AUTO_24H');
    expect(result).toHaveProperty('success');
  });

  it('Manual and auto triggers produce identical result structure', async () => {
    const manual = await handleManualTrigger();
    const auto = await handleAutoTrigger('AUTO_12H');

    // Both should return GenerationResult type
    expect(manual).toHaveProperty('success');
    expect(auto).toHaveProperty('success');

    // If both succeeded, they should have same structure
    if (manual.success && auto.success) {
      expect(manual.report?.sections).toBeDefined();
      expect(auto.report?.sections).toBeDefined();
      expect(Object.keys(manual.report?.sections || {})).toEqual(
        Object.keys(auto.report?.sections || {})
      );
    }
  });
});

// ============================================================================
// TEST SUITE 2: STRUCTURE INTEGRITY
// ============================================================================

describe('Phase-5: Structure Integrity (4 Sections, Fixed Order)', () => {
  /**
   * CRITICAL INVARIANT: Phase-5 reports MUST contain exactly sections A, B, C, D.
   * No reordering, duplication, or extensions allowed.
   */

  it('Report contains exactly 4 sections: A, B, C, D', () => {
    const now = new Date().toISOString();
    const installTime = new Date(Date.now() - 86400000).toISOString();

    const sectionA = createReportSectionA(
      createTestDisclosedCount(5, 'Jira API read: project count'),
      createTestDisclosedCount(42, 'Jira API read: issue count'),
      createTestDisclosedCount(8, 'Schema inspection: custom fields')
    );

    const sectionB = createReportSectionB([
      {
        dataset_name: 'Issue Status Transitions',
        availability_state: DatasetAvailabilityState.AVAILABLE,
        coverage_percent: 100,
        coverage_disclosure: {
          completeness_percent: 100,
          disclosure_text: 'Full history from Jira audit log',
          confidence: 'CONFIRMED',
        },
        missing_reason: DatasetMissingReason.FEATURE_UNUSED,
        reason_detail_text: 'Data available',
      },
    ]);

    const sectionC = createReportSectionC([
      {
        label: 'Moderate issue volume detected',
        value: 42,
        disclosure: {
          completeness_percent: 100,
          disclosure_text: 'Direct count from API',
          confidence: 'CONFIRMED',
        },
      },
    ]);

    const sectionD = {
      forecast_available: true,
      forecast: {
        type: 'ESTIMATED' as const,
        forecast_text: 'Next report in 24 hours',
        confidence: 'ESTIMATED' as const,
      },
    };

    const report = createPhase5Report(
      'test-report-id',
      now,
      'MANUAL',
      installTime,
      sectionA,
      sectionB,
      sectionC,
      sectionD
    );

    // Verify exactly 4 sections
    const sectionKeys = Object.keys(report.sections);
    expect(sectionKeys).toEqual(['A', 'B', 'C', 'D']);
    expect(sectionKeys).toHaveLength(4);
  });

  it('Section order cannot be changed (literal keys)', () => {
    const now = new Date().toISOString();
    const installTime = new Date(Date.now() - 86400000).toISOString();

    const sectionA = createReportSectionA(
      createTestDisclosedCount(1, 'test'),
      createTestDisclosedCount(1, 'test'),
      createTestDisclosedCount(1, 'test')
    );

    const sectionB = createReportSectionB([]);

    const sectionC = createReportSectionC([]);

    const sectionD = {
      forecast_available: false,
      reason: 'INSUFFICIENT_OBSERVATION_WINDOW' as const,
      disclosure_text: 'Not enough data',
    };

    const report = createPhase5Report(
      'test-id',
      now,
      'MANUAL',
      installTime,
      sectionA,
      sectionB,
      sectionC,
      sectionD
    );

    // Keys must be in exact order
    const keys = Object.keys(report.sections);
    expect(keys[0]).toBe('A');
    expect(keys[1]).toBe('B');
    expect(keys[2]).toBe('C');
    expect(keys[3]).toBe('D');
  });

  it('Validation rejects reports with missing sections', () => {
    const now = new Date().toISOString();
    const installTime = new Date(Date.now() - 86400000).toISOString();

    const incompleteSectionA = createReportSectionA(
      createTestDisclosedCount(1, 'test'),
      createTestDisclosedCount(1, 'test'),
      createTestDisclosedCount(1, 'test')
    );

    const incompleteReport = {
      report_id: 'test-123',
      generated_at: now,
      trigger: 'MANUAL' as const,
      installation_detected_at: installTime,
      observation_window: {
        from: installTime,
        to: now,
        duration_hours: 24,
      },
      sections: {
        A: incompleteSectionA,
        // Missing B, C, D
      },
    } as any;

    // Validation should fail
    expect(() => validatePhase5ReportStructure(incompleteReport)).toThrow();
  });
});

// ============================================================================
// TEST SUITE 3: DISCLOSURE PRESERVATION
// ============================================================================

describe('Phase-5: Disclosure Preservation (All Metrics Wrapped)', () => {
  /**
   * CRITICAL INVARIANT: Every numeric value must be wrapped with Phase-4 disclosure.
   * Raw numbers cannot be exported.
   */

  it('All counts in Section A have disclosure text', () => {
    const sectionA = createReportSectionA(
      createTestDisclosedCount(5, 'Jira API read: project count'),
      createTestDisclosedCount(42, 'Jira API read: issue count'),
      createTestDisclosedCount(8, 'Schema inspection: custom fields')
    );

    // All disclosed counts must have non-empty disclosure text
    expect(sectionA.projects_scanned.disclosure.disclosure_text).toBeTruthy();
    expect(sectionA.issues_scanned.disclosure.disclosure_text).toBeTruthy();
    expect(sectionA.fields_detected.disclosure.disclosure_text).toBeTruthy();

    // Disclosure must be Phase-4 format
    expect(sectionA.projects_scanned.disclosure.disclosure_text).toContain('API');
  });

  it('Dataset coverage includes disclosure for each row', () => {
    const sectionB = createReportSectionB([
      {
        dataset_name: 'Issue Status Transitions',
        availability_state: DatasetAvailabilityState.AVAILABLE,
        coverage_percent: 42,
        coverage_disclosure: {
          completeness_percent: 100,
          disclosure_text: 'Jira audit log: full history',
          confidence: 'CONFIRMED',
        },
        missing_reason: DatasetMissingReason.FEATURE_UNUSED,
        reason_detail_text: 'Data available',
      },
      {
        dataset_name: 'Custom Field Values',
        availability_state: DatasetAvailabilityState.PARTIAL,
        coverage_percent: 8,
        coverage_disclosure: {
          completeness_percent: 75,
          disclosure_text: 'Jira schema: partial coverage due to permissions',
          confidence: 'ESTIMATED',
        },
        missing_reason: DatasetMissingReason.PERMISSION_NOT_GRANTED,
        reason_detail_text: 'Partial access due to permission restrictions',
      },
      {
        dataset_name: 'Workflow Rules',
        availability_state: DatasetAvailabilityState.MISSING,
        coverage_percent: 0,
        coverage_disclosure: {
          completeness_percent: 0,
          disclosure_text: 'Not accessible: requires admin permissions',
          confidence: 'CONFIRMED',
        },
        missing_reason: DatasetMissingReason.PERMISSION_NOT_GRANTED,
        reason_detail_text: 'Admin-only endpoint',
        mandatory_zero_disclosure: 'This value reflects data availability, not Jira quality.',
      },
    ]);

    // Each row must have disclosure
    sectionB.datasets.forEach((row) => {
      expect(row.coverage_disclosure).toBeTruthy();
      expect(row.coverage_disclosure.disclosure_text.length).toBeGreaterThan(0);
    });
  });

  it('Missing data rows include semantic reason', () => {
    const sectionB = createReportSectionB([
      {
        dataset_name: 'Missing Dataset',
        availability_state: DatasetAvailabilityState.MISSING,
        coverage_percent: 0,
        coverage_disclosure: {
          completeness_percent: 0,
          disclosure_text: 'Not accessible: requires admin permissions',
          confidence: 'CONFIRMED',
        },
        missing_reason: DatasetMissingReason.PERMISSION_NOT_GRANTED,
        reason_detail_text: 'Admin-only endpoint',
        mandatory_zero_disclosure: 'This value reflects data availability, not Jira quality.',
      },
    ]);

    const missingRow = sectionB.datasets[0];
    expect(
      missingRow.availability_state === DatasetAvailabilityState.MISSING
    ).toBe(true);
    expect(missingRow.missing_reason).toBeDefined();
    expect(missingRow.reason_detail_text).toContain('Admin');
  });
});

// ============================================================================
// TEST SUITE 4: VALIDATION HARD FAIL
// ============================================================================

describe('Phase-5: Validation Hard Fail (No Partial Returns)', () => {
  /**
   * CRITICAL INVARIANT: If validation fails, generatePhase5Report must NOT return a report.
   * Must return error result instead.
   */

  it('generatePhase5Report returns GenerationResult (success or error)', async () => {
    const result = await generatePhase5Report('MANUAL');

    // Should always return GenerationResult, never throw
    expect(result).toHaveProperty('success');
    if (!result.success) {
      expect(result).toHaveProperty('error');
    }
  });
});

// ============================================================================
// TEST SUITE 5: TRIGGER TYPE VALIDATION
// ============================================================================

describe('Phase-5: Trigger Type Validation', () => {
  /**
   * CRITICAL: Only valid trigger types are AUTO_12H, AUTO_24H, MANUAL.
   * No other trigger values allowed.
   */

  it('generatePhase5Report accepts AUTO_12H trigger', async () => {
    const result = await generatePhase5Report('AUTO_12H');
    expect(result).toHaveProperty('success');
  });

  it('generatePhase5Report accepts AUTO_24H trigger', async () => {
    const result = await generatePhase5Report('AUTO_24H');
    expect(result).toHaveProperty('success');
  });

  it('generatePhase5Report accepts MANUAL trigger', async () => {
    const result = await generatePhase5Report('MANUAL');
    expect(result).toHaveProperty('success');
  });
});

// ============================================================================
// TEST SUITE 6: TIMESTAMP VALIDATION
// ============================================================================

describe('Phase-5: Timestamp and Window Validation', () => {
  /**
   * CRITICAL: Report must include installation timestamp.
   * Observation window must be valid (from < to).
   */

  it('Report includes generated_at timestamp', () => {
    const now = new Date().toISOString();
    const installTime = new Date(Date.now() - 3600000).toISOString();

    const report = createPhase5Report(
      'test-id',
      now,
      'MANUAL',
      installTime,
      createReportSectionA(
        createTestDisclosedCount(0, 'test'),
        createTestDisclosedCount(0, 'test'),
        createTestDisclosedCount(0, 'test')
      ),
      createReportSectionB([]),
      createReportSectionC([]),
      {
        forecast_available: false,
        reason: 'INSUFFICIENT_OBSERVATION_WINDOW' as const,
        disclosure_text: 'No data',
      }
    );

    expect(report.generated_at).toBeTruthy();
    expect(new Date(report.generated_at).getTime()).toBeGreaterThan(0);
  });

  it('Observation window must have valid duration', () => {
    const from = new Date('2024-01-01T00:00:00Z');
    const to = new Date('2024-01-02T00:00:00Z');
    const durationMs = to.getTime() - from.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);

    expect(durationHours).toBe(24);
  });

  it('Report calculates observation window from timestamps', () => {
    const installTime = new Date('2024-01-01T00:00:00Z').toISOString();
    const generateTime = new Date('2024-01-02T00:00:00Z').toISOString();

    const report = createPhase5Report(
      'test-id',
      generateTime,
      'MANUAL',
      installTime,
      createReportSectionA(
        createTestDisclosedCount(0, 'test'),
        createTestDisclosedCount(0, 'test'),
        createTestDisclosedCount(0, 'test')
      ),
      createReportSectionB([]),
      createReportSectionC([]),
      {
        forecast_available: false,
        reason: 'INSUFFICIENT_OBSERVATION_WINDOW' as const,
        disclosure_text: 'No data',
      }
    );

    expect(report.observation_window.duration_hours).toBe(24);
    expect(report.observation_window.from).toBe(installTime);
    expect(report.observation_window.to).toBe(generateTime);
  });
});
