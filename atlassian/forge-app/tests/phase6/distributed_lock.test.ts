/**
 * Tests for Distributed Lock (SEV-2-001)
 * 
 * Validates that snapshot deduplication race condition is fixed.
 * Two concurrent jobs for same tenant/window → only one snapshot created.
 * 
 * Note: These tests validate the logic and API surface.
 * Integration tests with real Forge storage are in integration test suite.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock @forge/api with proper state management
const mockStorageState: { [key: string]: string } = {};

vi.mock('@forge/api', () => {
  return {
    storage: {
      get: async (key: string) => {
        return mockStorageState[key] || null;
      },
      set: async (key: string, value: string, options?: any) => {
        mockStorageState[key] = value;
      },
      delete: async (key: string) => {
        delete mockStorageState[key];
      },
    },
  };
});

// Import after mocking @forge/api
import { DistributedLock, createSnapshotLock } from '../../src/phase6/distributed_lock';

describe('DistributedLock (SEV-2-001: Snapshot Deduplication)', () => {
  const tenantId = 'test-tenant-001';
  const snapshotType = 'daily' as const;
  const windowStartISO = '2025-01-15';

  beforeEach(async () => {
    // Clean up storage before each test
    Object.keys(mockStorageState).forEach(key => {
      delete mockStorageState[key];
    });
  });

  afterEach(async () => {
    // Clean up
  });

  it('should allow acquisition of a new lock', async () => {
    const lock = new DistributedLock(tenantId, snapshotType, windowStartISO);
    const acquired = await lock.acquire();
    
    expect(acquired).toBe(true);
    
    await lock.release();
  });

  it('should deny acquisition if lock already held', async () => {
    const lock1 = new DistributedLock(tenantId, snapshotType, windowStartISO);
    const lock2 = new DistributedLock(tenantId, snapshotType, windowStartISO);
    
    const acquired1 = await lock1.acquire();
    expect(acquired1).toBe(true);
    
    // Second lock should fail
    const acquired2 = await lock2.acquire();
    expect(acquired2).toBe(false);
    
    await lock1.release();
  });

  it('should allow reacquisition after release', async () => {
    const lock = new DistributedLock(tenantId, snapshotType, windowStartISO);
    
    const acquired1 = await lock.acquire();
    expect(acquired1).toBe(true);
    
    await lock.release();
    
    const acquired2 = await lock.acquire();
    expect(acquired2).toBe(true);
    
    await lock.release();
  });

  it('should support different tenant isolation', async () => {
    const lock1 = new DistributedLock('tenant-a', snapshotType, windowStartISO);
    const lock2 = new DistributedLock('tenant-b', snapshotType, windowStartISO);
    
    const acquired1 = await lock1.acquire();
    expect(acquired1).toBe(true);
    
    // Different tenant should succeed
    const acquired2 = await lock2.acquire();
    expect(acquired2).toBe(true);
    
    await lock1.release();
    await lock2.release();
  });

  it('should support different window start dates', async () => {
    const lock1 = new DistributedLock(tenantId, snapshotType, '2025-01-15');
    const lock2 = new DistributedLock(tenantId, snapshotType, '2025-01-16');
    
    const acquired1 = await lock1.acquire();
    expect(acquired1).toBe(true);
    
    // Different window should succeed
    const acquired2 = await lock2.acquire();
    expect(acquired2).toBe(true);
    
    await lock1.release();
    await lock2.release();
  });

  it('should support different snapshot types', async () => {
    const lock1 = new DistributedLock(tenantId, 'daily', windowStartISO);
    const lock2 = new DistributedLock(tenantId, 'weekly', windowStartISO);
    
    const acquired1 = await lock1.acquire();
    expect(acquired1).toBe(true);
    
    // Different snapshot type should succeed
    const acquired2 = await lock2.acquire();
    expect(acquired2).toBe(true);
    
    await lock1.release();
    await lock2.release();
  });

  it('should execute function within lock context', async () => {
    const lock = createSnapshotLock(tenantId, snapshotType, windowStartISO);
    let executed = false;

    const result = await lock.execute(async () => {
      executed = true;
      return 'success';
    });

    expect(executed).toBe(true);
    expect(result).toBe('success');
  });

  it('should return null if lock cannot be acquired in execute', async () => {
    const lock1 = new DistributedLock(tenantId, snapshotType, windowStartISO);
    const lock2 = new DistributedLock(tenantId, snapshotType, windowStartISO);
    
    await lock1.acquire();
    
    let executed = false;
    const result = await lock2.execute(async () => {
      executed = true;
      return 'success';
    });

    expect(executed).toBe(false);
    expect(result).toBeNull();
    
    await lock1.release();
  });

  it('should release lock even if function throws error', async () => {
    const lock1 = new DistributedLock(tenantId, snapshotType, windowStartISO);
    const lock2 = new DistributedLock(tenantId, snapshotType, windowStartISO);

    try {
      await lock1.execute(async () => {
        throw new Error('Test error');
      });
    } catch {
      // Expected
    }

    // Should be able to acquire lock after error
    const acquired = await lock2.acquire();
    expect(acquired).toBe(true);
    
    await lock2.release();
  });

  it('should not release locks held by other processes', async () => {
    const lock1 = new DistributedLock(tenantId, snapshotType, windowStartISO);
    const lock2 = new DistributedLock(tenantId, snapshotType, windowStartISO);

    await lock1.acquire();
    await lock2.release(); // Try to release a lock we don't hold
    
    // lock1 should still be held
    const acquired = await lock2.acquire();
    expect(acquired).toBe(false);
    
    await lock1.release();
  });
});
