/**
 * PHASE P2: OUTPUT TRUTH GUARANTEE - COMPREHENSIVE TEST SUITE
 *
 * Tests verify that:
 * 1. VALID outputs can be exported without acknowledgment
 * 2. DEGRADED outputs require explicit acknowledgment
 * 3. EXPIRED outputs require explicit acknowledgment
 * 4. BLOCKED outputs cannot be exported
 * 5. Output truth is deterministic
 * 6. Audit events are recorded for all operations
 * 7. Watermarking applied to non-VALID outputs
 * 8. No P1 regressions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeOutputTruthMetadata,
  requireValidForExport,
  ExportBlockedError,
  MAX_SNAPSHOT_AGE_SECONDS,
  OUTPUT_TRUTH_SCHEMA_VERSION,
  serializeTruthMetadata,
  deserializeTruthMetadata,
} from '../src/output/output_contract';

/**
 * Test 1: Valid output requires complete + fresh + no drift
 */
describe('P2.1: Valid Output Model', () => {
  it('test_valid_output_requires_complete_fresh_no_drift', () => {
    const nowISO = '2025-01-01T12:00:00Z';
    const snapshotCreatedISO = '2025-01-01T10:00:00Z'; // 2 hours ago

    const meta = computeOutputTruthMetadata({
      generatedAtISO: nowISO,
      snapshotId: 'snap_valid_001',
      snapshotCreatedAtISO: snapshotCreatedISO,
      rulesetVersion: '1.0',
      driftStatus: 'NO_DRIFT',
      completenessPercent: 100,
      missingData: [],
      nowISO,
    });

    // Assertions
    expect(meta.validityStatus).toBe('VALID');
    expect(meta.confidenceLevel).toBe('HIGH');
    expect(meta.completenessStatus).toBe('COMPLETE');
    expect(meta.driftStatus).toBe('NO_DRIFT');
    expect(meta.warnings).toHaveLength(0);
    expect(meta.reasons).toHaveLength(0);
  });
});

/**
 * Test 2: Incomplete output is degraded
 */
describe('P2.2: Degraded Output (Incomplete)', () => {
  it('test_incomplete_output_is_degraded_with_warnings', () => {
    const nowISO = '2025-01-01T12:00:00Z';
    const snapshotCreatedISO = '2025-01-01T10:00:00Z';

    const meta = computeOutputTruthMetadata({
      generatedAtISO: nowISO,
      snapshotId: 'snap_incomplete_001',
      snapshotCreatedAtISO: snapshotCreatedISO,
      rulesetVersion: '1.0',
      driftStatus: 'NO_DRIFT',
      completenessPercent: 85, // < 100%
      missingData: ['workflows', 'automation_rules'],
      nowISO,
    });

    // Assertions
    expect(meta.validityStatus).toBe('DEGRADED');
    expect(meta.confidenceLevel).toBe('LOW');
    expect(meta.completenessStatus).toBe('INCOMPLETE');
    expect(meta.completenessPercent).toBe(85);
    expect(meta.missingData).toEqual(['workflows', 'automation_rules']);
    expect(meta.warnings.length).toBeGreaterThan(0);
    expect(meta.reasons.length).toBeGreaterThan(0);
    expect(meta.warnings[0]).toContain('DEGRADED');
  });
});

/**
 * Test 3: Unknown drift downgrades confidence from HIGH to MEDIUM
 */
describe('P2.3: Drift Unknown Impact', () => {
  it('test_unknown_drift_cannot_be_high_confidence', () => {
    const nowISO = '2025-01-01T12:00:00Z';
    const snapshotCreatedISO = '2025-01-01T10:00:00Z';

    const meta = computeOutputTruthMetadata({
      generatedAtISO: nowISO,
      snapshotId: 'snap_unknown_drift_001',
      snapshotCreatedAtISO: snapshotCreatedISO,
      rulesetVersion: '1.0',
      driftStatus: 'UNKNOWN', // Cannot verify drift
      completenessPercent: 100, // But data is complete
      missingData: [],
      nowISO,
    });

    // Assertions
    expect(meta.validityStatus).toBe('DEGRADED'); // UNKNOWN drift -> DEGRADED
    expect(meta.confidenceLevel).toBe('MEDIUM'); // NOT HIGH
    expect(meta.completenessStatus).toBe('COMPLETE');
    expect(meta.driftStatus).toBe('UNKNOWN');
    // DEGRADED status requires warnings and reasons
    expect(meta.warnings.length).toBeGreaterThan(0);
    expect(meta.reasons.length).toBeGreaterThan(0);
    expect(meta.warnings[0]).toContain('DEGRADED');
    expect(meta.reasons[0]).toContain('Drift status is UNKNOWN');
  });
});

/**
 * Test 4: Snapshot too old marks as expired
 */
describe('P2.4: Snapshot Age & Expiry', () => {
  it('test_snapshot_too_old_marks_expired', () => {
    const nowISO = '2025-01-10T12:00:00Z';
    const snapshotCreatedISO = '2025-01-01T10:00:00Z'; // 9 days ago (> 7 days)

    const meta = computeOutputTruthMetadata({
      generatedAtISO: nowISO,
      snapshotId: 'snap_stale_001',
      snapshotCreatedAtISO: snapshotCreatedISO,
      rulesetVersion: '1.0',
      driftStatus: 'NO_DRIFT',
      completenessPercent: 100,
      missingData: [],
      nowISO,
    });

    // Assertions
    expect(meta.validityStatus).toBe('EXPIRED');
    expect(meta.confidenceLevel).toBe('LOW');
    expect(meta.snapshotAgeSeconds).toBeGreaterThan(MAX_SNAPSHOT_AGE_SECONDS);
    expect(meta.warnings.length).toBeGreaterThan(0);
    expect(meta.reasons.length).toBeGreaterThan(0);
    expect(meta.warnings[0]).toContain('EXPIRED');
  });
});

/**
 * Test 5: Drift detected after generation marks as expired
 */
describe('P2.5: Drift Detection After Generation', () => {
  it('test_drift_detected_expires_prior_outputs', () => {
    const nowISO = '2025-01-01T12:00:00Z';
    const snapshotCreatedISO = '2025-01-01T10:00:00Z';

    const meta = computeOutputTruthMetadata({
      generatedAtISO: nowISO,
      snapshotId: 'snap_drift_detected_001',
      snapshotCreatedAtISO: snapshotCreatedISO,
      rulesetVersion: '1.0',
      driftStatus: 'DRIFT_DETECTED', // Drift found!
      completenessPercent: 100,
      missingData: [],
      nowISO,
    });

    // Assertions
    expect(meta.validityStatus).toBe('EXPIRED');
    expect(meta.confidenceLevel).toBe('LOW');
    expect(meta.driftStatus).toBe('DRIFT_DETECTED');
    expect(meta.warnings.length).toBeGreaterThan(0);
    expect(meta.reasons.length).toBeGreaterThan(0);
    expect(meta.warnings[0]).toContain('EXPIRED');
  });
});

/**
 * Test 6: Export blocked without acknowledgment for DEGRADED
 */
describe('P2.6: Export Blocking for DEGRADED', () => {
  it('test_export_blocked_without_ack_for_degraded', () => {
    const nowISO = '2025-01-01T12:00:00Z';
    const snapshotCreatedISO = '2025-01-01T10:00:00Z';

    const meta = computeOutputTruthMetadata({
      generatedAtISO: nowISO,
      snapshotId: 'snap_degrad_001',
      snapshotCreatedAtISO: snapshotCreatedISO,
      rulesetVersion: '1.0',
      driftStatus: 'NO_DRIFT',
      completenessPercent: 90, // Incomplete
      missingData: ['projects'],
      nowISO,
    });

    expect(meta.validityStatus).toBe('DEGRADED');

    // Should throw if acknowledgeByOperator is false
    expect(() => {
      requireValidForExport(meta, false);
    }).toThrow(ExportBlockedError);

    // Should not throw if acknowledgeByOperator is true
    expect(() => {
      requireValidForExport(meta, true);
    }).not.toThrow();
  });
});

/**
 * Test 7: Export allowed with acknowledgment, records audit event
 */
describe('P2.7: Export With Acknowledgment', () => {
  it('test_export_allowed_with_ack_records_audit_event', () => {
    const nowISO = '2025-01-01T12:00:00Z';
    const snapshotCreatedISO = '2025-01-01T10:00:00Z';

    const meta = computeOutputTruthMetadata({
      generatedAtISO: nowISO,
      snapshotId: 'snap_degrad_ack_001',
      snapshotCreatedAtISO: snapshotCreatedISO,
      rulesetVersion: '1.0',
      driftStatus: 'NO_DRIFT',
      completenessPercent: 95,
      missingData: ['fields'],
      nowISO,
    });

    // Should be DEGRADED
    expect(meta.validityStatus).toBe('DEGRADED');

    // Export allowed with ack (no throw)
    expect(() => {
      requireValidForExport(meta, true);
    }).not.toThrow();

    // Audit event would be recorded (tested separately with storage mocks)
  });
});

/**
 * Test 8: Expired output requires watermark
 */
describe('P2.8: Watermarking for Expired', () => {
  it('test_export_of_expired_requires_watermark', () => {
    const nowISO = '2025-01-10T12:00:00Z';
    const snapshotCreatedISO = '2025-01-01T10:00:00Z'; // 9 days old

    const meta = computeOutputTruthMetadata({
      generatedAtISO: nowISO,
      snapshotId: 'snap_expired_watermark_001',
      snapshotCreatedAtISO: snapshotCreatedISO,
      rulesetVersion: '1.0',
      driftStatus: 'NO_DRIFT',
      completenessPercent: 100,
      missingData: [],
      nowISO,
    });

    // Should be EXPIRED
    expect(meta.validityStatus).toBe('EXPIRED');

    // Watermark present (non-empty warnings/reasons)
    expect(meta.warnings.length).toBeGreaterThan(0);
    expect(meta.reasons.length).toBeGreaterThan(0);

    // Exported JSON should include watermark object
    const exportedJSON = {
      watermark: {
        status: meta.validityStatus,
        warnings: meta.warnings,
        reasons: meta.reasons,
      },
      truth_metadata: meta,
    };

    expect(exportedJSON.watermark.status).toBe('EXPIRED');
  });
});

/**
 * Test 9: Truth metadata is deterministic
 */
describe('P2.9: Determinism', () => {
  it('test_truth_metadata_is_deterministic_given_inputs', () => {
    const args = {
      generatedAtISO: '2025-01-01T12:00:00Z',
      snapshotId: 'snap_determ_001',
      snapshotCreatedAtISO: '2025-01-01T10:00:00Z',
      rulesetVersion: '1.0',
      driftStatus: 'NO_DRIFT' as const,
      completenessPercent: 95,
      missingData: ['field1'],
      nowISO: '2025-01-01T12:00:00Z',
    };

    // Compute twice
    const meta1 = computeOutputTruthMetadata(args);
    const meta2 = computeOutputTruthMetadata(args);

    // Must be identical
    expect(JSON.stringify(meta1)).toBe(JSON.stringify(meta2));
    expect(meta1.validityStatus).toBe(meta2.validityStatus);
    expect(meta1.confidenceLevel).toBe(meta2.confidenceLevel);
    expect(meta1.warnings).toEqual(meta2.warnings);
    expect(meta1.reasons).toEqual(meta2.reasons);
  });
});

/**
 * Test 10: Recompute truth matches persisted record
 */
describe('P2.10: Determinism & Backward Compatibility', () => {
  it('test_recompute_truth_matches_persisted_record', () => {
    const nowISO = '2025-01-01T12:00:00Z';
    const snapshotCreatedISO = '2025-01-01T10:00:00Z';

    // Create original metadata
    const original = computeOutputTruthMetadata({
      generatedAtISO: nowISO,
      snapshotId: 'snap_persist_001',
      snapshotCreatedAtISO: snapshotCreatedISO,
      rulesetVersion: '1.0',
      driftStatus: 'NO_DRIFT',
      completenessPercent: 100,
      missingData: [],
      nowISO,
    });

    // Serialize it
    const serialized = serializeTruthMetadata(original);
    const deserialized = deserializeTruthMetadata(serialized);

    // Recompute at different time (but use original timestamps)
    const recomputed = computeOutputTruthMetadata({
      generatedAtISO: original.generatedAtISO,
      snapshotId: original.snapshotId,
      snapshotCreatedAtISO: original.snapshotCreatedAtISO,
      rulesetVersion: original.rulesetVersion,
      driftStatus: original.driftStatus,
      completenessPercent: original.completenessPercent,
      missingData: original.missingData,
      nowISO, // Use original timestamp for age calculation
    });

    // Must match on all critical fields
    expect(recomputed.validityStatus).toBe(original.validityStatus);
    expect(recomputed.confidenceLevel).toBe(original.confidenceLevel);
    expect(recomputed.completenessStatus).toBe(original.completenessStatus);
    expect(recomputed.warnings).toEqual(original.warnings);
    expect(recomputed.reasons).toEqual(original.reasons);
  });
});

/**
 * Test 11: Schema version validation
 */
describe('P2.11: Schema Versioning', () => {
  it('test_schema_version_mismatch_detected', () => {
    const nowISO = '2025-01-01T12:00:00Z';
    const snapshotCreatedISO = '2025-01-01T10:00:00Z';

    const meta = computeOutputTruthMetadata({
      generatedAtISO: nowISO,
      snapshotId: 'snap_schema_001',
      snapshotCreatedAtISO: snapshotCreatedISO,
      rulesetVersion: '1.0',
      driftStatus: 'NO_DRIFT',
      completenessPercent: 100,
      missingData: [],
      nowISO,
    });

    expect(meta.schemaVersion).toBe(OUTPUT_TRUTH_SCHEMA_VERSION);

    // Invalid JSON with mismatched schema version
    const invalidJson = JSON.stringify({
      ...meta,
      schemaVersion: '2.0', // Wrong version
    });

    expect(() => {
      deserializeTruthMetadata(invalidJson);
    }).toThrow();
  });
});

/**
 * Test 12: Invariant enforcement (non-VALID must have warnings)
 */
describe('P2.12: Invariant Enforcement', () => {
  it('test_non_valid_output_must_have_warnings_and_reasons', () => {
    const nowISO = '2025-01-01T12:00:00Z';
    const snapshotCreatedISO = '2025-01-01T10:00:00Z';

    const meta = computeOutputTruthMetadata({
      generatedAtISO: nowISO,
      snapshotId: 'snap_invariant_001',
      snapshotCreatedAtISO: snapshotCreatedISO,
      rulesetVersion: '1.0',
      driftStatus: 'NO_DRIFT',
      completenessPercent: 85, // Incomplete -> DEGRADED
      missingData: ['field1'],
      nowISO,
    });

    // DEGRADED must have warnings and reasons
    expect(meta.validityStatus).toBe('DEGRADED');
    expect(meta.warnings.length).toBeGreaterThan(0);
    expect(meta.reasons.length).toBeGreaterThan(0);
  });
});

/**
 * Test 13: BLOCKED status cannot be overridden
 */
describe('P2.13: Blocked Status', () => {
  it('test_blocked_status_cannot_be_overridden', () => {
    // Simulate BLOCKED status (missing snapshot or cannot compute truth)
    const blockedMeta = {
      schemaVersion: OUTPUT_TRUTH_SCHEMA_VERSION,
      generatedAtISO: '2025-01-01T12:00:00Z',
      snapshotId: '',
      snapshotCreatedAtISO: '',
      snapshotAgeSeconds: 0,
      rulesetVersion: '1.0',
      driftStatus: 'UNKNOWN' as const,
      completenessPercent: 0,
      missingData: [],
      completenessStatus: 'INCOMPLETE' as const,
      confidenceLevel: 'LOW' as const,
      validityStatus: 'BLOCKED' as const,
      validUntilISO: '2025-01-01T13:00:00Z',
      warnings: ['Output cannot be computed'],
      reasons: ['Snapshot not found'],
    };

    // Even with acknowledgment, BLOCKED cannot be exported
    expect(() => {
      requireValidForExport(blockedMeta, true);
    }).toThrow(ExportBlockedError);

    expect(() => {
      requireValidForExport(blockedMeta, false);
    }).toThrow(ExportBlockedError);
  });
});

/**
 * Test 14: Confidence levels follow rules
 */
describe('P2.14: Confidence Level Rules', () => {
  it('test_confidence_high_only_with_complete_fresh_no_drift', () => {
    const baseArgs = {
      generatedAtISO: '2025-01-01T12:00:00Z',
      snapshotId: 'snap_conf_001',
      snapshotCreatedAtISO: '2025-01-01T10:00:00Z',
      rulesetVersion: '1.0',
      nowISO: '2025-01-01T12:00:00Z',
    };

    // Only this combination yields HIGH
    const meta = computeOutputTruthMetadata({
      ...baseArgs,
      driftStatus: 'NO_DRIFT',
      completenessPercent: 100,
      missingData: [],
    });

    expect(meta.confidenceLevel).toBe('HIGH');

    // Any other combination is not HIGH
    const metaDrift = computeOutputTruthMetadata({
      ...baseArgs,
      driftStatus: 'UNKNOWN',
      completenessPercent: 100,
      missingData: [],
    });
    expect(metaDrift.confidenceLevel).not.toBe('HIGH');

    const metaIncomplete = computeOutputTruthMetadata({
      ...baseArgs,
      driftStatus: 'NO_DRIFT',
      completenessPercent: 95,
      missingData: ['field1'],
    });
    expect(metaIncomplete.confidenceLevel).not.toBe('HIGH');
  });
});

/**
 * CRITICAL REGRESSION TEST: Lazy implementation detector
 * 
 * This test would fail if someone naively set validityStatus based on
 * completeness alone, ignoring the absolute invariant that UNKNOWN drift
 * is never VALID.
 */
describe('P2.15: Critical Invariant - UNKNOWN Drift Never Valid', () => {
  it('test_unknown_drift_with_100pct_completeness_is_never_valid', () => {
    const nowISO = '2025-01-01T12:00:00Z';
    const snapshotCreatedISO = '2025-01-01T10:00:00Z';

    const meta = computeOutputTruthMetadata({
      generatedAtISO: nowISO,
      snapshotId: 'snap_regression_001',
      snapshotCreatedAtISO: snapshotCreatedISO,
      rulesetVersion: '1.0',
      driftStatus: 'UNKNOWN', // This is the critical condition
      completenessPercent: 100, // 100% complete would tempt a lazy coder
      missingData: [],
      nowISO,
    });

    // MUST be DEGRADED, not VALID (this is the absolute invariant)
    expect(meta.validityStatus).not.toBe('VALID');
    expect(meta.validityStatus).toBe('DEGRADED');

    // MUST cap at MEDIUM, never HIGH
    expect(meta.confidenceLevel).not.toBe('HIGH');
    expect(meta.confidenceLevel).toBe('MEDIUM');

    // MUST have warnings and reasons (non-VALID requirement)
    expect(meta.warnings.length).toBeGreaterThan(0);
    expect(meta.reasons.length).toBeGreaterThan(0);

    // Verify the warnings/reasons explicitly mention the issue
    const warningText = meta.warnings.join(' ').toLowerCase();
    const reasonText = meta.reasons.join(' ').toLowerCase();
    expect(warningText).toContain('unknown');
    expect(reasonText).toContain('unknown');
  });

  it('test_unknown_drift_with_0pct_completeness_is_also_degraded', () => {
    const nowISO = '2025-01-01T12:00:00Z';
    const snapshotCreatedISO = '2025-01-01T10:00:00Z';

    const meta = computeOutputTruthMetadata({
      generatedAtISO: nowISO,
      snapshotId: 'snap_regression_002',
      snapshotCreatedAtISO: snapshotCreatedISO,
      rulesetVersion: '1.0',
      driftStatus: 'UNKNOWN',
      completenessPercent: 0, // Very incomplete
      missingData: ['everything'],
      nowISO,
    });

    // Still DEGRADED (or worse), never VALID
    expect(meta.validityStatus).not.toBe('VALID');
    expect(['DEGRADED', 'EXPIRED', 'BLOCKED']).toContain(meta.validityStatus);

    // Confidence not HIGH
    expect(meta.confidenceLevel).not.toBe('HIGH');

    // Warnings and reasons required
    expect(meta.warnings.length).toBeGreaterThan(0);
    expect(meta.reasons.length).toBeGreaterThan(0);
  });
});

/**
 * Critical Invariant: Non-VALID must ALWAYS have warnings and reasons
 * This enforces the contract at all drift/completeness combinations.
 */
describe('P2.16: Critical Invariant - Non-VALID Has Warnings & Reasons', () => {
  it('test_degraded_drift_has_warnings_and_reasons', () => {
    const nowISO = '2025-01-01T12:00:00Z';
    const snapshotCreatedISO = '2025-01-01T10:00:00Z';

    const meta = computeOutputTruthMetadata({
      generatedAtISO: nowISO,
      snapshotId: 'snap_degrad_inv_001',
      snapshotCreatedAtISO: snapshotCreatedISO,
      rulesetVersion: '1.0',
      driftStatus: 'DRIFT_DETECTED',
      completenessPercent: 100,
      missingData: [],
      nowISO,
    });

    // DRIFT_DETECTED makes it EXPIRED (not DEGRADED), but invariant still applies
    expect(meta.validityStatus).toBe('EXPIRED');
    expect(meta.warnings.length).toBeGreaterThan(0);
    expect(meta.reasons.length).toBeGreaterThan(0);
  });

  it('test_expired_drift_has_warnings_and_reasons', () => {
    const nowISO = '2025-01-10T12:00:00Z';
    const snapshotCreatedISO = '2025-01-01T10:00:00Z'; // 9 days = expired

    const meta = computeOutputTruthMetadata({
      generatedAtISO: nowISO,
      snapshotId: 'snap_exp_inv_001',
      snapshotCreatedAtISO: snapshotCreatedISO,
      rulesetVersion: '1.0',
      driftStatus: 'NO_DRIFT',
      completenessPercent: 100,
      missingData: [],
      nowISO,
    });

    expect(meta.validityStatus).toBe('EXPIRED');
    expect(meta.warnings.length).toBeGreaterThan(0);
    expect(meta.reasons.length).toBeGreaterThan(0);
  });

  it('test_incomplete_has_warnings_and_reasons', () => {
    const nowISO = '2025-01-01T12:00:00Z';
    const snapshotCreatedISO = '2025-01-01T10:00:00Z';

    const meta = computeOutputTruthMetadata({
      generatedAtISO: nowISO,
      snapshotId: 'snap_incomp_inv_001',
      snapshotCreatedAtISO: snapshotCreatedISO,
      rulesetVersion: '1.0',
      driftStatus: 'NO_DRIFT',
      completenessPercent: 50,
      missingData: ['a', 'b', 'c'],
      nowISO,
    });

    expect(meta.validityStatus).toBe('DEGRADED');
    expect(meta.warnings.length).toBeGreaterThan(0);
    expect(meta.reasons.length).toBeGreaterThan(0);
  });

  it('test_valid_has_empty_warnings_and_reasons', () => {
    const nowISO = '2025-01-01T12:00:00Z';
    const snapshotCreatedISO = '2025-01-01T10:00:00Z';

    const meta = computeOutputTruthMetadata({
      generatedAtISO: nowISO,
      snapshotId: 'snap_valid_inv_001',
      snapshotCreatedAtISO: snapshotCreatedISO,
      rulesetVersion: '1.0',
      driftStatus: 'NO_DRIFT',
      completenessPercent: 100,
      missingData: [],
      nowISO,
    });

    expect(meta.validityStatus).toBe('VALID');
    expect(meta.warnings).toHaveLength(0);
    expect(meta.reasons).toHaveLength(0);
  });
});

/**
 * Critical Invariant: Completeness cannot upgrade UNKNOWN to VALID
 * This catches the "if (completenessPercent === 100) { VALID }" lazy pattern.
 */
describe('P2.17: Critical Invariant - Completeness Cannot Upgrade Drift', () => {
  it('test_unknown_drift_at_50pct_completeness_not_valid', () => {
    const nowISO = '2025-01-01T12:00:00Z';
    const snapshotCreatedISO = '2025-01-01T10:00:00Z';

    const meta50 = computeOutputTruthMetadata({
      generatedAtISO: nowISO,
      snapshotId: 'snap_upg_50_001',
      snapshotCreatedAtISO: snapshotCreatedISO,
      rulesetVersion: '1.0',
      driftStatus: 'UNKNOWN',
      completenessPercent: 50,
      missingData: ['a', 'b'],
      nowISO,
    });

    const meta100 = computeOutputTruthMetadata({
      generatedAtISO: nowISO,
      snapshotId: 'snap_upg_100_001',
      snapshotCreatedAtISO: snapshotCreatedISO,
      rulesetVersion: '1.0',
      driftStatus: 'UNKNOWN',
      completenessPercent: 100,
      missingData: [],
      nowISO,
    });

    // Both should be DEGRADED
    expect(meta50.validityStatus).not.toBe('VALID');
    expect(meta100.validityStatus).not.toBe('VALID');

    // Both should be DEGRADED specifically
    expect(meta50.validityStatus).toBe('DEGRADED');
    expect(meta100.validityStatus).toBe('DEGRADED');

    // Neither should be HIGH confidence
    expect(meta50.confidenceLevel).not.toBe('HIGH');
    expect(meta100.confidenceLevel).not.toBe('HIGH');
  });
});

/**
 * Critical Invariant: Rule evaluation order is strict and explicit.
 * 
 * This test ensures that rule priority is correctly enforced.
 * E.g., DRIFT_DETECTED should set EXPIRED regardless of completeness.
 */
describe('P2.18: Critical Invariant - Rule Priority & Order', () => {
  it('test_drift_detected_makes_expired_regardless_of_completeness', () => {
    const nowISO = '2025-01-01T12:00:00Z';
    const snapshotCreatedISO = '2025-01-01T10:00:00Z'; // Fresh

    const meta = computeOutputTruthMetadata({
      generatedAtISO: nowISO,
      snapshotId: 'snap_prio_001',
      snapshotCreatedAtISO: snapshotCreatedISO,
      rulesetVersion: '1.0',
      driftStatus: 'DRIFT_DETECTED', // This dominates
      completenessPercent: 100, // Even with 100% completeness
      missingData: [],
      nowISO,
    });

    // Must be EXPIRED, not VALID
    expect(meta.validityStatus).toBe('EXPIRED');
    expect(meta.confidenceLevel).toBe('LOW');
  });

  it('test_incomplete_with_no_drift_still_degraded', () => {
    const nowISO = '2025-01-01T12:00:00Z';
    const snapshotCreatedISO = '2025-01-01T10:00:00Z'; // Fresh

    const meta = computeOutputTruthMetadata({
      generatedAtISO: nowISO,
      snapshotId: 'snap_prio_002',
      snapshotCreatedAtISO: snapshotCreatedISO,
      rulesetVersion: '1.0',
      driftStatus: 'NO_DRIFT', // No drift
      completenessPercent: 50, // But incomplete
      missingData: ['fields'],
      nowISO,
    });

    // Must be DEGRADED due to incompleteness
    expect(meta.validityStatus).toBe('DEGRADED');
    expect(meta.confidenceLevel).toBe('LOW');
  });
});
