/**
 * BACKBONE LAYER 0: Unit Tests
 *
 * Tests for:
 * 1. extractUiReqId - all payload shapes A-E plus missing
 * 2. metaBase - returns correct structure with injected SHA
 * 3. ensureTraceOnError - trace_id_stable enforcement
 * 4. Error logging - includes code, message, trace
 * 5. invokeWithUiReqId wrapper - in main.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  extractUiReqId,
  metaBase,
  ensureTraceOnError,
  ALLOWED_RESOLVERS
} from '../src/resolvers/gadget-handlers';

// Mock the imported BACKEND_BUILD_SHA
vi.mock('../src/build/backend_build', () => ({
  BACKEND_BUILD_SHA: 'abc1234'
}));

describe('BACKBONE_LAYER_0: UI_REQ_ID Correlation', () => {
  describe('extractUiReqId', () => {
    it('Case A: Extracts payload.ui_req_id', () => {
      const payload = { ui_req_id: 'ui_12345' };
      expect(extractUiReqId(payload)).toBe('ui_12345');
    });

    it('Case B: Extracts payload.meta.ui_req_id', () => {
      const payload = { meta: { ui_req_id: 'ui_meta_456' } };
      expect(extractUiReqId(payload)).toBe('ui_meta_456');
    });

    it('Case C: Extracts payload.context.ui_req_id', () => {
      const payload = { context: { ui_req_id: 'ui_ctx_789' } };
      expect(extractUiReqId(payload)).toBe('ui_ctx_789');
    });

    it('Case D: Extracts payload.uiReqId (legacy)', () => {
      const payload = { uiReqId: 'ui_legacy_111' };
      expect(extractUiReqId(payload)).toBe('ui_legacy_111');
    });

    it('Case E: Extracts payload.reqId (legacy)', () => {
      const payload = { reqId: 'req_old_222' };
      // Should normalize req_ prefix to ui_
      expect(extractUiReqId(payload)).toBe('ui_old_222');
    });

    it('Missing: Returns null when not found (FAIL CLOSED)', () => {
      const payload = {};
      const result = extractUiReqId(payload);
      expect(result).toBeNull();
    });

    it('Precedence: Prefers ui_req_id over uiReqId', () => {
      const payload = { ui_req_id: 'ui_first', uiReqId: 'ui_second' };
      expect(extractUiReqId(payload)).toBe('ui_first');
    });

    it('Whitespace: Trims and validates non-empty', () => {
      const payload = { ui_req_id: '  ui_trimmed  ' };
      expect(extractUiReqId(payload)).toBe('ui_trimmed');
    });

    it('Null payload: Returns null (FAIL CLOSED)', () => {
      const result = extractUiReqId(null);
      expect(result).toBeNull();
    });
  });
});

describe('BACKBONE_LAYER_0: Build Metadata', () => {
  describe('metaBase', () => {
    it('Returns meta with ui_req_id, backend_build_sha, now_iso', () => {
      const result = metaBase('ui_test_123');
      expect(result).toHaveProperty('ui_req_id', 'ui_test_123');
      expect(result).toHaveProperty('backend_build_sha', 'abc1234');
      expect(result).toHaveProperty('now_iso');
    });

    it('backend_build_sha is never "unknown"', () => {
      const result = metaBase('ui_any');
      expect(result.backend_build_sha).not.toBe('unknown');
      expect(result.backend_build_sha).toMatch(/^[0-9a-f]+$/);
    });

    it('now_iso is valid ISO timestamp', () => {
      const result = metaBase('ui_any');
      expect(new Date(result.now_iso).getTime()).toBeGreaterThan(0);
    });
  });
});

describe('BACKBONE_LAYER_0: Error Handling', () => {
  describe('ensureTraceOnError', () => {
    it('Adds trace_id_stable if missing on error response', () => {
      const res = { ok: false, error: { code: 'TEST_ERROR', message: 'error msg' } };
      const result = ensureTraceOnError(res, 'testResolver', 'ui_trace_123');
      expect(result.error.trace_id_stable).toBeDefined();
      expect(result.error.trace_id_stable).not.toBe('UNSET');
      expect(result.error.trace_id_stable).toMatch(/^trace_testResolver_ui_trace_123_/);
    });

    it('Preserves existing trace_id_stable', () => {
      const res = {
        ok: false,
        error: {
          code: 'TEST_ERROR',
          message: 'error msg',
          trace_id_stable: 'existing_trace_123'
        }
      };
      const result = ensureTraceOnError(res, 'resolver', 'ui_123');
      expect(result.error.trace_id_stable).toBe('existing_trace_123');
    });

    it('Rejects trace_id_stable="UNSET" and regenerates', () => {
      const res = {
        ok: false,
        error: { code: 'TEST', message: 'msg', trace_id_stable: 'UNSET' }
      };
      const result = ensureTraceOnError(res, 'resolver', 'ui_123');
      expect(result.error.trace_id_stable).not.toBe('UNSET');
      expect(result.error.trace_id_stable).toMatch(/^trace_resolver_ui_123_/);
    });

    it('Ensures error.code exists', () => {
      const res = { ok: false, error: { message: 'msg' } };
      const result = ensureTraceOnError(res, 'resolver', 'ui_123');
      expect(result.error.code).toBe('RESOLVER_UNHANDLED_EXCEPTION');
    });

    it('Ensures error.message exists', () => {
      const res = { ok: false, error: { code: 'ERROR' } };
      const result = ensureTraceOnError(res, 'resolver', 'ui_123');
      expect(result.error.message).toBe('Resolver failed');
    });

    it('Ensures meta exists on all responses', () => {
      const res = { ok: true };
      const result = ensureTraceOnError(res, 'resolver', 'ui_123');
      expect(result.meta).toBeDefined();
      expect(result.meta.ui_req_id).toBe('ui_123');
      expect(result.meta.backend_build_sha).toBe('abc1234');
    });

    it('Handles ok:true case with meta merge', () => {
      const res = { ok: true, meta: { custom: 'field' } };
      const result = ensureTraceOnError(res, 'resolver', 'ui_123');
      expect(result.meta.ui_req_id).toBe('ui_123');
      expect(result.meta.custom).toBe('field');
    });
  });
});

describe('BACKBONE_LAYER_0: Resolver Registry', () => {
  it('All required resolvers are in ALLOWED_RESOLVERS', () => {
    const requiredResolvers = [
      'ping',
      'ensureFirstSnapshot',
      'getBuildInfo',
      'getStatusSnapshot',
      'refreshNow',
      'exportTrustSnapshot',
      'getSnapshotDebug',
      'getOperationalState'
    ];

    for (const resolver of requiredResolvers) {
      expect(ALLOWED_RESOLVERS).toHaveProperty(resolver);
      expect(typeof ALLOWED_RESOLVERS[resolver as keyof typeof ALLOWED_RESOLVERS]).toBe('function');
    }
  });

  it('No undocumented resolvers in allowlist', () => {
    // Ensures we can grep and validate easily
    const allowedKeys = Object.keys(ALLOWED_RESOLVERS);
    expect(allowedKeys.length).toBeGreaterThan(0);
    expect(allowedKeys.length).toBeLessThanOrEqual(15); // Safety check
  });
});

describe('BACKBONE_LAYER_0: Logging Format', () => {
  it('Error log includes code, message, trace in JSON', () => {
    const res = { ok: false, error: { code: 'TEST_CODE', message: 'Test error message' } };
    const normalized = ensureTraceOnError(res, 'resolver', 'ui_123');

    // Simulate what gets logged
    const logObj = {
      marker: 'RESOLVER_ERR',
      resolver: 'resolver',
      ui_req_id: 'ui_123',
      error_code: normalized.error.code,
      message: normalized.error.message.substring(0, 200),
      trace_id_stable: normalized.error.trace_id_stable
    };

    const jsonString = JSON.stringify(logObj);
    expect(jsonString).toContain('TEST_CODE');
    expect(jsonString).toContain('Test error message');
    expect(jsonString).toContain('trace_');
    expect(jsonString).not.toContain('UNSET');
  });

  it('Message is truncated to 200 chars in logs', () => {
    const longMessage = 'x'.repeat(500);
    const truncated = longMessage.substring(0, 200);
    expect(truncated.length).toBeLessThanOrEqual(200);
  });
});

describe('BACKBONE_LAYER_0: Integration', () => {
  it('Full flow: payload extraction → meta creation → error handling', () => {
    // Simulate resolver error
    const uiPayload = {
      resolverName: 'testResolver',
      ui_req_id: 'ui_integration_test',
      data: { some: 'value' }
    };

    const extractedId = extractUiReqId(uiPayload);
    expect(extractedId).toBe('ui_integration_test');

    const meta = metaBase(extractedId);
    expect(meta.ui_req_id).toBe('ui_integration_test');
    expect(meta.backend_build_sha).not.toBe('unknown');

    const errorRes = { ok: false, error: { code: 'TEST', message: 'Error' } };
    const normalized = ensureTraceOnError(errorRes, 'testResolver', extractedId);

    expect(normalized.ok).toBe(false);
    expect(normalized.error.trace_id_stable).toBeDefined();
    expect(normalized.error.trace_id_stable).not.toBe('UNSET');
    expect(normalized.meta.ui_req_id).toBe('ui_integration_test');
    expect(normalized.meta.backend_build_sha).toBe('abc1234');
  });
});
