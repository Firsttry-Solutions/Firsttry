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
