/**
 * BACKBONE: Dashboard Snapshot State Semantics Tests
 * 
 * Tests the fix for improper handling of missing/invalid snapshots.
 * 
 * Root cause (before fix):
 * - Backend returned HARD_ERROR for NO_SNAPSHOT case (should be NO_SNAPSHOT/NOT_AVAILABLE)
 * - UI logged undefined status/reason when backend error occurred
 * 
 * After fix:
 * - Backend distinguishes: NO_SNAPSHOT (ok:false, status:NOT_AVAILABLE) vs HARD_ERROR (ok:false, status:HARD_ERROR)
 * - UI always logs deterministic status and reason (never undefined)
 * - Envelope always enforces status presence via enforceDashEnvelopeV1Invariant
 */

import { describe, it, expect } from 'vitest';
import {
  okEnvelope,
  notAvailableEnvelope,
  hardErrorEnvelope,
  enforceDashEnvelopeV1Invariant,
  FT_DASH_ENVELOPE_MARKER_V1,
} from '../src/contracts/ft_dash_envelope_v1';

describe('BACKBONE: Dashboard Snapshot State Semantics', () => {
  describe('Case A: No snapshot exists', () => {
    it('should return NOT_AVAILABLE with ok=false and deterministic error code', () => {
      // Simulate backend when no snapshot stored
      const response = notAvailableEnvelope(
        'NO_SNAPSHOT',
        'No snapshot available yet'
      );

      // Validate structure
      expect(response.envelopeKind).toBe(FT_DASH_ENVELOPE_MARKER_V1);
      expect(response.schemaVersion).toBe('v1');
      expect(response.ok).toBe(false);
      expect(response.status).toBe('NOT_AVAILABLE');
      expect(response.error?.code).toBe('NO_SNAPSHOT');
      expect(response.error?.message).toBe('No snapshot available yet');
      
      // CRITICAL: status is never undefined
      expect(response.status).toBeDefined();
      expect(response.status).not.toBeNull();
      
      // CRITICAL: error.code is never undefined when ok=false
      expect(response.error?.code).toBeDefined();
    });

    it('should pass invariant check for NOT_AVAILABLE case', () => {
      const response = notAvailableEnvelope(
        'NO_SNAPSHOT',
        'No snapshot available yet'
      );

      // Should not throw
      const validated = enforceDashEnvelopeV1Invariant(response);

      expect(validated.status).toBe('NOT_AVAILABLE');
      expect(validated.ok).toBe(false);
      expect(validated.error?.code).toBe('NO_SNAPSHOT');
    });
  });

  describe('Case B: Snapshot exists but fails validation/parsing', () => {
    it('should return HARD_ERROR with ok=false when snapshot is invalid', () => {
      // Simulate backend when snapshot exists but has bad schema
      const response = hardErrorEnvelope(
        'FT_SNAPSHOT_INVALID',
        'Snapshot schema validation failed: missing required field "schemaVersion"'
      );

      expect(response.envelopeKind).toBe(FT_DASH_ENVELOPE_MARKER_V1);
      expect(response.schemaVersion).toBe('v1');
      expect(response.ok).toBe(false);
      expect(response.status).toBe('HARD_ERROR');
      expect(response.error?.code).toBe('FT_SNAPSHOT_INVALID');
      
      // CRITICAL: status is never undefined
      expect(response.status).toBeDefined();
      expect(response.status).not.toBeNull();
    });

    it('should pass invariant check for HARD_ERROR case', () => {
      const response = hardErrorEnvelope(
        'FT_SNAPSHOT_INVALID',
        'Snapshot schema validation failed'
      );

      const validated = enforceDashEnvelopeV1Invariant(response);

      expect(validated.status).toBe('HARD_ERROR');
      expect(validated.ok).toBe(false);
    });
  });

  describe('Case C: Snapshot exists and is valid', () => {
    it('should return AVAILABLE with ok=true when snapshot is valid', () => {
      const snapshotData = {
        snapshotId: 'snap_123',
        createdAtUtc: '2026-01-27T12:00:00Z',
        schemaVersion: 'L0',
        metadata: { coverage: 'OK' },
      };

      const response = okEnvelope(snapshotData);

      expect(response.envelopeKind).toBe(FT_DASH_ENVELOPE_MARKER_V1);
      expect(response.schemaVersion).toBe('v1');
      expect(response.ok).toBe(true);
      expect(response.status).toBe('AVAILABLE');
      expect(response.data).toEqual(snapshotData);
      
      // CRITICAL: status is never undefined
      expect(response.status).toBeDefined();
      expect(response.status).not.toBeNull();
    });

    it('should pass invariant check for AVAILABLE case', () => {
      const snapshotData = {
        snapshotId: 'snap_123',
        createdAtUtc: '2026-01-27T12:00:00Z',
        schemaVersion: 'L0',
      };

      const response = okEnvelope(snapshotData);

      const validated = enforceDashEnvelopeV1Invariant(response);

      expect(validated.status).toBe('AVAILABLE');
      expect(validated.ok).toBe(true);
      expect(validated.data).toBeTruthy();
    });
  });

  describe('CRITICAL: Invariant enforcement for undefined status', () => {
    it('should replace envelope with HARD_ERROR if status is undefined', () => {
      const badEnvelope = {
        envelopeKind: FT_DASH_ENVELOPE_MARKER_V1,
        schemaVersion: 'v1',
        ok: false,
        status: undefined,
        error: { code: 'TEST', message: 'test' },
      };

      const validated = enforceDashEnvelopeV1Invariant(badEnvelope);

      // Should NOT allow undefined status - replaces with HARD_ERROR
      expect(validated.status).toBe('HARD_ERROR');
      expect(validated.ok).toBe(false);
      expect(validated.error?.code).toBe('STATUS_MISSING');
    });

    it('should replace envelope with HARD_ERROR if status is null', () => {
      const badEnvelope = {
        envelopeKind: FT_DASH_ENVELOPE_MARKER_V1,
        schemaVersion: 'v1',
        ok: false,
        status: null,
        error: { code: 'TEST', message: 'test' },
      };

      const validated = enforceDashEnvelopeV1Invariant(badEnvelope);

      expect(validated.status).toBe('HARD_ERROR');
      expect(validated.error?.code).toBe('STATUS_MISSING');
    });

    it('should replace envelope with HARD_ERROR if status is invalid value', () => {
      const badEnvelope = {
        envelopeKind: FT_DASH_ENVELOPE_MARKER_V1,
        schemaVersion: 'v1',
        ok: false,
        status: 'INVALID_STATUS_VALUE',
        error: { code: 'TEST', message: 'test' },
      };

      const validated = enforceDashEnvelopeV1Invariant(badEnvelope);

      expect(validated.status).toBe('HARD_ERROR');
      expect(validated.error?.code).toBe('STATUS_INVALID_VALUE');
    });
  });

  describe('CRITICAL: Invariant enforcement for error code', () => {
    it('should reject envelope with ok=false but missing error.code', () => {
      const badEnvelope = {
        envelopeKind: FT_DASH_ENVELOPE_MARKER_V1,
        schemaVersion: 'v1',
        ok: false,
        status: 'HARD_ERROR',
        error: { message: 'error without code' },
      };

      const validated = enforceDashEnvelopeV1Invariant(badEnvelope);

      // Should replace with HARD_ERROR due to invalid error structure
      expect(validated.status).toBe('HARD_ERROR');
      expect(validated.error?.code).toBe('ERROR_STRUCTURE_INVALID');
    });

    it('should reject envelope with ok=false but missing error.message', () => {
      const badEnvelope = {
        envelopeKind: FT_DASH_ENVELOPE_MARKER_V1,
        schemaVersion: 'v1',
        ok: false,
        status: 'HARD_ERROR',
        error: { code: 'TEST_CODE' },
      };

      const validated = enforceDashEnvelopeV1Invariant(badEnvelope);

      expect(validated.status).toBe('HARD_ERROR');
      expect(validated.error?.code).toBe('ERROR_STRUCTURE_INVALID');
    });
  });

  describe('UI level: Status and reason are always deterministic', () => {
    it('should extract deterministic status and reason from NOT_AVAILABLE response', () => {
      const envelope = notAvailableEnvelope(
        'NO_SNAPSHOT',
        'Snapshot not available yet'
      );

      // Simulate UI extraction (mirroring main.ts logic)
      const status = envelope.status ?? 'HARD_ERROR'; // fallback, but should never be used
      const reason = envelope.error?.code ?? 'OK'; // fallback, but should never be used

      // CRITICAL: status and reason should NEVER be undefined
      expect(status).toBeDefined();
      expect(reason).toBeDefined();
      expect(status).toBe('NOT_AVAILABLE');
      expect(reason).toBe('NO_SNAPSHOT');
    });

    it('should extract deterministic status and reason from HARD_ERROR response', () => {
      const envelope = hardErrorEnvelope(
        'FT_SNAPSHOT_INVALID',
        'Snapshot validation failed'
      );

      const status = envelope.status ?? 'HARD_ERROR';
      const reason = envelope.error?.code ?? 'OK';

      expect(status).toBeDefined();
      expect(reason).toBeDefined();
      expect(status).toBe('HARD_ERROR');
      expect(reason).toBe('FT_SNAPSHOT_INVALID');
    });

    it('should extract deterministic status and reason from AVAILABLE response', () => {
      const envelope = okEnvelope({
        snapshotId: 'snap_123',
        createdAtUtc: '2026-01-27T12:00:00Z',
      });

      const status = envelope.status ?? 'HARD_ERROR';
      const reason = envelope.error?.code ?? 'OK';

      expect(status).toBeDefined();
      expect(reason).toBeDefined();
      expect(status).toBe('AVAILABLE');
      expect(reason).toBe('OK');
    });
  });

  describe('Mutual exclusivity: data and error fields', () => {
    it('ok=true response should have data, no error', () => {
      const envelope = okEnvelope({ id: '123' });

      // CRITICAL: when ok=true, should have data, error should be undefined
      expect(envelope.data).toBeDefined();
      expect(envelope.error).toBeUndefined();

      // After invariant check
      const validated = enforceDashEnvelopeV1Invariant(envelope);
      expect(validated.data).toBeDefined();
      expect(validated.error).toBeUndefined();
    });

    it('ok=false response should have error, no data', () => {
      const envelope = hardErrorEnvelope('CODE', 'message');

      // CRITICAL: when ok=false, should have error, data should be undefined
      expect(envelope.error).toBeDefined();
      expect(envelope.data).toBeUndefined();

      const validated = enforceDashEnvelopeV1Invariant(envelope);
      expect(validated.error).toBeDefined();
      expect(validated.data).toBeUndefined();
    });

    it('should reject envelope with both data and error', () => {
      const badEnvelope = {
        envelopeKind: FT_DASH_ENVELOPE_MARKER_V1,
        schemaVersion: 'v1',
        ok: true,
        status: 'AVAILABLE',
        data: { id: '123' },
        error: { code: 'TEST', message: 'should not exist' },
      };

      const validated = enforceDashEnvelopeV1Invariant(badEnvelope);

      // Should fail invariant check and return HARD_ERROR
      expect(validated.status).toBe('HARD_ERROR');
      expect(validated.error?.code).toBe('DATA_ERROR_BOTH_PRESENT');
    });
  });
});
