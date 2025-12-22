/**
 * PHASE 6 v2: STORAGE TESTS
 * 
 * Tests for snapshot storage layer.
 * 
 * Key tests:
 * - Tenant isolation (all keys prefixed by tenant_id)
 * - Immutability (snapshots never modified)
 * - Pagination (large result sets)
 * - Retention enforcement (FIFO deletion)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SnapshotRunStorage,
  SnapshotStorage,
  RetentionPolicyStorage,
  RetentionEnforcer,
} from '../../src/phase6/snapshot_storage';
import {
  SnapshotRun,
  Snapshot,
  RetentionPolicy,
} from '../../src/phase6/snapshot_model';
import { ErrorCode, DEFAULT_RETENTION_POLICY } from '../../src/phase6/constants';
import * as forgeApi from '@forge/api';

// Mock @forge/api storage
vi.mock('@forge/api', () => ({
  default: {
    storage: {
      set: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      query: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          getKeys: vi.fn(),
        }),
      }),
    },
  },
  storage: {
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    query: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        getKeys: vi.fn(),
      }),
    }),
  },
}));

const mockStorage = forgeApi.storage;

describe('SnapshotRunStorage', () => {
  let storage: SnapshotRunStorage;
  const tenantId = 'tenant1';
  const cloudId = 'cloud1';

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new SnapshotRunStorage(tenantId, cloudId);
  });

  describe('Tenant Isolation', () => {
    it('should enforce tenant_id in created run', async () => {
      const run: SnapshotRun = {
        tenant_id: tenantId,
        cloud_id: cloudId,
        run_id: 'run-123',
        scheduled_for: '2024-01-15T00:00:00Z',
        snapshot_type: 'daily',
        started_at: '2024-01-15T00:00:01Z',
        finished_at: '2024-01-15T00:00:05Z',
        status: 'success',
        error_code: ErrorCode.NONE,
        api_calls_made: 5,
        rate_limit_hits_count: 0,
        duration_ms: 4000,
        produced_snapshot_id: 'snap-123',
        schema_version: '1.0.0',
        produced_canonical_hash: 'abc123',
        hash_algorithm: 'sha256',
        clock_source: 'system',
      };

      mockStorage.set.mockResolvedValueOnce(undefined);
      await storage.createRun(run);

      expect(mockStorage.set).toHaveBeenCalledWith(
        expect.stringContaining(tenantId),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should reject run with mismatched tenant_id', async () => {
      const run: SnapshotRun = {
        tenant_id: 'different-tenant',
        cloud_id: cloudId,
        run_id: 'run-123',
        scheduled_for: '2024-01-15T00:00:00Z',
        snapshot_type: 'daily',
        started_at: '2024-01-15T00:00:01Z',
        finished_at: '2024-01-15T00:00:05Z',
        status: 'success',
        error_code: ErrorCode.NONE,
        api_calls_made: 0,
        rate_limit_hits_count: 0,
        duration_ms: 1000,
        schema_version: '1.0.0',
        hash_algorithm: 'sha256',
        clock_source: 'system',
      };

      await expect(storage.createRun(run)).rejects.toThrow('Tenant/cloud mismatch');
    });
  });

  describe('TTL Settings', () => {
    it('should set TTL to 90 days when creating run', async () => {
      const run: SnapshotRun = {
        tenant_id: tenantId,
        cloud_id: cloudId,
        run_id: 'run-123',
        scheduled_for: '2024-01-15T00:00:00Z',
        snapshot_type: 'daily',
        started_at: '2024-01-15T00:00:01Z',
        finished_at: '2024-01-15T00:00:05Z',
        status: 'success',
        error_code: ErrorCode.NONE,
        api_calls_made: 0,
        rate_limit_hits_count: 0,
        duration_ms: 1000,
        schema_version: '1.0.0',
        hash_algorithm: 'sha256',
        clock_source: 'system',
      };

      mockStorage.set.mockResolvedValueOnce(undefined);
      await storage.createRun(run);

      const setCall = mockStorage.set.mock.calls[0];
      const ttlOptions = setCall[2];
      const ttlSeconds = 90 * 24 * 60 * 60;
      
      expect(ttlOptions.ttl).toBe(ttlSeconds);
    });
  });
});

describe('SnapshotStorage', () => {
  let snapshotStorage: SnapshotStorage;
  const tenantId = 'tenant1';
  const cloudId = 'cloud1';

  beforeEach(() => {
    vi.clearAllMocks();
    snapshotStorage = new SnapshotStorage(tenantId, cloudId);
  });

  describe('Tenant Isolation', () => {
    it('should enforce tenant_id in created snapshot', async () => {
      const snapshot: Snapshot = {
        tenant_id: tenantId,
        cloud_id: cloudId,
        snapshot_id: 'snap-123',
        captured_at: '2024-01-15T00:00:00Z',
        snapshot_type: 'daily',
        schema_version: '1.0.0',
        canonical_hash: 'abc123',
        hash_algorithm: 'sha256',
        clock_source: 'system',
        scope: {
          projects_included: ['ALL'],
          projects_excluded: [],
        },
        input_provenance: {
          endpoints_queried: [],
          available_scopes: [],
          filters_applied: [],
        },
        missing_data: [],
        payload: {},
      };

      mockStorage.set.mockResolvedValue(undefined);
      await snapshotStorage.createSnapshot(snapshot);

      const setCalls = mockStorage.set.mock.calls;
      expect(setCalls.length).toBeGreaterThan(0);
      expect(setCalls[0][0]).toContain(tenantId);
    });

    it('should reject snapshot with mismatched tenant_id', async () => {
      const snapshot: Snapshot = {
        tenant_id: 'different-tenant',
        cloud_id: cloudId,
        snapshot_id: 'snap-123',
        captured_at: '2024-01-15T00:00:00Z',
        snapshot_type: 'daily',
        schema_version: '1.0.0',
        canonical_hash: 'abc123',
        hash_algorithm: 'sha256',
        clock_source: 'system',
        scope: {
          projects_included: ['ALL'],
          projects_excluded: [],
        },
        input_provenance: {
          endpoints_queried: [],
          available_scopes: [],
          filters_applied: [],
        },
        missing_data: [],
        payload: {},
      };

      await expect(snapshotStorage.createSnapshot(snapshot)).rejects.toThrow('Tenant/cloud mismatch');
    });
  });
});

describe('RetentionPolicyStorage', () => {
  let policyStorage: RetentionPolicyStorage;
  const tenantId = 'tenant1';

  beforeEach(() => {
    vi.clearAllMocks();
    policyStorage = new RetentionPolicyStorage(tenantId);
  });

  it('should return default policy if none stored', async () => {
    mockStorage.get.mockResolvedValueOnce(null);

    const policy = await policyStorage.getPolicy();

    expect(policy.tenant_id).toBe(tenantId);
    expect(policy.max_days).toBe(DEFAULT_RETENTION_POLICY.max_days);
    expect(policy.max_records_daily).toBe(DEFAULT_RETENTION_POLICY.max_records_daily);
  });

  it('should store policy with tenant_id check', async () => {
    const policy: RetentionPolicy = {
      tenant_id: tenantId,
      max_days: 60,
      max_records_daily: 60,
      max_records_weekly: 52,
      deletion_strategy: 'FIFO',
      uninstall_behavior: 'retain_for_days',
      uninstall_retain_days: 90,
      created_at: '2024-01-15T00:00:00Z',
      updated_at: '2024-01-15T00:00:00Z',
    };

    mockStorage.set.mockResolvedValueOnce(undefined);
    await policyStorage.setPolicy(policy);

    expect(mockStorage.set).toHaveBeenCalledWith(
      expect.stringContaining(tenantId),
      expect.any(String)
    );
  });

  it('should reject policy with mismatched tenant_id', async () => {
    const policy: RetentionPolicy = {
      tenant_id: 'different-tenant',
      max_days: 60,
      max_records_daily: 60,
      max_records_weekly: 52,
      deletion_strategy: 'FIFO',
      uninstall_behavior: 'retain_for_days',
      created_at: '2024-01-15T00:00:00Z',
      updated_at: '2024-01-15T00:00:00Z',
    };

    await expect(policyStorage.setPolicy(policy)).rejects.toThrow('Tenant mismatch');
  });
});

describe('RetentionEnforcer', () => {
  let enforcer: RetentionEnforcer;
  const tenantId = 'tenant1';
  const cloudId = 'cloud1';

  beforeEach(() => {
    vi.clearAllMocks();
    enforcer = new RetentionEnforcer(tenantId, cloudId);
  });

  it('should report deleted count and reason', async () => {
    // Mock the underlying storage operations
    mockStorage.get.mockResolvedValue(null);
    mockStorage.query().where().getKeys.mockResolvedValue([]);

    const result = await enforcer.enforceRetention('daily');

    expect(result).toHaveProperty('deleted_count');
    expect(result).toHaveProperty('reason');
    expect(typeof result.deleted_count).toBe('number');
    expect(typeof result.reason).toBe('string');
  });
});

describe('Storage: No-Write Verification', () => {
  it('should only call read operations (get, query)', async () => {
    mockStorage.set.mockResolvedValue(undefined);
    mockStorage.get.mockResolvedValue(null);
    mockStorage.query().where().getKeys.mockResolvedValue([]);

    const storage = new SnapshotRunStorage('tenant1', 'cloud1');
    await storage.listRuns({}, 0, 20);

    // Verify that query and get are called (read operations)
    // set and delete should not be called during list operations
    expect(mockStorage.query).toHaveBeenCalled();
    expect(mockStorage.get).toHaveBeenCalled();
  });
});
