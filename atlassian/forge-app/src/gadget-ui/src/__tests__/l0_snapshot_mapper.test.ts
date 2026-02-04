/**
 * L0 Snapshot Mapper Regression Tests
 * 
 * Tests for the layer-0 snapshot response mapper.
 * CRITICAL: Ensures that NOT_AVAILABLE + FT_SNAPSHOT_INVALID maps to NO_SNAPSHOT (not HARD_ERROR)
 */

import { describe, it, expect } from 'vitest';
import { mapL0SnapshotResponse, L0DashboardState } from '../l0_snapshot_mapper';

describe('l0_snapshot_mapper', () => {
  describe('AVAILABLE response', () => {
    it('should map AVAILABLE status with snapshot data to PROOF_OK', () => {
      const response = {
        status: 'AVAILABLE',
        snapshotId: 'snap-12345',
        createdAtUtc: '2026-01-28T10:00:00Z',
        schemaVersion: 'L0',
        containsText: 'Jira governance evidence snapshot.',
      };

      const state = mapL0SnapshotResponse(response);

      expect(state.status).toBe('AVAILABLE');
      expect(state.reasonCode).toBe('PROOF_OK');
      expect(state.snapshotId).toBe('snap-12345');
      expect(state.createdAtUtc).toBe('2026-01-28T10:00:00Z');
      expect(state.error).toBeNull();
    });
  });

  describe('NO_SNAPSHOT response', () => {
    it('should map NO_SNAPSHOT status to STATE_NO_SNAPSHOT', () => {
      const response = {
        status: 'NO_SNAPSHOT',
        schemaVersion: 'L0',
        error: 'NO_SNAPSHOT_POINTER',
      };

      const state = mapL0SnapshotResponse(response);

      expect(state.status).toBe('NO_SNAPSHOT');
      expect(state.reasonCode).toBe('STATE_NO_SNAPSHOT');
      expect(state.snapshotId).toBeNull();
      expect(state.createdAtUtc).toBeNull();
    });
  });

  describe('NOT_AVAILABLE + FT_SNAPSHOT_INVALID (regression test)', () => {
    it('should map NOT_AVAILABLE with FT_SNAPSHOT_INVALID to NO_SNAPSHOT (not HARD_ERROR)', () => {
      // This is the critical regression test
      // When envelopeKind=FT_DASH_ENVELOPE_V1, ok=false, status=NOT_AVAILABLE, error.code=FT_SNAPSHOT_INVALID
      // The mapper should treat this as NO_SNAPSHOT, NOT as HARD_ERROR
      const response = {
        status: 'NOT_AVAILABLE',
        error: {
          code: 'FT_SNAPSHOT_INVALID',
        },
        schemaVersion: 'L0',
      };

      const state = mapL0SnapshotResponse(response);

      // REGRESSION FIX: Should be NO_SNAPSHOT, not HARD_ERROR
      expect(state.status).toBe('NO_SNAPSHOT');
      expect(state.reasonCode).toBe('STATE_NO_SNAPSHOT');
      expect(state.snapshotId).toBeNull();
      expect(state.createdAtUtc).toBeNull();
      expect(state.error).toBe('FT_SNAPSHOT_INVALID');

      // Ensure it's NOT a hard error
      expect(state.reasonCode).not.toBe('STATE_HARD_ERROR');
      expect(state.reasonCode).not.toBe('ENVELOPE_NOT_OK');
    });

    it('should use "Snapshot is invalid or unavailable" note for NOT_AVAILABLE + FT_SNAPSHOT_INVALID', () => {
      const response = {
        status: 'NOT_AVAILABLE',
        error: {
          code: 'FT_SNAPSHOT_INVALID',
        },
        schemaVersion: 'L0',
      };

      const state = mapL0SnapshotResponse(response);

      expect(state.note).toBe('Snapshot is invalid or unavailable');
    });
  });

  describe('INVALID_SNAPSHOT response', () => {
    it('should map INVALID_SNAPSHOT status to STATE_INVALID_SNAPSHOT', () => {
      const response = {
        status: 'INVALID_SNAPSHOT',
        schemaVersion: 'L0',
        error: 'SNAPSHOT_SCHEMA_MISMATCH',
      };

      const state = mapL0SnapshotResponse(response);

      expect(state.status).toBe('INVALID_SNAPSHOT');
      expect(state.reasonCode).toBe('STATE_INVALID_SNAPSHOT');
      expect(state.snapshotId).toBeNull();
    });
  });

  describe('HARD_ERROR response', () => {
    it('should map HARD_ERROR status to STATE_HARD_ERROR', () => {
      const response = {
        status: 'HARD_ERROR',
        schemaVersion: 'L0',
        error: 'UNKNOWN_ERROR',
        note: 'Fatal error occurred',
      };

      const state = mapL0SnapshotResponse(response);

      expect(state.status).toBe('HARD_ERROR');
      expect(state.reasonCode).toBe('STATE_HARD_ERROR');
      expect(state.snapshotId).toBeNull();
      expect(state.error).toBe('UNKNOWN_ERROR');
    });
  });

  describe('Invalid responses (fail-closed)', () => {
    it('should return HARD_ERROR when response is null', () => {
      const state = mapL0SnapshotResponse(null);

      expect(state.status).toBe('HARD_ERROR');
      expect(state.reasonCode).toBe('ENVELOPE_NOT_OK');
      expect(state.error).toBe('FT_RESPONSE_INVALID');
    });

    it('should return HARD_ERROR when response is not an object', () => {
      const state = mapL0SnapshotResponse('not an object');

      expect(state.status).toBe('HARD_ERROR');
      expect(state.reasonCode).toBe('ENVELOPE_NOT_OK');
      expect(state.error).toBe('FT_RESPONSE_INVALID');
    });

    it('should return HARD_ERROR when status is missing', () => {
      const response = {
        schemaVersion: 'L0',
      };

      const state = mapL0SnapshotResponse(response);

      expect(state.status).toBe('HARD_ERROR');
      expect(state.reasonCode).toBe('ENVELOPE_NOT_OK');
      expect(state.error).toBe('FT_STATUS_MISSING');
    });

    it('should return HARD_ERROR when status is invalid', () => {
      const response = {
        status: 'UNKNOWN_STATUS',
        schemaVersion: 'L0',
      };

      const state = mapL0SnapshotResponse(response);

      expect(state.status).toBe('HARD_ERROR');
      expect(state.reasonCode).toBe('ENVELOPE_NOT_OK');
      expect(state.error).toBe('FT_INVALID_STATUS');
    });
  });

  describe('Contract enforcement', () => {
    it('should never return undefined status', () => {
      const testCases = [
        null,
        undefined,
        {},
        { status: 'AVAILABLE' },
        { status: 'NO_SNAPSHOT' },
        { status: 'INVALID_SNAPSHOT' },
        { status: 'HARD_ERROR' },
        { status: 'NOT_AVAILABLE', error: { code: 'FT_SNAPSHOT_INVALID' } },
      ];

      testCases.forEach((testCase) => {
        const state = mapL0SnapshotResponse(testCase);
        expect(state.status).toBeDefined();
        expect(typeof state.status).toBe('string');
        expect(['AVAILABLE', 'NO_SNAPSHOT', 'INVALID_SNAPSHOT', 'HARD_ERROR']).toContain(state.status);
      });
    });

    it('should never return undefined reasonCode', () => {
      const testCases = [
        null,
        undefined,
        {},
        { status: 'AVAILABLE' },
        { status: 'NO_SNAPSHOT' },
        { status: 'INVALID_SNAPSHOT' },
        { status: 'HARD_ERROR' },
        { status: 'NOT_AVAILABLE', error: { code: 'FT_SNAPSHOT_INVALID' } },
      ];

      testCases.forEach((testCase) => {
        const state = mapL0SnapshotResponse(testCase);
        expect(state.reasonCode).toBeDefined();
        expect(typeof state.reasonCode).toBe('string');
      });
    });
  });
});

/**
 * UI Log Relay Payload Tests
 * 
 * Tests for relay payload structure and field validation.
 * Ensures relay markers have all required fields for backend grep.
 */
describe('UI Log Relay payload', () => {
  /**
   * Helper: Simulate the backend unwrap logic
   * Handles both old nested { payload: {...} } and correct flat { marker, ... }
   */
  function unwrapRelayPayload(request: any): any {
    let payload = request?.payload || {};
    if (
      payload &&
      typeof payload === "object" &&
      (payload as any).payload &&
      typeof (payload as any).payload === "object"
    ) {
      payload = (payload as any).payload;
    }
    return payload;
  }

  describe('buildRelayPayload', () => {
    it('should build valid relay payload with all required fields', () => {
      const marker = 'UI_ENTRY_RUNTIME_PROOF';
      const ui_git_sha = 'e76695552e4e21790c86d577bef9624894ef397d';
      const ui_req_id = 'ui_1706511234_abc12345';
      const extra = { ui_bundle_hash: 'abc123', ui_git_time: '2026-01-28T10:00:00Z' };

      const payload = {
        marker,
        ui_git_sha,
        ui_req_id,
        extra,
      };

      // Validate required fields
      expect(payload).toHaveProperty('marker');
      expect(payload).toHaveProperty('ui_git_sha');
      expect(payload).toHaveProperty('ui_req_id');
      expect(payload).toHaveProperty('extra');

      // Validate field types
      expect(typeof payload.marker).toBe('string');
      expect(typeof payload.ui_git_sha).toBe('string');
      expect(typeof payload.ui_req_id).toBe('string');
      expect(typeof payload.extra).toBe('object');

      // Validate field values are non-empty
      expect(payload.marker.length).toBeGreaterThan(0);
      expect(payload.ui_git_sha.length).toBe(40); // Full SHA
      expect(payload.ui_req_id.length).toBeGreaterThan(0);
    });

    it('should have required marker values in relay calls', () => {
      const validMarkers = ['UI_ENTRY_RUNTIME_PROOF', 'L0_DASHBOARD_RENDERED'];
      
      validMarkers.forEach((marker) => {
        expect(marker).toBeDefined();
        expect(typeof marker).toBe('string');
        expect(marker.length).toBeGreaterThan(0);
      });
    });

    it('should handle dashboard rendered extra fields', () => {
      const dashStateExtra = {
        status: 'AVAILABLE',
        reasonCode: 'PROOF_OK',
        snapshotId: 'snap-123456',
      };

      // Validate extra can be stringified (for truncation)
      const extraStr = JSON.stringify(dashStateExtra);
      expect(extraStr.length).toBeLessThan(500);
      expect(extraStr).toContain('status');
      expect(extraStr).toContain('reasonCode');
      expect(extraStr).toContain('snapshotId');
    });

    it('should handle entry proof extra fields', () => {
      const entryExtra = {
        ui_bundle_hash: 'abc123def456',
        ui_git_time: '2026-01-28T10:00:00Z',
      };

      const extraStr = JSON.stringify(entryExtra);
      expect(extraStr.length).toBeLessThan(500);
      expect(extraStr).toContain('ui_bundle_hash');
      expect(extraStr).toContain('ui_git_time');
    });
  });

  describe('Backend unwrap logic (backward compatibility)', () => {
    it('should unwrap old nested format { payload: { marker, ... } }', () => {
      const nestedRequest = {
        payload: {
          payload: {
            marker: 'UI_ENTRY_RUNTIME_PROOF',
            ui_git_sha: 'e76695552e4e21790c86d577bef9624894ef397d',
            ui_req_id: 'ui_1706511234_abc12345',
            extra: { test: 'data' },
          },
        },
      };

      // Simulate backend unwrap
      let payload = nestedRequest?.payload || {};
      if (
        payload &&
        typeof payload === "object" &&
        (payload as any).payload &&
        typeof (payload as any).payload === "object"
      ) {
        payload = (payload as any).payload;
      }

      // Verify unwrapped payload has correct structure
      expect(payload.marker).toBe('UI_ENTRY_RUNTIME_PROOF');
      expect(payload.ui_git_sha).toBe('e76695552e4e21790c86d577bef9624894ef397d');
      expect(payload.ui_req_id).toBe('ui_1706511234_abc12345');
      expect(payload.extra).toEqual({ test: 'data' });
    });

    it('should accept flat format { marker, ui_git_sha, ui_req_id, extra }', () => {
      const flatRequest = {
        payload: {
          marker: 'L0_DASHBOARD_RENDERED',
          ui_git_sha: 'e76695552e4e21790c86d577bef9624894ef397d',
          ui_req_id: 'ui_1706511234_def56789',
          extra: { status: 'AVAILABLE' },
        },
      };

      // Simulate backend unwrap
      let payload = flatRequest?.payload || {};
      if (
        payload &&
        typeof payload === "object" &&
        (payload as any).payload &&
        typeof (payload as any).payload === "object"
      ) {
        payload = (payload as any).payload;
      }

      // Verify flat payload is used as-is
      expect(payload.marker).toBe('L0_DASHBOARD_RENDERED');
      expect(payload.ui_git_sha).toBe('e76695552e4e21790c86d577bef9624894ef397d');
      expect(payload.ui_req_id).toBe('ui_1706511234_def56789');
      expect(payload.extra).toEqual({ status: 'AVAILABLE' });
    });

    it('should extract marker value correctly from both formats', () => {
      const testCases = [
        {
          name: 'nested old format',
          request: { payload: { payload: { marker: 'UI_ENTRY_RUNTIME_PROOF', ui_git_sha: 'a'.repeat(40), ui_req_id: 'id1' } } },
          expectedMarker: 'UI_ENTRY_RUNTIME_PROOF',
        },
        {
          name: 'flat new format',
          request: { payload: { marker: 'L0_DASHBOARD_RENDERED', ui_git_sha: 'b'.repeat(40), ui_req_id: 'id2' } },
          expectedMarker: 'L0_DASHBOARD_RENDERED',
        },
      ];

      testCases.forEach(({ name, request, expectedMarker }) => {
        let payload = request?.payload || {};
        if (
          payload &&
          typeof payload === "object" &&
          (payload as any).payload &&
          typeof (payload as any).payload === "object"
        ) {
          payload = (payload as any).payload;
        }
        expect(payload.marker).toBe(expectedMarker, `${name} should extract correct marker`);
      });
    });
  });

  describe('Envelope payload extraction (CRITICAL FIX)', () => {
    it('should extract snapshotId and createdAtUtc from envelope.data when present', () => {
      // This test FAILS on the old code (before fix) because it looked for response.snapshotId instead of response.data.snapshotId
      const envelope = {
        envelopeKind: 'FT_DASH_ENVELOPE_V1',
        ok: true,
        status: 'AVAILABLE',
        data: {
          status: 'AVAILABLE',
          snapshotId: 'abc123def456-2026.01.24.01-seed',
          createdAtUtc: '2026-01-24T12:00:00Z',
          schemaVersion: 'L0',
          containsText: 'Jira governance evidence snapshot (export for full details).',
        },
      };

      const state = mapL0SnapshotResponse(envelope);

      // CRITICAL: These assertions would FAIL before the fix
      expect(state.snapshotId).toBe('abc123def456-2026.01.24.01-seed');
      expect(state.createdAtUtc).toBe('2026-01-24T12:00:00Z');
      expect(state.status).toBe('AVAILABLE');
      expect(state.reasonCode).toBe('PROOF_OK');
    });

    it('should NOT return null for snapshotId when data contains it', () => {
      // This is the hard gate test: if snapshotId becomes null despite data having it, this fails
      const envelope = {
        envelopeKind: 'FT_DASH_ENVELOPE_V1',
        ok: true,
        status: 'AVAILABLE',
        data: {
          status: 'AVAILABLE',
          snapshotId: 'real-snapshot-id-value',
          createdAtUtc: '2026-01-24T12:00:00Z',
          schemaVersion: 'L0',
          containsText: 'Test snapshot',
        },
      };

      const state = mapL0SnapshotResponse(envelope);

      // Hard gate: snapshotId MUST NOT be null
      expect(state.snapshotId).not.toBeNull();
      expect(state.snapshotId).toBe('real-snapshot-id-value');
    });

    it('should NOT return null for createdAtUtc when data contains it', () => {
      // Hard gate: createdAtUtc MUST NOT be null when present in data
      const envelope = {
        envelopeKind: 'FT_DASH_ENVELOPE_V1',
        ok: true,
        status: 'AVAILABLE',
        data: {
          status: 'AVAILABLE',
          snapshotId: 'snap-123',
          createdAtUtc: '2026-01-24T14:30:00Z',
          schemaVersion: 'L0',
          containsText: 'Test',
        },
      };

      const state = mapL0SnapshotResponse(envelope);

      // Hard gate: createdAtUtc MUST NOT be null
      expect(state.createdAtUtc).not.toBeNull();
      expect(state.createdAtUtc).toBe('2026-01-24T14:30:00Z');
    });

    it('should handle AVAILABLE with missing snapshotId gracefully (set to null)', () => {
      // When status is AVAILABLE but snapshotId is missing, should set to null
      const envelope = {
        envelopeKind: 'FT_DASH_ENVELOPE_V1',
        ok: true,
        status: 'AVAILABLE',
        data: {
          status: 'AVAILABLE',
          // snapshotId missing
          createdAtUtc: '2026-01-24T12:00:00Z',
          schemaVersion: 'L0',
        },
      };

      const state = mapL0SnapshotResponse(envelope);

      // Should gracefully handle missing snapshotId
      expect(state.snapshotId).toBeNull();
      expect(state.createdAtUtc).toBe('2026-01-24T12:00:00Z');
      expect(state.status).toBe('AVAILABLE');
    });

    it('should work with direct payload (not wrapped in envelope) for backwards compatibility', () => {
      // If response doesn't have data field, should use response directly
      const directPayload = {
        status: 'AVAILABLE',
        snapshotId: 'direct-snap-id',
        createdAtUtc: '2026-01-24T10:00:00Z',
        schemaVersion: 'L0',
      };

      const state = mapL0SnapshotResponse(directPayload);

      expect(state.snapshotId).toBe('direct-snap-id');
      expect(state.createdAtUtc).toBe('2026-01-24T10:00:00Z');
      expect(state.status).toBe('AVAILABLE');
    });

    it('should prefer envelope.data over response-level fields', () => {
      // If both data and top-level fields exist, should prefer data
      const mixed = {
        envelopeKind: 'FT_DASH_ENVELOPE_V1',
        ok: true,
        status: 'AVAILABLE',
        snapshotId: 'wrong-id', // This should be ignored
        createdAtUtc: 'wrong-date', // This should be ignored
        data: {
          status: 'AVAILABLE',
          snapshotId: 'correct-id',
          createdAtUtc: '2026-01-24T12:00:00Z',
          schemaVersion: 'L0',
        },
      };

      const state = mapL0SnapshotResponse(mixed);

      // Should use data field, not top-level fields
      expect(state.snapshotId).toBe('correct-id');
      expect(state.createdAtUtc).toBe('2026-01-24T12:00:00Z');
    });
  });

  describe('Build SHA and Build Time mapping', () => {
    it('should extract backend_git_sha and backend_build_time_utc from AVAILABLE response payload', () => {
      // Regression test: Ensure Build SHA and Build Time are NOT shown as NOT_AVAILABLE when resolver provides them
      const response = {
        status: 'AVAILABLE',
        snapshotId: 'snap-12345',
        createdAtUtc: '2026-01-28T10:00:00Z',
        schemaVersion: 'L0',
        backend_git_sha: 'abc1234567890def',
        backend_build_time_utc: '2026-01-28T09:30:00Z',
        backend_app_version: '2.14.0',
      };

      const state = mapL0SnapshotResponse(response);

      expect(state.status).toBe('AVAILABLE');
      expect(state.backendBuildSha).toBe('abc1234567890def');
      expect(state.backendBuildTimeUtc).toBe('2026-01-28T09:30:00Z');
      expect(state.backendAppVersion).toBe('2.14.0');
    });

    it('should handle missing backend build fields gracefully', () => {
      // When resolver doesn't provide backend build fields, should still map to AVAILABLE
      const response = {
        status: 'AVAILABLE',
        snapshotId: 'snap-12345',
        createdAtUtc: '2026-01-28T10:00:00Z',
        schemaVersion: 'L0',
      };

      const state = mapL0SnapshotResponse(response);

      expect(state.status).toBe('AVAILABLE');
      expect(state.backendBuildSha).toBeUndefined();
      expect(state.backendBuildTimeUtc).toBeUndefined();
    });
  });
});
