/**
 * P1: Dashboard State Contract Tests
 * 
 * REGRESSION TEST FOR BOOTING FOREVER / UNDEFINED STATE BUG
 * 
 * This test file ensures that the UI dashboard state handling follows the
 * canonical v1 envelope pattern and enforces fail-closed semantics.
 * 
 * Root cause: Previously, undefined state could reach TruthModel due to:
 * - Missing envelope validation
 * - No mapping function enforcement
 * - Undefined values not caught before store commit
 * 
 * These tests verify:
 * A) mapDashEnvelopeV1 enforces schema version v1
 * B) mapDashEnvelopeV1 returns explicit ERROR state on backend failure
 * C) mapDashEnvelopeV1 throws on invalid envelopes
 * D) assertNonNullDashboardState prevents undefined from reaching store
 * 
 * PHASE 2 REFACTOR: Functions now imported from shared dashEnvelope.ts module
 * to ensure tests exercise REAL implementation, not local copies (fake coverage).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mapDashEnvelopeV1, assertNonNullDashboardState } from '../src/gadget-ui/src/dashEnvelope';

describe('P1: Dashboard State Contract', () => {
  describe('mapDashEnvelopeV1 success cases', () => {
    it('should map valid v1 envelope with data', () => {
      const envelope = {
        envelopeKind: 'FT_DASH_ENVELOPE_V1',
        envelopeVersion: 1,
        ok: true,
        schemaVersion: 'v1',
        data: { status: 'OK', reason_code: 'OK' }
      };

      const result = mapDashEnvelopeV1(envelope);

      expect(result).toBeDefined();
      expect(result.status).toBe('OK');
      expect(result.reason_code).toBe('OK');
      expect(result.canonical_envelope_applied).toBe(true);
      expect(result.envelope_schema_version).toBe('v1');
    });

    it('should preserve all data fields when mapping', () => {
      const envelope = {
        envelopeKind: 'FT_DASH_ENVELOPE_V1',
        envelopeVersion: 1,
        ok: true,
        schemaVersion: 'v1',
        data: {
          status: 'BOOTSTRAP',
          reason_code: 'STORAGE_UNVERIFIED',
          ledger: { snapshot_count: 0 },
          custom_field: 'custom_value'
        }
      };

      const result = mapDashEnvelopeV1(envelope);

      expect(result.status).toBe('BOOTSTRAP');
      expect(result.reason_code).toBe('STORAGE_UNVERIFIED');
      expect(result.ledger).toEqual({ snapshot_count: 0 });
      expect(result.custom_field).toBe('custom_value');
    });
  });

  describe('mapDashEnvelopeV1 error cases', () => {
    it('should return ERROR state when ok=false', () => {
      const envelope = {
        envelopeKind: 'FT_DASH_ENVELOPE_V1',
        envelopeVersion: 1,
        ok: false,
        schemaVersion: 'v1',
        error: { code: 'STORAGE_ERROR', message: 'Storage unavailable' }
      };

      const result = mapDashEnvelopeV1(envelope);

      expect(result.status).toBe('ERROR');
      expect(result.reason).toBe('DASH_REQUEST_FAILED');
      expect(result.error).toEqual({ code: 'STORAGE_ERROR', message: 'Storage unavailable' });
      expect(result.canonical_envelope_applied).toBe(true);
    });

    it('should handle missing error details gracefully', () => {
      const envelope = {
        envelopeKind: 'FT_DASH_ENVELOPE_V1',
        envelopeVersion: 1,
        ok: false,
        schemaVersion: 'v1',
      };

      const result = mapDashEnvelopeV1(envelope);

      expect(result.status).toBe('ERROR');
      expect(result.error).toEqual({ code: 'UNKNOWN', message: 'Unknown error' });
    });

    it('should NOT be in BOOTING state on error', () => {
      const envelope = {
        envelopeKind: 'FT_DASH_ENVELOPE_V1',
        envelopeVersion: 1,
        ok: false,
        schemaVersion: 'v1',
        error: { code: 'BACKEND_UNAVAILABLE', message: 'Cannot reach backend' }
      };

      const result = mapDashEnvelopeV1(envelope);

      // Critical: state must not be BOOTING when error occurs
      expect(result.status).not.toBe('BOOTING');
      expect(result.status).toBe('ERROR');
    });
  });

  describe('mapDashEnvelopeV1 fail-closed enforcement', () => {
    it('should throw on null envelope', () => {
      expect(() => mapDashEnvelopeV1(null)).toThrow('DASH_ENVELOPE_INVALID_FAIL_CLOSED');
    });

    it('should throw on undefined envelope', () => {
      expect(() => mapDashEnvelopeV1(undefined)).toThrow('DASH_ENVELOPE_INVALID_FAIL_CLOSED');
    });

    it('should throw on non-object envelope', () => {
      expect(() => mapDashEnvelopeV1("not an object")).toThrow('DASH_ENVELOPE_INVALID_FAIL_CLOSED');
      expect(() => mapDashEnvelopeV1(123)).toThrow('DASH_ENVELOPE_INVALID_FAIL_CLOSED');
      expect(() => mapDashEnvelopeV1([])).toThrow('DASH_ENVELOPE_INVALID_FAIL_CLOSED');
    });

    it('should throw on wrong schema version (v2)', () => {
      const envelope = {
        envelopeKind: 'FT_DASH_ENVELOPE_V1',
        envelopeVersion: 1,
        ok: true,
        schemaVersion: 'v2',
        data: { status: 'OK' }
      };

      expect(() => mapDashEnvelopeV1(envelope)).toThrow('DASH_SCHEMA_VERSION_UNSUPPORTED_FAIL_CLOSED');
    });

    it('should throw on missing schemaVersion', () => {
      const envelope = {
        envelopeKind: 'FT_DASH_ENVELOPE_V1',
        envelopeVersion: 1,
        ok: true,
        data: { status: 'OK' }
      };

      expect(() => mapDashEnvelopeV1(envelope)).toThrow('DASH_SCHEMA_VERSION_UNSUPPORTED_FAIL_CLOSED');
    });

    it('should throw on missing data field when ok=true', () => {
      const envelope = {
        envelopeKind: 'FT_DASH_ENVELOPE_V1',
        envelopeVersion: 1,
        ok: true,
        schemaVersion: 'v1',
      };

      expect(() => mapDashEnvelopeV1(envelope)).toThrow('DASH_ENVELOPE_MISSING_DATA_FAIL_CLOSED');
    });

    it('should throw on null data field when ok=true', () => {
      const envelope = {
        envelopeKind: 'FT_DASH_ENVELOPE_V1',
        envelopeVersion: 1,
        ok: true,
        schemaVersion: 'v1',
        data: null
      };

      expect(() => mapDashEnvelopeV1(envelope)).toThrow('DASH_ENVELOPE_MISSING_DATA_FAIL_CLOSED');
    });

    it('should throw on non-object data field when ok=true', () => {
      const envelope = {
        envelopeKind: 'FT_DASH_ENVELOPE_V1',
        envelopeVersion: 1,
        ok: true,
        schemaVersion: 'v1',
        data: "string data"
      };

      expect(() => mapDashEnvelopeV1(envelope)).toThrow('DASH_ENVELOPE_MISSING_DATA_FAIL_CLOSED');
    });
  });

  describe('assertNonNullDashboardState prevents undefined store commit', () => {
    it('should pass for valid state object', () => {
      const state = { status: 'OK', reason_code: 'OK' };
      expect(() => assertNonNullDashboardState(state, {})).not.toThrow();
    });

    it('should pass for state with canonical marker', () => {
      const state = {
        status: 'BOOTSTRAP',
        canonical_envelope_applied: true,
        envelope_schema_version: 'v1'
      };
      expect(() => assertNonNullDashboardState(state, {})).not.toThrow();
    });

    it('should throw for null state', () => {
      expect(() => assertNonNullDashboardState(null, {})).toThrow('DASHBOARD_STATE_UNDEFINED_FAIL_CLOSED');
    });

    it('should throw for undefined state', () => {
      expect(() => assertNonNullDashboardState(undefined, {})).toThrow('DASHBOARD_STATE_UNDEFINED_FAIL_CLOSED');
    });

    it('should throw for non-object state', () => {
      expect(() => assertNonNullDashboardState("string", {})).toThrow('DASHBOARD_STATE_UNDEFINED_FAIL_CLOSED');
      expect(() => assertNonNullDashboardState(123, {})).toThrow('DASHBOARD_STATE_UNDEFINED_FAIL_CLOSED');
    });

    it('should throw for false/0/empty string state', () => {
      expect(() => assertNonNullDashboardState(false, {})).toThrow('DASHBOARD_STATE_UNDEFINED_FAIL_CLOSED');
      expect(() => assertNonNullDashboardState(0, {})).toThrow('DASHBOARD_STATE_UNDEFINED_FAIL_CLOSED');
      expect(() => assertNonNullDashboardState('', {})).toThrow('DASHBOARD_STATE_UNDEFINED_FAIL_CLOSED');
    });
  });

  describe('Integration: End-to-end state mapping flow', () => {
    it('should handle success path: envelope -> map -> assert -> ready to commit', () => {
      const envelope = {
        envelopeKind: 'FT_DASH_ENVELOPE_V1',
        envelopeVersion: 1,
        ok: true,
        schemaVersion: 'v1',
        data: { status: 'OK', reason_code: 'OK', ledger: { snapshot_count: 5 } }
      };

      const mapped = mapDashEnvelopeV1(envelope);
      expect(() => assertNonNullDashboardState(mapped, { step: 'test' })).not.toThrow();

      // State is now ready for store commit
      expect(mapped.status).toBe('OK');
      expect(mapped.canonical_envelope_applied).toBe(true);
    });

    it('should handle error path: envelope -> map -> assert -> explicit ERROR ready to commit', () => {
      const envelope = {
        envelopeKind: 'FT_DASH_ENVELOPE_V1',
        envelopeVersion: 1,
        ok: false,
        schemaVersion: 'v1',
        error: { code: 'STORAGE_ERROR', message: 'DB unavailable' }
      };

      const mapped = mapDashEnvelopeV1(envelope);
      expect(() => assertNonNullDashboardState(mapped, { step: 'test' })).not.toThrow();

      // Error state is explicit, not undefined, not BOOTING
      expect(mapped.status).toBe('ERROR');
      expect(mapped.status).not.toBe(undefined);
      expect(mapped.status).not.toBe('BOOTING');
    });

    it('should handle degraded path: envelope with degraded state', () => {
      const envelope = {
        envelopeKind: 'FT_DASH_ENVELOPE_V1',
        envelopeVersion: 1,
        ok: true,
        schemaVersion: 'v1',
        data: { status: 'DEGRADED', reason_code: 'NO_SNAPSHOT_YET', ledger: { snapshot_count: 0 } }
      };

      const mapped = mapDashEnvelopeV1(envelope);
      expect(() => assertNonNullDashboardState(mapped, { step: 'test' })).not.toThrow();

      // State is explicit, allows UI to show appropriate degraded message
      expect(mapped.status).toBe('DEGRADED');
    });

    it('should prevent undefined state from bootstrap -> cache miss scenario', () => {
      // Scenario: Backend returns empty/missing data
      const badEnvelope = {
        envelopeKind: 'FT_DASH_ENVELOPE_V1',
        envelopeVersion: 1,
        ok: true,
        schemaVersion: 'v1',
        // Missing data field
      };

      // Should throw fail-closed, not return undefined
      expect(() => mapDashEnvelopeV1(badEnvelope)).toThrow('DASH_ENVELOPE_MISSING_DATA_FAIL_CLOSED');
    });
  });

  describe('Regression: Prevent BOOTING forever', () => {
    it('should never map to state with undefined status', () => {
      const envelopes = [
        { envelopeKind: 'FT_DASH_ENVELOPE_V1', envelopeVersion: 1, ok: true, schemaVersion: 'v1', data: { status: 'OK' } },
        { envelopeKind: 'FT_DASH_ENVELOPE_V1', envelopeVersion: 1, ok: false, schemaVersion: 'v1', error: { code: 'ERR' } },
        { envelopeKind: 'FT_DASH_ENVELOPE_V1', envelopeVersion: 1, ok: true, schemaVersion: 'v1', data: { status: 'BOOTSTRAP', reason_code: 'INIT' } },
      ];

      for (const env of envelopes) {
        const result = mapDashEnvelopeV1(env);
        expect(result.status).toBeDefined();
        expect(result.status).not.toBeNull();
      }
    });

    it('should never allow unmapped envelope to reach store', () => {
      // Simulate the bug: what if raw envelope was committed?
      const rawEnvelope = {
        envelopeKind: 'FT_DASH_ENVELOPE_V1',
        envelopeVersion: 1,
        ok: true,
        schemaVersion: 'v1',
        data: undefined  // Invalid
      };

      // This should fail-close
      expect(() => mapDashEnvelopeV1(rawEnvelope)).toThrow();
    });

    it('should provide explicit DEGRADED state on bootstrap', () => {
      const bootstrapEnvelope = {
        envelopeKind: 'FT_DASH_ENVELOPE_V1',
        envelopeVersion: 1,
        ok: true,
        schemaVersion: 'v1',
        data: {
          status: 'BOOTSTRAP',
          reason_code: 'STORAGE_UNVERIFIED',
          ledger: { snapshot_count: 0 }
        }
      };

      const result = mapDashEnvelopeV1(bootstrapEnvelope);

      // UI should show this, not stall indefinitely
      expect(result.status).toBe('BOOTSTRAP');
      expect(result.reason_code).toBe('STORAGE_UNVERIFIED');
      expect(result).not.toEqual(undefined);
    });
  });
});
