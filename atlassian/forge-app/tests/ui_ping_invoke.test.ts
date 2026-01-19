/**
 * UI Ping Response Parser Tests
 * 
 * CRITICAL: Tests for production bug fix
 * User requirement: UI must NEVER label ping as failed if JSON was received
 * 
 * These tests MUST fail if:
 * 1. A LEGACY format response (schemaVersion=1) is marked as PING_FAILED
 * 2. A TruthEnvelope response is marked as PING_FAILED when ok=true
 * 3. expectedScheduleIntervalMinutes becomes undefined (must be number|null)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parsePingResponse, shouldShowBackendNotResponding, type ParsedPingResponse } from '../src/gadget-ui/src/pingResponseParser';
import { computeGovernanceViewModel, type RuntimeSignals } from '../src/gadget-ui/src/truthModel';

describe('UI Ping Response Parser - Production Bug Fix', () => {
  // =========================================================================
  // TEST GROUP 1: LEGACY Format Handling
  // =========================================================================
  describe('LEGACY format (schemaVersion=1)', () => {
    it('should parse legacy response with backendBuild as successful', () => {
      // PRODUCTION CASE: Backend returns schemaVersion="1", backendBuild set
      const legacyResponse = {
        schemaVersion: '1',
        backendBuild: 'abc123def456',
        now_iso: '2025-01-04T12:00:00Z',
        correlationId: 'req-123'
      };

      const parsed = parsePingResponse(legacyResponse);

      expect(parsed.mode).toBe('LEGACY');
      expect(parsed.ok).toBe(true);
      expect(parsed.error).toBeUndefined();
      expect(parsed.data).toEqual(legacyResponse);
    });

    it('should NOT mark legacy response as PING_FAILED', () => {
      const legacyResponse = {
        schemaVersion: '1',
        backendBuild: 'abc123def456'
      };

      const parsed = parsePingResponse(legacyResponse);
      const shouldFail = !parsed.ok;

      // CRITICAL INVARIANT: If JSON was received (mode=LEGACY), must NOT fail
      expect(shouldFail).toBe(false);
      expect(parsed.ok).toBe(true);
    });

    it('should preserve legacy response data in parsed result', () => {
      const legacyResponse = {
        schemaVersion: '1',
        backendBuild: 'build-sha-xyz',
        timestamp: 1234567890,
        customField: 'preserved'
      };

      const parsed = parsePingResponse(legacyResponse);

      expect(parsed.data.backendBuild).toBe('build-sha-xyz');
      expect(parsed.data.customField).toBe('preserved');
    });

    it('should handle legacy response with ok field explicitly false', () => {
      // Edge case: legacy response with ok=false
      const legacyWithFalseOk = {
        schemaVersion: '1',
        backendBuild: 'abc123',
        ok: false,
        error: {
          message: 'Some backend error',
          code: 'BACKEND_ERROR'
        }
      };

      const parsed = parsePingResponse(legacyWithFalseOk);

      expect(parsed.mode).toBe('LEGACY');
      expect(parsed.ok).toBe(false);
      expect(parsed.error?.message).toBe('Some backend error');
    });
  });

  // =========================================================================
  // TEST GROUP 2: TruthEnvelope Format Handling
  // =========================================================================
  describe('TruthEnvelope format', () => {
    it('should parse TruthEnvelope with ok=true as successful', () => {
      const envelope = {
        kind: 'PingResponse',
        ok: true,
        build: {
          sha: 'sha-456abc',
          time: '2025-01-04T12:00:00Z'
        },
        correlation: 'req-456'
      };

      const parsed = parsePingResponse(envelope);

      expect(parsed.mode).toBe('TRUTH_ENVELOPE');
      expect(parsed.ok).toBe(true);
      expect(parsed.error).toBeUndefined();
    });

    it('should parse TruthEnvelope with ok=false as error', () => {
      const envelope = {
        kind: 'PingResponse',
        ok: false,
        error: {
          code: 'RESOLVER_ERROR',
          message: 'Resolver failed',
          trace_id_stable: 'trace-123'
        }
      };

      const parsed = parsePingResponse(envelope);

      expect(parsed.mode).toBe('TRUTH_ENVELOPE');
      expect(parsed.ok).toBe(false);
      expect(parsed.error?.code).toBe('RESOLVER_ERROR');
      expect(parsed.error?.trace_id_stable).toBe('trace-123');
    });

    it('should detect TruthEnvelope by kind field', () => {
      const envelope = {
        kind: 'SomeEnvelopeKind',
        ok: true,
        someData: 'value'
      };

      const parsed = parsePingResponse(envelope);

      // Should be detected as TRUTH_ENVELOPE because has 'kind' field
      expect(parsed.mode).toBe('TRUTH_ENVELOPE');
    });
  });

  // =========================================================================
  // TEST GROUP 3: Invalid/Network Error Cases
  // =========================================================================
  describe('Invalid response handling', () => {
    it('should mark null as INVALID_PING_RESPONSE', () => {
      const parsed = parsePingResponse(null);

      expect(parsed.mode).toBe('INVALID');
      expect(parsed.ok).toBe(false);
      expect(parsed.error?.code).toBe('INVALID_PING_RESPONSE');
    });

    it('should mark undefined as INVALID_PING_RESPONSE', () => {
      const parsed = parsePingResponse(undefined);

      expect(parsed.mode).toBe('INVALID');
      expect(parsed.ok).toBe(false);
    });

    it('should mark string as INVALID_PING_RESPONSE', () => {
      const parsed = parsePingResponse('not a JSON object');

      expect(parsed.mode).toBe('INVALID');
      expect(parsed.ok).toBe(false);
    });

    it('should mark number as INVALID_PING_RESPONSE', () => {
      const parsed = parsePingResponse(12345);

      expect(parsed.mode).toBe('INVALID');
      expect(parsed.ok).toBe(false);
    });

    it('should mark empty object as INVALID but preserve it', () => {
      const emptyObj = {};
      const parsed = parsePingResponse(emptyObj);

      expect(parsed.mode).toBe('INVALID');
      expect(parsed.ok).toBe(false);
      expect(parsed.data).toEqual({});
    });

    it('should include trace_id_stable if present in invalid response', () => {
      const badResponse = {
        error_occurred: true,
        trace_id_stable: 'trace-bad-456'
      };

      const parsed = parsePingResponse(badResponse);

      expect(parsed.mode).toBe('INVALID');
      expect(parsed.error?.trace_id_stable).toBe('trace-bad-456');
    });
  });

  // =========================================================================
  // TEST GROUP 4: shouldShowBackendNotResponding() Logic
  // =========================================================================
  describe('shouldShowBackendNotResponding() function', () => {
    it('should return true if invoke threw (no response at all)', () => {
      const shouldShow = shouldShowBackendNotResponding(true, null);
      expect(shouldShow).toBe(true);
    });

    it('should return false if we have a parsed response', () => {
      const parsedResponse: ParsedPingResponse = {
        mode: 'INVALID',
        ok: false,
        data: {},
        error: { message: 'some error', code: 'ERROR' }
      };

      const shouldShow = shouldShowBackendNotResponding(false, parsedResponse);
      expect(shouldShow).toBe(false);
    });

    it('should return false if invoke did not throw and we have response', () => {
      const parsedResponse: ParsedPingResponse = {
        mode: 'LEGACY',
        ok: true,
        data: { schemaVersion: '1', backendBuild: 'sha' }
      };

      const shouldShow = shouldShowBackendNotResponding(false, parsedResponse);
      expect(shouldShow).toBe(false);
    });
  });

  // =========================================================================
  // TEST GROUP 5: expectedScheduleIntervalMinutes Normalization
  // =========================================================================
  describe('expectedScheduleIntervalMinutes normalization', () => {
    it('should NEVER be undefined - must be number or null', () => {
      // Create minimal signals with proper normalization
      const signals: RuntimeSignals = {
        tenantIdentityStatus: 'OK',
        backendStatus: 'OK',
        scheduleStatus: 'CONFIGURED',
        expectedScheduleIntervalMinutes: 60, // Must be number|null
        lastSuccessfulRunISO: null,
        lastAttemptISO: null,
        snapshot: null,
        storageStatus: 'EMPTY',
        snapshotCountRetained: 0,
        checksCompletedLifetime: 0,
        failures7d: 0,
        skippedChecks7d: 0,
        exportSubsystemStatus: 'NOT_READY',
        permissionsVisibility: 'OK',
        stalenessThresholdMinutes: 120,
        nowISO: new Date().toISOString()
      };

      const vm = computeGovernanceViewModel(signals);

      // CRITICAL INVARIANT: expectedScheduleIntervalMinutes must never be undefined
      expect(vm.expectedScheduleIntervalMinutes).not.toBeUndefined();
      expect(typeof vm.expectedScheduleIntervalMinutes === 'number' || vm.expectedScheduleIntervalMinutes === null).toBe(true);
    });

    it('should be null when scheduleStatus is NOT_CONFIGURED', () => {
      const signals: RuntimeSignals = {
        tenantIdentityStatus: 'OK',
        backendStatus: 'OK',
        scheduleStatus: 'NOT_CONFIGURED',
        expectedScheduleIntervalMinutes: 60, // Input is 60, but should become null
        lastSuccessfulRunISO: null,
        lastAttemptISO: null,
        snapshot: null,
        storageStatus: 'EMPTY',
        snapshotCountRetained: 0,
        checksCompletedLifetime: 0,
        failures7d: 0,
        skippedChecks7d: 0,
        exportSubsystemStatus: 'NOT_READY',
        permissionsVisibility: 'OK',
        stalenessThresholdMinutes: 120,
        nowISO: new Date().toISOString()
      };

      const vm = computeGovernanceViewModel(signals);

      // Should enforce invariant: NOT_CONFIGURED => interval must be null
      expect(vm.expectedScheduleIntervalMinutes).toBeNull();
    });

    it('should preserve numeric value when scheduleStatus is CONFIGURED', () => {
      const signals: RuntimeSignals = {
        tenantIdentityStatus: 'OK',
        backendStatus: 'OK',
        scheduleStatus: 'CONFIGURED',
        expectedScheduleIntervalMinutes: 30,
        lastSuccessfulRunISO: null,
        lastAttemptISO: null,
        snapshot: null,
        storageStatus: 'EMPTY',
        snapshotCountRetained: 0,
        checksCompletedLifetime: 0,
        failures7d: 0,
        skippedChecks7d: 0,
        exportSubsystemStatus: 'NOT_READY',
        permissionsVisibility: 'OK',
        stalenessThresholdMinutes: 120,
        nowISO: new Date().toISOString()
      };

      const vm = computeGovernanceViewModel(signals);

      expect(vm.expectedScheduleIntervalMinutes).toBe(30);
    });
  });

  // =========================================================================
  // TEST GROUP 6: Production Contradiction Scenarios
  // =========================================================================
  describe('Production bug scenarios', () => {
    it('CRITICAL: Should NOT mark ping as PING_FAILED if LEGACY JSON received', () => {
      // This is the exact bug from production:
      // UI logs show [UI_PING_INVOKE_FAILED] but also show raw JSON response
      
      const legacyJsonResponse = {
        schemaVersion: '1',
        backendBuild: 'some-sha',
        data: { /* backend response data */ }
      };

      const parsed = parsePingResponse(legacyJsonResponse);
      
      // MUST NOT be marked as failed
      expect(parsed.ok).toBe(true);
      expect(parsed.mode).toBe('LEGACY');
      
      // And we should NOT show "Backend not responding"
      expect(shouldShowBackendNotResponding(false, parsed)).toBe(false);
    });

    it('CRITICAL: Should only show Backend not responding if invoke threw', () => {
      // Test the distinction:
      // 1. invoke() threw -> "Backend not responding"
      // 2. invoke() succeeded but ok=false -> show structured error
      
      const invokeThrew = true;
      const noResponse = null;
      
      expect(shouldShowBackendNotResponding(invokeThrew, noResponse)).toBe(true);
      
      // But if invoke succeeded (even with error response):
      const invokeDidNotThrow = false;
      const errorResponse: ParsedPingResponse = {
        mode: 'LEGACY',
        ok: false,
        data: { error: 'something' },
        error: { message: 'Backend error', code: 'ERROR' }
      };
      
      expect(shouldShowBackendNotResponding(invokeDidNotThrow, errorResponse)).toBe(false);
    });

    it('Should preserve full response data for diagnostics', () => {
      // For debugging: full response should be available
      const complexResponse = {
        schemaVersion: '1',
        backendBuild: 'abc123',
        diagnostics: {
          checks_run: 100,
          failures: 5,
          warnings: 2
        },
        metadata: {
          resolved_at: '2025-01-04T12:00:00Z',
          version: '2.0'
        }
      };

      const parsed = parsePingResponse(complexResponse);

      expect(parsed.data.diagnostics).toEqual({
        checks_run: 100,
        failures: 5,
        warnings: 2
      });
      expect(parsed.data.metadata.version).toBe('2.0');
    });
  });
});

/**
 * Additional tests for signal construction from parsed responses
 */
describe('Signal construction from parsed ping responses', () => {
  it('should extract backend_build_sha from LEGACY format', () => {
    const legacyPing = {
      schemaVersion: '1',
      backendBuild: 'build-xyz-123'
    };

    const parsed = parsePingResponse(legacyPing);
    const backendBuildSha = parsed.data?.backendBuild || 'unknown';

    expect(backendBuildSha).toBe('build-xyz-123');
  });

  it('should extract backend_build_sha from TruthEnvelope', () => {
    const envelope = {
      kind: 'PingResponse',
      ok: true,
      build: {
        sha: 'envelope-build-sha'
      }
    };

    const parsed = parsePingResponse(envelope);
    const backendBuildSha = parsed.data?.build?.sha || 'unknown';

    expect(backendBuildSha).toBe('envelope-build-sha');
  });
});
