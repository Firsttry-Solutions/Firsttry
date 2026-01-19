import { describe, it, expect } from 'vitest';
import { makeErrorEnvelope } from '../src/security/errorEnvelope';
import { traceOk, traceFail } from '../src/security/stepTrace';
import type { InvocationMetaV1 } from '../src/shared/invocationEnvelope';

describe('errorEnvelope', () => {
  const mockMeta: InvocationMetaV1 = {
    traceId: 'trace-123',
    requestId: 'req-456',
    invocationId: 'inv-789',
    uiReqId: 'ui-111',
    nowIso: new Date().toISOString(),
  };

  it('should create error envelope with required fields', () => {
    const trace = [
      traceFail('probe.run', 'S1_INIT', 'PROBE_FAILED', 'Probe initialization failed'),
    ];

    const envelope = makeErrorEnvelope({
      resolverName: 'probe.run',
      stepId: 'S1_INIT',
      errorCode: 'PROBE_FAILED',
      message: 'Probe initialization failed',
      meta: mockMeta,
      trace,
    });

    expect(envelope.kind).toBe('ERROR');
    expect(envelope.schemaVersion).toBe('1');
    expect(envelope.resolverName).toBe('probe.run');
    expect(envelope.stepId).toBe('S1_INIT');
    expect(envelope.errorCode).toBe('PROBE_FAILED');
    expect(envelope.message).toBe('Probe initialization failed');
    expect(envelope.meta).toEqual(mockMeta);
    expect(envelope.trace).toHaveLength(1);
    expect(envelope.storage).toBeNull();
    expect(envelope.details).toBeNull();
  });

  it('should include storage proof when provided', () => {
    const trace = [
      traceFail('probe.run', 'S2_STORAGE', 'STORAGE_READ_FAILED', 'Storage read failed'),
    ];

    const storageProof = {
      state: 'EMPTY' as const,
      checkedAtIso: new Date().toISOString(),
      proof: 'MISSING_ALL',
      keysChecked: ['snapshots/latest'],
      errors: [],
    };

    const envelope = makeErrorEnvelope({
      resolverName: 'probe.run',
      stepId: 'S2_STORAGE',
      errorCode: 'STORAGE_READ_FAILED',
      message: 'Storage read failed',
      meta: mockMeta,
      storage: storageProof,
      trace,
    });

    expect(envelope.storage).toEqual(storageProof);
  });

  it('should include trace steps', () => {
    const trace = [
      traceOk('probe.run', 'S1_INIT', 'Probe initialized'),
      traceOk('probe.run', 'S2_TENANT', 'Tenant verified'),
      traceFail('probe.run', 'S3_STORAGE', 'STORAGE_READ_FAILED', 'Storage check failed'),
    ];

    const envelope = makeErrorEnvelope({
      resolverName: 'probe.run',
      stepId: 'S3_STORAGE',
      errorCode: 'STORAGE_READ_FAILED',
      message: 'Storage read failed',
      meta: mockMeta,
      trace,
    });

    expect(envelope.trace).toHaveLength(3);
    expect(envelope.trace[0].ok).toBe(true);
    expect(envelope.trace[1].ok).toBe(true);
    expect(envelope.trace[2].ok).toBe(false);
    expect(envelope.trace[2].errorCode).toBe('STORAGE_READ_FAILED');
  });

  it('should include details when provided', () => {
    const trace = [
      traceFail('probe.run', 'S1', 'UNKNOWN_ERROR', 'Unknown error'),
    ];

    const details = {
      errorType: 'RuntimeError',
      errorStack: 'Error at line 42',
    };

    const envelope = makeErrorEnvelope({
      resolverName: 'probe.run',
      stepId: 'S1',
      errorCode: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
      meta: mockMeta,
      trace,
      details,
    });

    expect(envelope.details).toEqual(details);
  });

  it('should throw error if trace is empty', () => {
    expect(() => {
      makeErrorEnvelope({
        resolverName: 'probe.run',
        stepId: 'S1',
        errorCode: 'UNKNOWN_ERROR',
        message: 'Error',
        meta: mockMeta,
        trace: [], // Empty trace!
      });
    }).toThrow();
  });

  it('should throw error if meta.nowIso missing', () => {
    const invalidMeta = { ...mockMeta, nowIso: '' };
    const trace = [
      traceFail('probe.run', 'S1', 'UNKNOWN_ERROR', 'Error'),
    ];

    expect(() => {
      makeErrorEnvelope({
        resolverName: 'probe.run',
        stepId: 'S1',
        errorCode: 'UNKNOWN_ERROR',
        message: 'Error',
        meta: invalidMeta,
        trace,
      });
    }).toThrow();
  });

  it('should normalize null details', () => {
    const trace = [
      traceFail('probe.run', 'S1', 'UNKNOWN_ERROR', 'Error'),
    ];

    const envelope = makeErrorEnvelope({
      resolverName: 'probe.run',
      stepId: 'S1',
      errorCode: 'UNKNOWN_ERROR',
      message: 'Error',
      meta: mockMeta,
      trace,
      details: null,
    });

    expect(envelope.details).toBeNull();
  });
});
