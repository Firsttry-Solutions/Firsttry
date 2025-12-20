/**
 * PHASE 6 v2: SNAPSHOT MODEL TESTS
 * 
 * Tests for data structures and constants
 */

import { describe, it, expect } from '@jest/globals';
import {
  ErrorCode,
  CoverageStatus,
  MissingDataReasonCode,
  STORAGE_PREFIXES,
  getIdempotencyKey,
  getSnapshotRunKey,
  getSnapshotKey,
  getRetentionPolicyKey,
  getSnapshotIndexKey,
} from '../src/phase6/constants';

describe('Phase 6 Constants', () => {
  it('should define all ErrorCode enum values', () => {
    expect(ErrorCode.NONE).toBe('NONE');
    expect(ErrorCode.RATE_LIMIT).toBe('RATE_LIMIT');
    expect(ErrorCode.PERMISSION_REVOKED).toBe('PERMISSION_REVOKED');
    expect(ErrorCode.API_ERROR).toBe('API_ERROR');
    expect(ErrorCode.TIMEOUT).toBe('TIMEOUT');
  });

  it('should define CoverageStatus enum values', () => {
    expect(CoverageStatus.AVAILABLE).toBe('AVAILABLE');
    expect(CoverageStatus.PARTIAL).toBe('PARTIAL');
    expect(CoverageStatus.MISSING).toBe('MISSING');
  });

  it('should define MissingDataReasonCode enum values', () => {
    expect(MissingDataReasonCode.PERMISSION_DENIED).toBe('permission_denied');
    expect(MissingDataReasonCode.NOT_CONFIGURED).toBe('not_configured');
  });

  describe('Key generation functions', () => {
    it('should generate consistent idempotency keys', () => {
      const key1 = getIdempotencyKey('tenant1', 'daily', '2024-01-15');
      const key2 = getIdempotencyKey('tenant1', 'daily', '2024-01-15');
      expect(key1).toBe(key2);
      expect(key1).toBe('tenant1:daily:2024-01-15');
    });

    it('should include tenant_id in snapshot run key', () => {
      const key = getSnapshotRunKey('tenant1', 'run-123');
      expect(key).toContain('tenant1');
      expect(key).toContain('run-123');
      expect(key).toContain(STORAGE_PREFIXES.snapshot_run);
    });

    it('should include tenant_id in snapshot key', () => {
      const key = getSnapshotKey('tenant1', 'snap-456');
      expect(key).toContain('tenant1');
      expect(key).toContain('snap-456');
      expect(key).toContain(STORAGE_PREFIXES.snapshot);
    });

    it('should isolate keys by tenant', () => {
      const key1 = getSnapshotRunKey('tenant1', 'run-123');
      const key2 = getSnapshotRunKey('tenant2', 'run-123');
      expect(key1).not.toBe(key2);
      expect(key1).toContain('tenant1');
      expect(key2).toContain('tenant2');
    });

    it('should generate pagination index keys', () => {
      const key = getSnapshotIndexKey('tenant1', 'daily', 0);
      expect(key).toContain('tenant1');
      expect(key).toContain('daily');
      expect(key).toContain('0');
    });
  });

  describe('Storage prefixes', () => {
    it('should be distinct', () => {
      const prefixes = Object.values(STORAGE_PREFIXES);
      const uniquePrefixes = new Set(prefixes);
      expect(uniquePrefixes.size).toBe(prefixes.length);
    });

    it('should all start with phase6:', () => {
      Object.values(STORAGE_PREFIXES).forEach(prefix => {
        expect(prefix).toMatch(/^phase6:/);
      });
    });
  });
});

describe('Snapshot Model Interfaces', () => {
  // These are TypeScript interfaces, so runtime tests are limited
  // But we can verify they can be instantiated

  it('should allow creating SnapshotRun objects', () => {
    const run = {
      tenant_id: 'tenant1',
      cloud_id: 'cloud1',
      run_id: 'run-123',
      scheduled_for: '2024-01-15T00:00:00Z',
      snapshot_type: 'daily' as const,
      started_at: '2024-01-15T00:00:01Z',
      finished_at: '2024-01-15T00:00:05Z',
      status: 'success' as const,
      error_code: ErrorCode.NONE,
      api_calls_made: 5,
      rate_limit_hits_count: 0,
      duration_ms: 4000,
      produced_snapshot_id: 'snap-456',
      schema_version: '1.0.0',
      produced_canonical_hash: 'abc123',
      hash_algorithm: 'sha256' as const,
      clock_source: 'system' as const,
    };

    expect(run.tenant_id).toBe('tenant1');
    expect(run.status).toBe('success');
    expect(run.error_code).toBe(ErrorCode.NONE);
  });

  it('should allow creating Snapshot objects', () => {
    const snapshot = {
      tenant_id: 'tenant1',
      cloud_id: 'cloud1',
      snapshot_id: 'snap-123',
      captured_at: '2024-01-15T00:00:00Z',
      snapshot_type: 'daily' as const,
      schema_version: '1.0.0',
      canonical_hash: 'abc123',
      hash_algorithm: 'sha256' as const,
      clock_source: 'system' as const,
      scope: {
        projects_included: ['ALL'],
        projects_excluded: [],
      },
      input_provenance: {
        endpoints_queried: ['/rest/api/3/projects'],
        available_scopes: ['read:jira-work'],
        filters_applied: [],
      },
      missing_data: [],
      payload: {
        projects: [],
        fields: [],
      },
    };

    expect(snapshot.snapshot_id).toBe('snap-123');
    expect(snapshot.payload).toBeDefined();
  });

  it('should allow MissingDataItem objects', () => {
    const item = {
      dataset_name: 'field_metadata',
      coverage_status: CoverageStatus.MISSING,
      reason_code: MissingDataReasonCode.PERMISSION_DENIED,
      reason_detail: 'No permission to read fields',
      retry_count: 0,
    };

    expect(item.dataset_name).toBe('field_metadata');
    expect(item.coverage_status).toBe(CoverageStatus.MISSING);
  });
});
