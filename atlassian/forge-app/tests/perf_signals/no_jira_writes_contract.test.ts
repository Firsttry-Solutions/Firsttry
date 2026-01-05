/**
 * GET-ONLY ENFORCEMENT CONTRACT
 * 
 * Verify jira_get_wrapper enforces GET semantics:
 * - Throws on POST/PUT/PATCH/DELETE attempts
 * - Records latency + rate limit headers only
 * - Does not leak secrets or URLs
 * - FIFO buffer evicts at 500 records
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { RequestRecord } from '../../src/core/perf_signals/jira_get_wrapper';
import {
  recordRequest,
  getRecordedRequests,
  clearRecordedRequests,
  wrapJiraGetForInstrumentation,
} from '../../src/core/perf_signals/jira_get_wrapper';

describe('GET-Only Enforcement Contract', () => {
  beforeEach(() => {
    clearRecordedRequests();
  });

  describe('recordRequest', () => {
    it('records request with latency', () => {
      const record: RequestRecord = {
        durationMs: 150,
        ok: true,
        rateLimitRemaining: 999,
      };
      recordRequest(record);
      
      const requests = getRecordedRequests();
      expect(requests.length).toBe(1);
      expect(requests[0].durationMs).toBe(150);
      expect(requests[0].ok).toBe(true);
    });

    it('does not store URL', () => {
      const record: RequestRecord = {
        durationMs: 100,
        ok: true,
      };
      recordRequest(record);
      
      const requests = getRecordedRequests();
      expect(requests[0]).not.toHaveProperty('url');
      expect(requests[0]).not.toHaveProperty('endpoint');
      expect(requests[0]).not.toHaveProperty('path');
    });

    it('does not store request body', () => {
      const record: RequestRecord = {
        durationMs: 100,
        ok: true,
      };
      recordRequest(record);
      
      const requests = getRecordedRequests();
      expect(requests[0]).not.toHaveProperty('body');
      expect(requests[0]).not.toHaveProperty('payload');
    });

    it('stores rate limit headers', () => {
      const record: RequestRecord = {
        durationMs: 100,
        ok: true,
        rateLimitRemaining: 500,
        rateLimitLimit: 1000,
        rateLimitResetEpochSeconds: 1234567890,
      };
      recordRequest(record);
      
      const requests = getRecordedRequests();
      expect(requests[0].rateLimitRemaining).toBe(500);
      expect(requests[0].rateLimitLimit).toBe(1000);
      expect(requests[0].rateLimitResetEpochSeconds).toBe(1234567890);
    });

    it('maintains FIFO buffer (evicts oldest at 500 limit)', () => {
      for (let i = 0; i < 505; i++) {
        recordRequest({
          durationMs: 100,
          ok: true,
        });
      }
      
      const requests = getRecordedRequests();
      expect(requests.length).toBe(500);
    });

    it('preserves insertion order in FIFO', () => {
      recordRequest({ durationMs: 100, ok: true });
      recordRequest({ durationMs: 200, ok: true });
      recordRequest({ durationMs: 300, ok: true });
      
      const requests = getRecordedRequests();
      expect(requests[0].durationMs).toBe(100);
      expect(requests[1].durationMs).toBe(200);
      expect(requests[2].durationMs).toBe(300);
    });
  });

  describe('wrapJiraGetForInstrumentation', () => {
    it('allows GET requests', async () => {
      const mockRequestJira = vi.fn().mockResolvedValue({
        ok: true,
        headers: {},
      });
      
      const wrapped = wrapJiraGetForInstrumentation(mockRequestJira);
      const result = await wrapped('/rest/api/3/fields', { method: 'GET' });
      
      expect(result.ok).toBe(true);
      expect(mockRequestJira).toHaveBeenCalled();
    });

    it('throws on POST request', async () => {
      const mockRequestJira = vi.fn();
      const wrapped = wrapJiraGetForInstrumentation(mockRequestJira);
      
      await expect(wrapped('/path', { method: 'POST' })).rejects.toThrow('NON_GET_BLOCKED');
      expect(mockRequestJira).not.toHaveBeenCalled();
    });

    it('throws on PUT request', async () => {
      const mockRequestJira = vi.fn();
      const wrapped = wrapJiraGetForInstrumentation(mockRequestJira);
      
      await expect(wrapped('/path', { method: 'PUT' })).rejects.toThrow('NON_GET_BLOCKED');
      expect(mockRequestJira).not.toHaveBeenCalled();
    });

    it('throws on PATCH request', async () => {
      const mockRequestJira = vi.fn();
      const wrapped = wrapJiraGetForInstrumentation(mockRequestJira);
      
      await expect(wrapped('/path', { method: 'PATCH' })).rejects.toThrow('NON_GET_BLOCKED');
      expect(mockRequestJira).not.toHaveBeenCalled();
    });

    it('throws on DELETE request', async () => {
      const mockRequestJira = vi.fn();
      const wrapped = wrapJiraGetForInstrumentation(mockRequestJira);
      
      await expect(wrapped('/path', { method: 'DELETE' })).rejects.toThrow('NON_GET_BLOCKED');
      expect(mockRequestJira).not.toHaveBeenCalled();
    });

    it('records latency on successful request', async () => {
      const mockRequestJira = vi.fn().mockResolvedValue({
        ok: true,
        headers: {},
      });
      
      const wrapped = wrapJiraGetForInstrumentation(mockRequestJira);
      await wrapped('/path');
      
      const requests = getRecordedRequests();
      expect(requests.length).toBe(1);
      expect(requests[0].durationMs).toBeGreaterThanOrEqual(0);
      expect(requests[0].ok).toBe(true);
    });

    it('records latency even on failed request', async () => {
      const mockRequestJira = vi.fn().mockRejectedValue(new Error('API Error'));
      
      const wrapped = wrapJiraGetForInstrumentation(mockRequestJira);
      
      try {
        await wrapped('/path');
      } catch {
        // Expected to throw
      }
      
      const requests = getRecordedRequests();
      expect(requests.length).toBe(1);
      expect(requests[0].durationMs).toBeGreaterThanOrEqual(0);
      expect(requests[0].ok).toBe(false);
    });

    it('extracts rate limit headers from response', async () => {
      const mockRequestJira = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          'x-ratelimit-remaining': '500',
          'x-ratelimit-limit': '1000',
        },
      });
      
      const wrapped = wrapJiraGetForInstrumentation(mockRequestJira);
      await wrapped('/path');
      
      const requests = getRecordedRequests();
      expect(requests[0].rateLimitRemaining).toBe(500);
      expect(requests[0].rateLimitLimit).toBe(1000);
    });

    it('does not leak response body in records', async () => {
      const sensitiveResponse = {
        ok: true,
        headers: {},
        body: { secret: 'token123', apiKey: 'key456' },
      };
      const mockRequestJira = vi.fn().mockResolvedValue(sensitiveResponse);
      
      const wrapped = wrapJiraGetForInstrumentation(mockRequestJira);
      await wrapped('/path');
      
      const requests = getRecordedRequests();
      expect(JSON.stringify(requests[0])).not.toContain('secret');
      expect(JSON.stringify(requests[0])).not.toContain('token123');
      expect(JSON.stringify(requests[0])).not.toContain('apiKey');
    });

    it('sets method to GET before calling requestJira', async () => {
      const mockRequestJira = vi.fn().mockResolvedValue({
        ok: true,
        headers: {},
      });
      
      const wrapped = wrapJiraGetForInstrumentation(mockRequestJira);
      await wrapped('/path', {}); // no method specified, should default to GET
      
      // Verify requestJira was called with GET
      expect(mockRequestJira).toHaveBeenCalledWith('/path', expect.objectContaining({ method: 'GET' }));
    });
  });
});
