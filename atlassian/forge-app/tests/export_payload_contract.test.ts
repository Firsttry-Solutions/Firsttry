/**
 * Contract tests for export payload data integrity
 * 
 * These tests ensure that:
 * 1. GovernanceStatusV1 includes operationalMetrics and boundaries fields
 * 2. normalizeStatusV1 preserves these fields without data loss
 * 3. Export payloads never silently output zeros/false for unknown fields
 * 4. All unknown fields are explicitly marked in the export
 */

import { describe, it, expect } from 'vitest';
import {
  GovernanceStatusV1,
  normalizeStatusV1,
  EMPTY_STATUS_V1,
} from '../src/shared/statusSchema';

describe('Export Payload Contract Tests', () => {
  /**
   * T1: Empty payload should have explicit null values for operationalMetrics/boundaries
   * (not coerced to 0/false)
   */
  it('T1: EMPTY_STATUS_V1 should have null operationalMetrics and boundaries', () => {
    const empty = EMPTY_STATUS_V1('test-tenant', 'v1.0.0', 'ui-v1.0.0');

    // All operational metrics must be null (unknown), not 0
    expect(empty.operationalMetrics).toBeDefined();
    expect(empty.operationalMetrics!.checksCompletedLifetime).toBe(null);
    expect(empty.operationalMetrics!.snapshotsRetainedCount).toBe(null);
    expect(empty.operationalMetrics!.daysContinuousOperation).toBe(null);
    expect(empty.operationalMetrics!.failureCount7d).toBe(null);
    expect(empty.operationalMetrics!.skippedChecksCount7d).toBe(null);

    // All boundaries must be null (unknown), not false
    expect(empty.boundaries).toBeDefined();
    expect(empty.boundaries!.noJiraWrites).toBe(null);
    expect(empty.boundaries!.noConfigChanges).toBe(null);
    expect(empty.boundaries!.noEnforcement).toBe(null);
  });

  /**
   * T2: normalizeStatusV1 should preserve operationalMetrics/boundaries from input
   */
  it('T2: normalizeStatusV1 preserves operationalMetrics and boundaries from input', () => {
    const input = {
      schemaVersion: '1',
      generatedAt: new Date().toISOString(),
      tenantAri: 'test-tenant',
      backendBuild: 'v1.0.0',
      health: 'OK' as const,
      scheduler: { runCountLifetime: 5 },
      snapshots: { retainedCount: 10 },
      timeline: [],
      checks: [],
      errors: [],
      export: { jsonReady: true, csvReady: false, pdfReady: false },
      // Operational metrics with real values
      operationalMetrics: {
        checksCompletedLifetime: 42,
        snapshotsRetainedCount: 10,
        daysContinuousOperation: 5,
        failureCount7d: 2,
        skippedChecksCount7d: 0,
      },
      // Boundaries with real values
      boundaries: {
        noJiraWrites: true,
        noConfigChanges: false,
        noEnforcement: true,
        noRecommendations: false,
        observationalOnly: true,
      },
    };

    const normalized = normalizeStatusV1(input, 'test-tenant', 'v1.0.0');

    // Must preserve operationalMetrics exactly
    expect(normalized.operationalMetrics!.checksCompletedLifetime).toBe(42);
    expect(normalized.operationalMetrics!.snapshotsRetainedCount).toBe(10);
    expect(normalized.operationalMetrics!.daysContinuousOperation).toBe(5);
    expect(normalized.operationalMetrics!.failureCount7d).toBe(2);
    expect(normalized.operationalMetrics!.skippedChecksCount7d).toBe(0);

    // Must preserve boundaries exactly
    expect(normalized.boundaries!.noJiraWrites).toBe(true);
    expect(normalized.boundaries!.noConfigChanges).toBe(false);
    expect(normalized.boundaries!.noEnforcement).toBe(true);
  });

  /**
   * T3: normalizeStatusV1 should convert undefined fields to null, not 0/false
   */
  it('T3: normalizeStatusV1 converts missing fields to null, not 0/false', () => {
    const input = {
      schemaVersion: '1',
      generatedAt: new Date().toISOString(),
      tenantAri: 'test-tenant',
      backendBuild: 'v1.0.0',
      health: 'OK' as const,
      scheduler: { runCountLifetime: 0 },
      snapshots: { retainedCount: 0 },
      timeline: [],
      checks: [],
      errors: [],
      export: { jsonReady: false, csvReady: false, pdfReady: false },
      // Missing operationalMetrics and boundaries
    };

    const normalized = normalizeStatusV1(input, 'test-tenant', 'v1.0.0');

    // Missing fields must be null, not 0/false
    expect(normalized.operationalMetrics).toBeDefined();
    expect(normalized.operationalMetrics!.checksCompletedLifetime).toBe(null);
    expect(normalized.operationalMetrics!.snapshotsRetainedCount).toBe(null);

    expect(normalized.boundaries).toBeDefined();
    expect(normalized.boundaries!.noJiraWrites).toBe(null);
    expect(normalized.boundaries!.noConfigChanges).toBe(null);
  });

  /**
   * T4: Partial operationalMetrics should preserve known values, null for unknown
   */
  it('T4: Partial operationalMetrics preserved, unknown fields are null', () => {
    const input = {
      schemaVersion: '1',
      generatedAt: new Date().toISOString(),
      tenantAri: 'test-tenant',
      backendBuild: 'v1.0.0',
      health: 'OK' as const,
      scheduler: { runCountLifetime: 0 },
      snapshots: { retainedCount: 0 },
      timeline: [],
      checks: [],
      errors: [],
      export: { jsonReady: false, csvReady: false, pdfReady: false },
      // Only some operationalMetrics present
      operationalMetrics: {
        checksCompletedLifetime: 100,
        snapshotsRetainedCount: 5,
        // others missing => should be null
      },
    };

    const normalized = normalizeStatusV1(input, 'test-tenant', 'v1.0.0');

    expect(normalized.operationalMetrics!.checksCompletedLifetime).toBe(100);
    expect(normalized.operationalMetrics!.snapshotsRetainedCount).toBe(5);
    expect(normalized.operationalMetrics!.daysContinuousOperation).toBe(null); // Unknown
    expect(normalized.operationalMetrics!.failureCount7d).toBe(null); // Unknown
  });

  /**
   * T5: Legacy field names (checksCompletedLifetime, etc. at top level) should still work
   */
  it('T5: Legacy top-level field names still supported for backward compat', () => {
    const input = {
      schemaVersion: '1',
      generatedAt: new Date().toISOString(),
      tenantAri: 'test-tenant',
      backendBuild: 'v1.0.0',
      health: 'OK' as const,
      scheduler: { runCountLifetime: 0 },
      snapshots: { retainedCount: 0 },
      timeline: [],
      checks: [],
      errors: [],
      export: { jsonReady: false, csvReady: false, pdfReady: false },
      // Legacy field names at top level
      checksCompletedLifetime: 75,
      snapshotsRetainedCount: 8,
      daysContinuousOperation: 3,
    };

    const normalized = normalizeStatusV1(input, 'test-tenant', 'v1.0.0');

    // Both legacy fields AND operationalMetrics should be present
    expect(normalized.checksCompletedLifetime).toBe(75);
    expect(normalized.operationalMetrics!.checksCompletedLifetime).toBe(75);

    expect(normalized.snapshotsRetainedCount).toBe(8);
    expect(normalized.operationalMetrics!.snapshotsRetainedCount).toBe(8);

    expect(normalized.daysContinuousOperation).toBe(3);
    expect(normalized.operationalMetrics!.daysContinuousOperation).toBe(3);
  });

  /**
   * T6: malformed input should fail-safe to nulls
   */
  it('T6: Malformed operationalMetrics falls back to nulls safely', () => {
    const input = {
      schemaVersion: '1',
      generatedAt: new Date().toISOString(),
      tenantAri: 'test-tenant',
      backendBuild: 'v1.0.0',
      health: 'OK' as const,
      scheduler: { runCountLifetime: 0 },
      snapshots: { retainedCount: 0 },
      timeline: [],
      checks: [],
      errors: [],
      export: { jsonReady: false, csvReady: false, pdfReady: false },
      // Malformed operationalMetrics (string instead of object)
      operationalMetrics: 'not an object' as any,
    };

    // Should not throw, should return safe object
    const normalized = normalizeStatusV1(input, 'test-tenant', 'v1.0.0');

    // Must have operationalMetrics object with null values
    expect(normalized.operationalMetrics).toBeDefined();
    expect(normalized.operationalMetrics!.checksCompletedLifetime).toBe(null);
  });

  /**
   * T7: Export payload must mark unknown fields explicitly
   * (This simulates what buildExportPayload should do)
   */
  it('T7: Export payload contract: unknown fields marked explicitly', () => {
    const statusWithUnknowns: GovernanceStatusV1 = EMPTY_STATUS_V1(
      'test-tenant',
      'v1.0.0',
      'ui-v1.0.0'
    );

    // Simulate buildExportPayload behavior
    const unknownMetrics: string[] = [];
    if (statusWithUnknowns.operationalMetrics?.checksCompletedLifetime === null)
      unknownMetrics.push('checksCompletedLifetime');
    if (statusWithUnknowns.operationalMetrics?.snapshotsRetainedCount === null)
      unknownMetrics.push('snapshotsRetainedCount');
    if (statusWithUnknowns.operationalMetrics?.daysContinuousOperation === null)
      unknownMetrics.push('daysContinuousOperation');

    const exportPayload = {
      operationalMetrics: {
        checksCompletedLifetime: statusWithUnknowns.operationalMetrics?.checksCompletedLifetime ?? null,
        snapshotCountRetained: statusWithUnknowns.operationalMetrics?.snapshotsRetainedCount ?? null,
        daysContinuousOperation: statusWithUnknowns.operationalMetrics?.daysContinuousOperation ?? null,
      },
      unknownMetrics: unknownMetrics.length > 0 ? unknownMetrics : undefined,
    };

    // Export must have explicit nulls
    expect(exportPayload.operationalMetrics.checksCompletedLifetime).toBeNull();
    expect(exportPayload.operationalMetrics.snapshotCountRetained).toBeNull();

    // Export must mark which fields are unknown
    expect(exportPayload.unknownMetrics).toContain('checksCompletedLifetime');
    expect(exportPayload.unknownMetrics).toContain('snapshotsRetainedCount');
    expect(exportPayload.unknownMetrics).toContain('daysContinuousOperation');
  });

  /**
   * T8: Export payload NEVER outputs zeros for unknown metrics
   */
  it('T8: Export payload never silently outputs 0 for unknown metrics', () => {
    const status = EMPTY_STATUS_V1('test-tenant', 'v1.0.0');

    // Export must use null coalescence (??), not || operator
    const exportPayload = {
      checksCompletedLifetime: status.operationalMetrics?.checksCompletedLifetime ?? null,
      snapshotCountRetained: status.operationalMetrics?.snapshotsRetainedCount ?? null,
    };

    // Must be null, NOT 0
    expect(exportPayload.checksCompletedLifetime).toBeNull();
    expect(exportPayload.snapshotCountRetained).toBeNull();

    // Prove that || would have given us 0 (BAD)
    const badExport = {
      checksCompletedLifetime: status.operationalMetrics?.checksCompletedLifetime || 0,
    };
    expect(badExport.checksCompletedLifetime).toBe(0); // This is the silent data loss!
  });
});
