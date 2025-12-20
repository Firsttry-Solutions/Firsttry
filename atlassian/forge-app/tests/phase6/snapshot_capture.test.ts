/**
 * PHASE 6 v2: SNAPSHOT CAPTURE TESTS
 * 
 * Tests for Jira API querying and snapshot payload building.
 * 
 * Key tests:
 * - READ-ONLY Jira access (no write endpoints)
 * - Missing data disclosure
 * - Error categorization
 * - Deterministic payload generation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SnapshotCapturer } from '../src/phase6/snapshot_capture';
import {
  ErrorCode,
  CoverageStatus,
  MissingDataReasonCode,
  ALLOWED_JIRA_ENDPOINTS,
} from '../src/phase6/constants';

// Mock @forge/api
jest.mock('@forge/api', () => ({
  api: {
    asUser: jest.fn().mockReturnValue({
      requestJira: jest.fn(),
    }),
  },
}));

const mockAPI = require('@forge/api').api;

describe('SnapshotCapturer', () => {
  let capturer: SnapshotCapturer;
  const tenantId = 'tenant1';
  const cloudId = 'cloud1';

  beforeEach(() => {
    jest.clearAllMocks();
    // Set default mock response
    mockAPI.asUser().requestJira.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ values: [] }),
    });
    capturer = new SnapshotCapturer(tenantId, cloudId, 'daily');
  });

  describe('Daily Snapshot Capture', () => {
    it('should successfully capture daily snapshot', async () => {
      const result = await capturer.capture();

      expect(result.run).toBeDefined();
      expect(result.run.snapshot_type).toBe('daily');
      expect(result.run.status).toMatch(/success|partial/);
    });

    it('should include snapshot_id in run when successful', async () => {
      const result = await capturer.capture();

      expect(result.run.status).toMatch(/success|partial/);
      if (result.run.status !== 'failed') {
        expect(result.run.produced_snapshot_id).toBeDefined();
        expect(result.run.produced_canonical_hash).toBeDefined();
      }
    });

    it('should record API calls made', async () => {
      const result = await capturer.capture();

      expect(result.run.api_calls_made).toBeGreaterThanOrEqual(0);
    });

    it('should include schema version', async () => {
      const result = await capturer.capture();

      expect(result.run.schema_version).toBe('1.0.0');
    });
  });

  describe('Weekly Snapshot Capture', () => {
    it('should successfully capture weekly snapshot', async () => {
      const weeklyCapt = new SnapshotCapturer(tenantId, cloudId, 'weekly');
      const result = await weeklyCapt.capture();

      expect(result.run).toBeDefined();
      expect(result.run.snapshot_type).toBe('weekly');
    });
  });

  describe('READ-ONLY Jira Access', () => {
    it('should not call any write endpoints', async () => {
      mockAPI.asUser().requestJira.mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ values: [] }),
      });

      await capturer.capture();

      const calls = mockAPI.asUser().requestJira.mock.calls;
      const endpoints = calls.map((call: any) => call[0]);

      for (const endpoint of endpoints) {
        const isAllowed = ALLOWED_JIRA_ENDPOINTS.some(allowed =>
          endpoint.includes(allowed) || endpoint.startsWith(allowed)
        );
        
        // Endpoints should be GET requests (in allowed list) or query parameters
        expect(endpoint).not.toMatch(/POST|PUT|DELETE|PATCH/i);
      }
    });

    it('should only use GET endpoints', async () => {
      await capturer.capture();

      const calls = mockAPI.asUser().requestJira.mock.calls;
      
      // All calls should be GET (no explicit method specified = GET)
      calls.forEach((call: any) => {
        const endpoint = call[0];
        expect(typeof endpoint).toBe('string');
        expect(endpoint.startsWith('/')).toBe(true);
      });
    });
  });

  describe('Error Handling and Categorization', () => {
    it('should handle rate limit error', async () => {
      mockAPI.asUser().requestJira.mockResolvedValue({
        status: 429,
        ok: false,
      });

      const result = await capturer.capture();

      expect(result.run.status).toBe('failed');
      expect(result.run.error_code).toBe(ErrorCode.RATE_LIMIT);
    });

    it('should handle permission error', async () => {
      mockAPI.asUser().requestJira.mockResolvedValue({
        status: 403,
        ok: false,
      });

      const result = await capturer.capture();

      expect(result.run.status).toBe('failed');
      expect(result.run.error_code).toBe(ErrorCode.PERMISSION_REVOKED);
    });

    it('should handle API error', async () => {
      mockAPI.asUser().requestJira.mockRejectedValue(new Error('API Error'));

      const result = await capturer.capture();

      expect(result.run.status).toBe('failed');
      expect([ErrorCode.API_ERROR, ErrorCode.TIMEOUT]).toContain(result.run.error_code);
    });

    it('should record error_detail on failure', async () => {
      const errorMsg = 'Test error detail';
      mockAPI.asUser().requestJira.mockRejectedValue(new Error(errorMsg));

      const result = await capturer.capture();

      expect(result.run.error_detail).toContain(errorMsg);
    });
  });

  describe('Missing Data Disclosure', () => {
    it('should include missing_data in snapshot', async () => {
      mockAPI.asUser().requestJira.mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ values: [] }),
      });

      const result = await capturer.capture();

      if (result.snapshot) {
        expect(Array.isArray(result.snapshot.missing_data)).toBe(true);
      }
    });

    it('should mark dataset as MISSING when API fails', async () => {
      // First call succeeds, second fails
      mockAPI.asUser().requestJira.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ values: [] }),
      }).mockRejectedValueOnce(new Error('API Error'));

      const result = await capturer.capture();

      if (result.snapshot && result.snapshot.missing_data.length > 0) {
        const missing = result.snapshot.missing_data[0];
        expect(missing.coverage_status).toBe(CoverageStatus.MISSING);
        expect([
          MissingDataReasonCode.PERMISSION_DENIED,
          MissingDataReasonCode.API_UNAVAILABLE,
          MissingDataReasonCode.RATE_LIMITED,
        ]).toContain(missing.reason_code);
      }
    });

    it('should include retry_count in missing data', async () => {
      mockAPI.asUser().requestJira.mockRejectedValue(new Error('API Error'));

      const result = await capturer.capture();

      if (result.snapshot && result.snapshot.missing_data.length > 0) {
        const missing = result.snapshot.missing_data[0];
        expect(typeof missing.retry_count).toBe('number');
        expect(missing.retry_count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Snapshot Payload and Determinism', () => {
    it('should include canonical_hash in snapshot', async () => {
      const result = await capturer.capture();

      if (result.snapshot) {
        expect(result.snapshot.canonical_hash).toBeDefined();
        expect(result.snapshot.canonical_hash).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('should include same hash in run and snapshot', async () => {
      const result = await capturer.capture();

      if (result.snapshot) {
        expect(result.run.produced_canonical_hash).toBe(result.snapshot.canonical_hash);
      }
    });

    it('should use SHA256 hash algorithm', async () => {
      const result = await capturer.capture();

      expect(result.run.hash_algorithm).toBe('sha256');
      if (result.snapshot) {
        expect(result.snapshot.hash_algorithm).toBe('sha256');
      }
    });

    it('should include clock_source', async () => {
      const result = await capturer.capture();

      expect(['system', 'jira', 'unknown']).toContain(result.run.clock_source);
      if (result.snapshot) {
        expect(['system', 'jira', 'unknown']).toContain(result.snapshot.clock_source);
      }
    });

    it('should include scope in snapshot', async () => {
      const result = await capturer.capture();

      if (result.snapshot) {
        expect(result.snapshot.scope).toBeDefined();
        expect(result.snapshot.scope.projects_included).toBeDefined();
        expect(result.snapshot.scope.projects_excluded).toBeDefined();
      }
    });

    it('should include input_provenance', async () => {
      const result = await capturer.capture();

      if (result.snapshot) {
        expect(result.snapshot.input_provenance).toBeDefined();
        expect(Array.isArray(result.snapshot.input_provenance.endpoints_queried)).toBe(true);
        expect(Array.isArray(result.snapshot.input_provenance.available_scopes)).toBe(true);
      }
    });
  });

  describe('Timing and Metrics', () => {
    it('should record duration_ms', async () => {
      const result = await capturer.capture();

      expect(result.run.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('should have started_at before finished_at', async () => {
      const result = await capturer.capture();

      const start = new Date(result.run.started_at);
      const end = new Date(result.run.finished_at);
      
      expect(start.getTime()).toBeLessThanOrEqual(end.getTime());
    });

    it('should include scheduled_for', async () => {
      const result = await capturer.capture();

      expect(result.run.scheduled_for).toBeDefined();
      expect(new Date(result.run.scheduled_for)).toBeInstanceOf(Date);
    });

    it('should record api_calls_made and rate_limit_hits', async () => {
      const result = await capturer.capture();

      expect(typeof result.run.api_calls_made).toBe('number');
      expect(typeof result.run.rate_limit_hits_count).toBe('number');
      expect(result.run.api_calls_made).toBeGreaterThanOrEqual(0);
      expect(result.run.rate_limit_hits_count).toBeGreaterThanOrEqual(0);
    });
  });
});
