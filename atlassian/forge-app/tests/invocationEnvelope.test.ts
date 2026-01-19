import { describe, it, expect } from 'vitest';
import { isErrorEnvelopeV1, validateErrorEnvelope } from '../src/shared/invocationEnvelope';
import { makeErrorEnvelope } from '../src/security/errorEnvelope';
import { traceFail } from '../src/security/stepTrace';

describe('invocationEnvelope types and guards', () => {
  const mockMeta = {
    traceId: 'trace-123',
    requestId: 'req-456',
    invocationId: null,
    uiReqId: 'ui-111',
    nowIso: new Date().toISOString(),
  };

  describe('isErrorEnvelopeV1', () => {
    it('should recognize valid ErrorEnvelopeV1', () => {
      const trace = [
        traceFail('probe.run', 'S1', 'PROBE_FAILED', 'Probe failed'),
      ];

      const envelope = makeErrorEnvelope({
        resolverName: 'probe.run',
        stepId: 'S1',
        errorCode: 'PROBE_FAILED',
        message: 'Probe failed',
        meta: mockMeta,
        trace,
      });

      expect(isErrorEnvelopeV1(envelope)).toBe(true);
    });

    it('should reject non-ERROR kind', () => {
      expect(
        isErrorEnvelopeV1({
          kind: 'SUCCESS',
          schemaVersion: '1',
          resolverName: 'probe.run',
          stepId: 'S1',
          errorCode: 'PROBE_FAILED',
          message: 'error',
          meta: mockMeta,
          storage: null,
          trace: [],
          details: null,
        })
      ).toBe(false);
    });

    it('should reject wrong schema version', () => {
      expect(
        isErrorEnvelopeV1({
          kind: 'ERROR',
          schemaVersion: '2',
          resolverName: 'probe.run',
          stepId: 'S1',
          errorCode: 'PROBE_FAILED',
          message: 'error',
          meta: mockMeta,
          storage: null,
          trace: [],
          details: null,
        })
      ).toBe(false);
    });

    it('should reject null/undefined', () => {
      expect(isErrorEnvelopeV1(null)).toBe(false);
      expect(isErrorEnvelopeV1(undefined)).toBe(false);
      expect(isErrorEnvelopeV1({})).toBe(false);
    });

    it('should reject missing required fields', () => {
      expect(
        isErrorEnvelopeV1({
          kind: 'ERROR',
          schemaVersion: '1',
          // Missing resolverName, stepId, etc.
        })
      ).toBe(false);
    });

    it('should reject invalid meta', () => {
      expect(
        isErrorEnvelopeV1({
          kind: 'ERROR',
          schemaVersion: '1',
          resolverName: 'probe.run',
          stepId: 'S1',
          errorCode: 'PROBE_FAILED',
          message: 'error',
          meta: null, // Invalid
          storage: null,
          trace: [],
          details: null,
        })
      ).toBe(false);
    });

    it('should reject invalid trace array', () => {
      expect(
        isErrorEnvelopeV1({
          kind: 'ERROR',
          schemaVersion: '1',
          resolverName: 'probe.run',
          stepId: 'S1',
          errorCode: 'PROBE_FAILED',
          message: 'error',
          meta: mockMeta,
          storage: null,
          trace: null, // Invalid: should be array
          details: null,
        })
      ).toBe(false);
    });
  });

  describe('validateErrorEnvelope', () => {
    it('should validate correct envelope', () => {
      const trace = [
        traceFail('probe.run', 'S1', 'PROBE_FAILED', 'Probe failed'),
      ];

      const envelope = makeErrorEnvelope({
        resolverName: 'probe.run',
        stepId: 'S1',
        errorCode: 'PROBE_FAILED',
        message: 'Probe failed',
        meta: mockMeta,
        trace,
      });

      const error = validateErrorEnvelope(envelope);
      expect(error).toBeNull();
    });

    it('should reject missing nowIso', () => {
      const trace = [
        traceFail('probe.run', 'S1', 'PROBE_FAILED', 'Probe failed'),
      ];

      // makeErrorEnvelope should throw when nowIso is empty
      expect(() => {
        makeErrorEnvelope({
          resolverName: 'probe.run',
          stepId: 'S1',
          errorCode: 'PROBE_FAILED',
          message: 'Probe failed',
          meta: { ...mockMeta, nowIso: '' },
          trace,
        });
      }).toThrow();
    });

    it('should reject empty trace', () => {
      const envelope = makeErrorEnvelope({
        resolverName: 'probe.run',
        stepId: 'S1',
        errorCode: 'PROBE_FAILED',
        message: 'error',
        meta: mockMeta,
        trace: [traceFail('probe.run', 'S1', 'PROBE_FAILED', 'Probe failed')],
      });

      // Manually empty the trace to test validator
      envelope.trace = [];
      const error = validateErrorEnvelope(envelope);
      expect(error).toBeTruthy();
    });
  });
});
