import { describe, it, expect } from 'vitest';
import { traceOk, traceFail } from '../src/security/stepTrace';

describe('stepTrace', () => {
  describe('traceOk', () => {
    it('should create successful step', () => {
      const step = traceOk('probe.run', 'S1_INIT', 'Initializing probe');

      expect(step.resolverName).toBe('probe.run');
      expect(step.stepId).toBe('S1_INIT');
      expect(step.message).toBe('Initializing probe');
      expect(step.ok).toBe(true);
      expect(step.errorCode).toBeNull();
      expect(step.atIso).toBeTruthy();
    });

    it('should set current timestamp', () => {
      const before = new Date().toISOString();
      const step = traceOk('test.resolver', 'S1', 'test');
      const after = new Date().toISOString();

      expect(step.atIso >= before).toBe(true);
      expect(step.atIso <= after).toBe(true);
    });
  });

  describe('traceFail', () => {
    it('should create failed step with error code', () => {
      const step = traceFail(
        'probe.run',
        'S2_STORAGE',
        'STORAGE_READ_FAILED',
        'Failed to read storage'
      );

      expect(step.resolverName).toBe('probe.run');
      expect(step.stepId).toBe('S2_STORAGE');
      expect(step.message).toBe('Failed to read storage');
      expect(step.ok).toBe(false);
      expect(step.errorCode).toBe('STORAGE_READ_FAILED');
      expect(step.atIso).toBeTruthy();
    });

    it('should set current timestamp', () => {
      const before = new Date().toISOString();
      const step = traceFail('test.resolver', 'S1', 'UNKNOWN_ERROR', 'error');
      const after = new Date().toISOString();

      expect(step.atIso >= before).toBe(true);
      expect(step.atIso <= after).toBe(true);
    });
  });
});
