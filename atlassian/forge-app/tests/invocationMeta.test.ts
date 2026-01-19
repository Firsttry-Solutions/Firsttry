import { describe, it, expect } from 'vitest';
import { buildInvocationMeta } from '../src/security/invocationMeta';

describe('buildInvocationMeta', () => {
  it('should always set nowIso', () => {
    const before = new Date().toISOString();
    const meta = buildInvocationMeta({});
    const after = new Date().toISOString();

    expect(meta.nowIso).toBeTruthy();
    expect(meta.nowIso >= before).toBe(true);
    expect(meta.nowIso <= after).toBe(true);
  });

  it('should set uiReqId from argument', () => {
    const meta = buildInvocationMeta({ uiReqId: 'test-id-123' });
    expect(meta.uiReqId).toBe('test-id-123');
  });

  it('should set uiReqId to null if not provided', () => {
    const meta = buildInvocationMeta({});
    expect(meta.uiReqId).toBeNull();
  });

  it('should extract traceId from ctx.traceId', () => {
    const meta = buildInvocationMeta({ ctx: { traceId: 'trace-123' } });
    expect(meta.traceId).toBe('trace-123');
  });

  it('should extract requestId from ctx.requestId', () => {
    const meta = buildInvocationMeta({ ctx: { requestId: 'req-456' } });
    expect(meta.requestId).toBe('req-456');
  });

  it('should extract invocationId from ctx.invocationId', () => {
    const meta = buildInvocationMeta({ ctx: { invocationId: 'inv-789' } });
    expect(meta.invocationId).toBe('inv-789');
  });

  it('should set all IDs to null when ctx is empty', () => {
    const meta = buildInvocationMeta({ ctx: {} });
    expect(meta.traceId).toBeNull();
    expect(meta.requestId).toBeNull();
    expect(meta.invocationId).toBeNull();
  });

  it('should try alternative paths for traceId', () => {
    const meta = buildInvocationMeta({
      ctx: { traceContext: { traceId: 'trace-alt' } },
    });
    expect(meta.traceId).toBe('trace-alt');
  });

  it('should handle undefined ctx', () => {
    const meta = buildInvocationMeta({ ctx: undefined });
    expect(meta.traceId).toBeNull();
    expect(meta.requestId).toBeNull();
    expect(meta.invocationId).toBeNull();
    expect(meta.nowIso).toBeTruthy();
  });
});
