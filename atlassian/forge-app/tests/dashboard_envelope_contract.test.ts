/**
 * REGRESSION TEST: Dashboard Envelope Contract Compliance
 * 
 * BACKSTORY: Backend was returning envelope with wrong marker + schema version,
 * causing UI to fail-close with "FT_STATUS_MISSING / DASH_ENVELOPE_MARKER_MISSING".
 * 
 * ROOT CAUSE: ft_getDashboardState_v1 used old normalizer producing:
 *   { marker: "FT_DASH_ENVELOPE_v1", schemaVersion: 1, status: ... }
 * But UI expected:
 *   { envelopeKind: "FT_DASH_ENVELOPE_V1", schemaVersion: "v1", ok: boolean, ... }
 * 
 * FIX: Use dashOk/dashErr builders from shared/dashEnvelopeV1.ts
 * 
 * THIS TEST ENSURES:
 * 1. Dashboard envelope builders produce EXACT format UI expects
 * 2. envelopeKind is UPPERCASE "FT_DASH_ENVELOPE_V1"
 * 3. schemaVersion is STRING "v1" (not number 1, not lowercase "v1")
 * 4. ok field is boolean (never undefined)
 * 5. Never undefined status values
 * 6. Meta always includes backend_build_sha, ui_build_sha, ui_req_id, probe_nonce, ts_utc
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { dashOk, dashErr } from '../src/shared/dashEnvelopeV1';
import { nowUtcIso } from '../src/backbone/time';

describe('dashboard_envelope_contract', () => {
  const mockBuildSha = '1234567890abcdef' + 'fedcba0987654321';
  const mockReqId = 'test-req-001';
  const mockTs = '2026-01-25T07:40:00Z';

  beforeEach(() => {
    // Ensure we're using consistent timestamps for reproducibility
    expect(mockTs).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  describe('dashOk builder', () => {
    it('MUST produce envelope with envelopeKind="FT_DASH_ENVELOPE_V1" (uppercase)', () => {
      const env = dashOk({
        data: { status: 'AVAILABLE', snapshotId: 'snap-001' },
        meta: {
          backend_build_sha: mockBuildSha,
          ui_build_sha: null,
          ui_req_id: mockReqId,
          probe_nonce: null,
          ts_utc: mockTs,
        },
      });

      expect(env.envelopeKind).toBe('FT_DASH_ENVELOPE_V1');
      // Strict check: not lowercase variant
      expect(env.envelopeKind).not.toBe('FT_DASH_ENVELOPE_v1');
      expect(env.envelopeKind).not.toBe('ft_dash_envelope_v1');
    });

    it('MUST produce schemaVersion="v1" (string, lowercase v)', () => {
      const env = dashOk({
        data: { status: 'AVAILABLE' },
        meta: { backend_build_sha: mockBuildSha, ui_build_sha: null, ui_req_id: mockReqId, probe_nonce: null, ts_utc: mockTs },
      });

      expect(env.schemaVersion).toBe('v1');
      expect(typeof env.schemaVersion).toBe('string');
      // Strict check: not numeric 1
      expect(env.schemaVersion).not.toBe(1 as any);
    });

    it('MUST include ok=true (boolean)', () => {
      const env = dashOk({
        data: { test: 'data' },
        meta: { backend_build_sha: mockBuildSha, ui_build_sha: null, ui_req_id: mockReqId, probe_nonce: null, ts_utc: mockTs },
      });

      expect(env.ok).toBe(true);
      expect(typeof env.ok).toBe('boolean');
      expect(env.ok).not.toBe('true' as any);
    });

    it('MUST never have undefined status/status fields', () => {
      const env = dashOk({
        data: { status: 'AVAILABLE', snapshotId: 'snap-001' },
        meta: { backend_build_sha: mockBuildSha, ui_build_sha: null, ui_req_id: mockReqId, probe_nonce: null, ts_utc: mockTs },
      });

      expect(env).toHaveProperty('data');
      expect(env.data).not.toBeUndefined();
      expect('error' in env).toBe(false);
    });

    it('MUST include complete meta with all 5 fields', () => {
      const env = dashOk({
        data: { test: 'data' },
        meta: {
          backend_build_sha: mockBuildSha,
          ui_build_sha: 'abcd1234' + 'efgh5678' + 'ijkl9012',
          ui_req_id: mockReqId,
          probe_nonce: 'probe-123',
          ts_utc: mockTs,
        },
      });

      expect(env.meta).toEqual({
        backend_build_sha: mockBuildSha,
        ui_build_sha: 'abcd1234' + 'efgh5678' + 'ijkl9012',
        ui_req_id: mockReqId,
        probe_nonce: 'probe-123',
        ts_utc: mockTs,
      });
    });

    it('MUST normalize empty string meta fields to defaults', () => {
      const env = dashOk({
        data: { test: 'data' },
        meta: {
          backend_build_sha: '', // empty
          ui_build_sha: '', // empty
          ui_req_id: '', // empty
          probe_nonce: '', // empty
          ts_utc: '', // empty
        },
      });

      expect(env.meta.backend_build_sha).toBe('UNSET');
      expect(env.meta.ui_build_sha).toBeNull();
      expect(env.meta.ui_req_id).toBe('UNSET');
      expect(env.meta.probe_nonce).toBeNull();
      expect(env.meta.ts_utc).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('dashErr builder', () => {
    it('MUST produce envelope with envelopeKind="FT_DASH_ENVELOPE_V1" (uppercase)', () => {
      const env = dashErr({
        error: { code: 'TEST_ERROR', message: 'Test error message' },
        meta: { backend_build_sha: mockBuildSha, ui_build_sha: null, ui_req_id: mockReqId, probe_nonce: null, ts_utc: mockTs },
      });

      expect(env.envelopeKind).toBe('FT_DASH_ENVELOPE_V1');
      expect(env.envelopeKind).not.toBe('FT_DASH_ENVELOPE_v1');
    });

    it('MUST produce schemaVersion="v1" (string)', () => {
      const env = dashErr({
        error: { code: 'ERROR', message: 'msg' },
        meta: { backend_build_sha: mockBuildSha, ui_build_sha: null, ui_req_id: mockReqId, probe_nonce: null, ts_utc: mockTs },
      });

      expect(env.schemaVersion).toBe('v1');
      expect(typeof env.schemaVersion).toBe('string');
      expect(env.schemaVersion).not.toBe(1 as any);
    });

    it('MUST include ok=false (boolean)', () => {
      const env = dashErr({
        error: { code: 'ERROR', message: 'msg' },
        meta: { backend_build_sha: mockBuildSha, ui_build_sha: null, ui_req_id: mockReqId, probe_nonce: null, ts_utc: mockTs },
      });

      expect(env.ok).toBe(false);
      expect(typeof env.ok).toBe('boolean');
    });

    it('MUST include error with code + message (never undefined)', () => {
      const env = dashErr({
        error: { code: 'TEST_CODE', message: 'Test message' },
        meta: { backend_build_sha: mockBuildSha, ui_build_sha: null, ui_req_id: mockReqId, probe_nonce: null, ts_utc: mockTs },
      });

      expect(env.error).toBeDefined();
      expect(env.error?.code).toBe('TEST_CODE');
      expect(env.error?.message).toBe('Test message');
      expect('data' in env).toBe(false);
    });

    it('MUST normalize empty error fields to defaults', () => {
      const env = dashErr({
        error: { code: '', message: '' },
        meta: { backend_build_sha: mockBuildSha, ui_build_sha: null, ui_req_id: mockReqId, probe_nonce: null, ts_utc: mockTs },
      });

      expect(env.error?.code).toBe('UNKNOWN');
      expect(env.error?.message).toBe('Unknown error');
    });

    it('MUST never return undefined ok', () => {
      const okEnv = dashOk({
        data: {},
        meta: { backend_build_sha: mockBuildSha, ui_build_sha: null, ui_req_id: mockReqId, probe_nonce: null, ts_utc: mockTs },
      });
      const errEnv = dashErr({
        error: { code: 'E', message: 'E' },
        meta: { backend_build_sha: mockBuildSha, ui_build_sha: null, ui_req_id: mockReqId, probe_nonce: null, ts_utc: mockTs },
      });

      expect(okEnv.ok).not.toBeUndefined();
      expect(errEnv.ok).not.toBeUndefined();
    });
  });

  describe('UI contract compatibility', () => {
    it('Both builders MUST produce responses that UI can validate', () => {
      const okEnv = dashOk({
        data: { status: 'AVAILABLE' },
        meta: { backend_build_sha: mockBuildSha, ui_build_sha: null, ui_req_id: mockReqId, probe_nonce: null, ts_utc: mockTs },
      });
      const errEnv = dashErr({
        error: { code: 'ERROR', message: 'msg' },
        meta: { backend_build_sha: mockBuildSha, ui_build_sha: null, ui_req_id: mockReqId, probe_nonce: null, ts_utc: mockTs },
      });

      // Simulate UI validation checks from dashEnvelope.ts
      const validateUiContract = (resp: any) => {
        if (resp === null || resp === undefined || typeof resp !== 'object' || Array.isArray(resp)) {
          throw new Error('DASH_ENVELOPE_INVALID_FAIL_CLOSED');
        }
        if (resp.schemaVersion !== 'v1') {
          throw new Error(`DASH_SCHEMA_VERSION_UNSUPPORTED_FAIL_CLOSED: expected v1, got ${resp.schemaVersion}`);
        }
        if (resp.envelopeKind !== 'FT_DASH_ENVELOPE_V1') {
          throw new Error(`DASH_ENVELOPE_MARKER_MISSING: expected FT_DASH_ENVELOPE_V1, got ${resp.envelopeKind}`);
        }
        if (typeof resp.ok !== 'boolean') {
          throw new Error('DASH_OK_NOT_BOOLEAN');
        }
      };

      // Both should pass UI validation
      expect(() => validateUiContract(okEnv)).not.toThrow();
      expect(() => validateUiContract(errEnv)).not.toThrow();
    });
  });
});
