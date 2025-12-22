/**
 * PHASE 6 v2: SNAPSHOT STORAGE LAYER
 * 
 * CRUD operations for snapshots using @forge/api requestStorage.
 * 
 * Principles:
 * - Tenant isolation (all keys prefixed by tenant_id)
 * - Immutable snapshots (no updates after creation)
 * - Append-only ledger (new runs/snapshots appended)
 * - FIFO auto-deletion on max_records exceeded
 * - TTL-based auto-purge on max_days exceeded
 */

import { storage, api } from '@forge/api';
import {
  Snapshot,
  SnapshotRun,
  RetentionPolicy,
  SnapshotPageResult,
  SnapshotRunFilters,
  SnapshotFilters,
} from './snapshot_model';
import {
  getSnapshotRunKey,
  getSnapshotKey,
  getRetentionPolicyKey,
  getSnapshotIndexKey,
  DEFAULT_RETENTION_POLICY,
  type SnapshotType,
} from './constants';
import { computeCanonicalHash } from './canonicalization';
import { createSnapshotLock } from './distributed_lock';

/**
 * Snapshot Run Storage
 */
export class SnapshotRunStorage {
  constructor(
    private tenantId: string,
    private cloudId: string,
  ) {}

  /**
   * Create a new snapshot run record
   */
  async createRun(run: SnapshotRun): Promise<SnapshotRun> {
    if (run.tenant_id !== this.tenantId || run.cloud_id !== this.cloudId) {
      throw new Error('Tenant/cloud mismatch');
    }

    const key = getSnapshotRunKey(this.tenantId, run.run_id);
    const ttl = 90 * 24 * 60 * 60; // 90 days in seconds
    
    await storage.set(key, JSON.stringify(run), { ttl });
    return run;
  }

  /**
   * Get a snapshot run by ID
   */
  async getRunById(runId: string): Promise<SnapshotRun | null> {
    const key = getSnapshotRunKey(this.tenantId, runId);
    const data = await storage.get(key);
    return data ? JSON.parse(data as string) : null;
  }

  /**
   * List snapshot runs with optional filters
   * Returns paginated results
   */
  async listRuns(
    filters?: SnapshotRunFilters,
    page: number = 0,
    pageSize: number = 20,
  ): Promise<SnapshotPageResult<SnapshotRun>> {
    // Note: In production, this would use a proper index key.
    // For MVP, we scan by prefix (requires async iteration).
    // This is a simplified implementation.
    
    const prefix = getSnapshotRunKey(this.tenantId, '');
    const keys = await storage.query().where('key', 'like', prefix).getKeys();
    
    let runs: SnapshotRun[] = [];
    for (const key of keys) {
      const data = await storage.get(key);
      if (data) {
        runs.push(JSON.parse(data as string));
      }
    }

    // Apply filters
    if (filters?.snapshot_type) {
      runs = runs.filter(r => r.snapshot_type === filters.snapshot_type);
    }
    if (filters?.status) {
      runs = runs.filter(r => r.status === filters.status);
    }
    if (filters?.error_code) {
      runs = runs.filter(r => r.error_code === filters.error_code);
    }

    // Sort by scheduled_for descending (most recent first)
    runs.sort((a, b) => new Date(b.scheduled_for).getTime() - new Date(a.scheduled_for).getTime());

    // Paginate
    const total = runs.length;
    const start = page * pageSize;
    const end = start + pageSize;
    const items = runs.slice(start, end);

    return {
      items,
      total_count: total,
      page,
      page_size: pageSize,
      has_more: end < total,
    };
  }
}

/**
 * Snapshot Storage
 */
export class SnapshotStorage {
  constructor(
    private tenantId: string,
    private cloudId: string,
  ) {}

  /**
   * Create a new snapshot (immutable)
   */
  async createSnapshot(snapshot: Snapshot): Promise<Snapshot> {
    if (snapshot.tenant_id !== this.tenantId || snapshot.cloud_id !== this.cloudId) {
      throw new Error('Tenant/cloud mismatch');
    }

    const key = getSnapshotKey(this.tenantId, snapshot.snapshot_id);
    const ttl = 90 * 24 * 60 * 60; // 90 days in seconds
    
    await storage.set(key, JSON.stringify(snapshot), { ttl });
    
    // Also add to index for pagination
    await this.addToIndex(snapshot);
    
    return snapshot;
  }

  /**
   * Create a new snapshot with distributed lock protection
   * 
   * Prevents concurrent snapshot creation for the same tenant and time window.
   * If lock cannot be acquired, returns null (caller should mark run as SKIPPED).
   * 
   * @param snapshot - Snapshot to create
   * @param snapshotType - Snapshot type (daily or weekly)
   * @param windowStartISO - Window start date (YYYY-MM-DD)
   * @returns Created snapshot, or null if lock could not be acquired
   */
  async createSnapshotWithLock(
    snapshot: Snapshot,
    snapshotType: SnapshotType,
    windowStartISO: string,
  ): Promise<Snapshot | null> {
    if (snapshot.tenant_id !== this.tenantId || snapshot.cloud_id !== this.cloudId) {
      throw new Error('Tenant/cloud mismatch');
    }

    const lock = createSnapshotLock(this.tenantId, snapshotType, windowStartISO);
    
    return await lock.execute(async () => {
      return await this.createSnapshot(snapshot);
    });
  }

  /**
   * Get a snapshot by ID
   */
  async getSnapshotById(snapshotId: string): Promise<Snapshot | null> {
    const key = getSnapshotKey(this.tenantId, snapshotId);
    const data = await storage.get(key);
    return data ? JSON.parse(data as string) : null;
  }

  /**
   * List snapshots with optional filters
   * Returns paginated results
   */
  async listSnapshots(
    filters?: SnapshotFilters,
    page: number = 0,
    pageSize: number = 20,
  ): Promise<SnapshotPageResult<Snapshot>> {
    const prefix = getSnapshotKey(this.tenantId, '');
    const keys = await storage.query().where('key', 'like', prefix).getKeys();
    
    let snapshots: Snapshot[] = [];
    for (const key of keys) {
      const data = await storage.get(key);
      if (data) {
        snapshots.push(JSON.parse(data as string));
      }
    }

    // Apply filters
    if (filters?.snapshot_type) {
      snapshots = snapshots.filter(s => s.snapshot_type === filters.snapshot_type);
    }

    // Sort by captured_at descending (most recent first)
    snapshots.sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime());

    // Paginate
    const total = snapshots.length;
    const start = page * pageSize;
    const end = start + pageSize;
    const items = snapshots.slice(start, end);

    return {
      items,
      total_count: total,
      page,
      page_size: pageSize,
      has_more: end < total,
    };
  }

  /**
   * Delete snapshot by ID (used by retention policy)
   */
  async deleteSnapshot(snapshotId: string): Promise<boolean> {
    const key = getSnapshotKey(this.tenantId, snapshotId);
    const exists = await storage.get(key);
    if (exists) {
      await storage.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Add snapshot to index for pagination
   * (Internal use only)
   */
  private async addToIndex(snapshot: Snapshot): Promise<void> {
    // Index key format: prefix:tenantId:type:page
    // For MVP, we just track the latest page
    const indexKey = getSnapshotIndexKey(this.tenantId, snapshot.snapshot_type, 0);
    
    const existingData = await storage.get(indexKey);
    let ids: string[] = existingData ? JSON.parse(existingData as string) : [];
    
    ids.push(snapshot.snapshot_id);
    await storage.set(indexKey, JSON.stringify(ids));
  }
}

/**
 * Retention Policy Storage
 */
export class RetentionPolicyStorage {
  constructor(
    private tenantId: string,
  ) {}

  /**
   * Create or update retention policy
   */
  async setPolicy(policy: RetentionPolicy): Promise<RetentionPolicy> {
    if (policy.tenant_id !== this.tenantId) {
      throw new Error('Tenant mismatch');
    }

    const key = getRetentionPolicyKey(this.tenantId);
    await storage.set(key, JSON.stringify(policy));
    return policy;
  }

  /**
   * Get current retention policy (or default)
   */
  async getPolicy(): Promise<RetentionPolicy> {
    const key = getRetentionPolicyKey(this.tenantId);
    const data = await storage.get(key);
    
    if (data) {
      return JSON.parse(data as string);
    }

    // Return default policy
    return {
      tenant_id: this.tenantId,
      ...DEFAULT_RETENTION_POLICY,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}

/**
 * Enforce retention policy
 * Deletes old snapshots based on max_days and max_records
 */
export class RetentionEnforcer {
  constructor(
    private tenantId: string,
    private cloudId: string,
  ) {}

  /**
   * Enforce retention limits for a snapshot type
   */
  async enforceRetention(snapshotType: 'daily' | 'weekly'): Promise<{
    deleted_count: number;
    reason: string;
  }> {
    const policyStorage = new RetentionPolicyStorage(this.tenantId);
    const snapshotStorage = new SnapshotStorage(this.tenantId, this.cloudId);
    
    const policy = await policyStorage.getPolicy();
    
    // Get all snapshots of this type
    const result = await snapshotStorage.listSnapshots(
      { snapshot_type: snapshotType },
      0,
      1000 // Get up to 1000 for deletion
    );

    const snapshots = result.items;
    const now = new Date();
    const maxAgeMs = policy.max_days * 24 * 60 * 60 * 1000;
    
    let deletedCount = 0;
    let reason = '';

    // Phase 1: Delete by age (older than max_days)
    for (const snap of snapshots) {
      const ageMs = now.getTime() - new Date(snap.captured_at).getTime();
      if (ageMs > maxAgeMs) {
        await snapshotStorage.deleteSnapshot(snap.snapshot_id);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      reason = `Deleted ${deletedCount} snapshots older than ${policy.max_days} days`;
      return { deleted_count: deletedCount, reason };
    }

    // Phase 2: Delete by FIFO if count exceeds max_records
    const maxRecords = snapshotType === 'daily' ? policy.max_records_daily : policy.max_records_weekly;
    if (snapshots.length > maxRecords) {
      const toDelete = snapshots.length - maxRecords;
      // Oldest snapshots are at the end (array sorted by date desc)
      for (let i = 0; i < toDelete; i++) {
        await snapshotStorage.deleteSnapshot(snapshots[snapshots.length - 1 - i].snapshot_id);
        deletedCount++;
      }
      reason = `FIFO deletion: removed oldest ${toDelete} snapshots to stay within ${maxRecords} record limit`;
    }

    return { deleted_count: deletedCount, reason };
  }
}

/**
 * PHASE 6 v2: Snapshot Ledger - Read-only evidence record
 * 
 * Provides immutable, read-only access to snapshot evidence.
 * All modifications are rejected; ledger is write-once at creation time.
 */
export class SnapshotLedger {
  constructor(private tenantId: string) {}

  async getSnapshot(snapshotId: string): Promise<Snapshot> {
    const key = getSnapshotKey(this.tenantId, snapshotId);
    const data = await storage.get(key);
    if (!data) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }
    return JSON.parse(data as string);
  }

  async getAllSnapshots(): Promise<Snapshot[]> {
    const result = await storage.query().where('key', 'like', `snapshot:${this.tenantId}:*`).getKeys();
    const snapshots: Snapshot[] = [];
    for (const key of result) {
      const data = await storage.get(key);
      if (data) {
        snapshots.push(JSON.parse(data as string));
      }
    }
    return snapshots;
  }
}

/**
 * PHASE 6 v2: Evidence Integrity Checker - Cryptographic verification
 * 
 * Verifies snapshot immutability through hash validation.
 * Detects tampering by comparing stored hash against recomputed value.
 */
export class EvidenceIntegrityChecker {
  constructor(private tenantId: string) {}

  async verifyIntegrity(snapshot: Snapshot): Promise<boolean> {
    const currentHash = computeCanonicalHash(snapshot.payload);
    return currentHash === snapshot.canonical_hash;
  }

  async verifyAllSnapshots(): Promise<Map<string, boolean>> {
    const ledger = new SnapshotLedger(this.tenantId);
    const snapshots = await ledger.getAllSnapshots();
    const results = new Map<string, boolean>();

    for (const snapshot of snapshots) {
      const isValid = await this.verifyIntegrity(snapshot);
      results.set(snapshot.snapshot_id, isValid);
    }

    return results;
  }
}

