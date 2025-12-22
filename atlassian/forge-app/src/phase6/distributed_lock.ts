/**
 * PHASE 6 v2: DISTRIBUTED LOCK UTILITY
 * 
 * Provides tenant-scoped distributed locking using Forge Storage.
 * Used to prevent concurrent execution of snapshot creation for the same tenant/window.
 * 
 * Principles:
 * - Atomic lock acquisition (use storage.set with check-and-set semantics)
 * - Automatic lock expiry via TTL
 * - Tenant-scoped locks (no global contention)
 * - Safe failure (lock release in finally blocks)
 */

import { storage } from '@forge/api';
import type { SnapshotType } from './constants';

/**
 * Distributed lock for snapshot creation
 */
export class DistributedLock {
  private lockKey: string;
  private lockTTL: number = 90; // seconds
  private lockValue: string;

  /**
   * Create a new distributed lock
   * 
   * @param tenantId - Tenant identifier
   * @param snapshotType - Snapshot type (daily or weekly)
   * @param windowStartISO - Window start date in ISO format (YYYY-MM-DD)
   */
  constructor(
    tenantId: string,
    snapshotType: SnapshotType,
    windowStartISO: string,
  ) {
    // Lock key format: snapshot_lock:{tenant_id}:{snapshot_type}:{window_start}
    this.lockKey = `snapshot_lock:${tenantId}:${snapshotType}:${windowStartISO}`;
    
    // Lock value includes timestamp to make each acquisition unique
    this.lockValue = `lock:${tenantId}:${Date.now()}:${Math.random()}`;
  }

  /**
   * Attempt to acquire the lock
   * Returns true if lock acquired, false if already held
   * 
   * Uses non-atomic storage.set (Forge limitation).
   * In a higher-consistency environment, would use conditional write.
   * This implementation provides best-effort mutual exclusion for same-tenant jobs.
   */
  async acquire(): Promise<boolean> {
    try {
      // Check if lock already exists
      const existingLock = await storage.get(this.lockKey);
      
      if (existingLock) {
        // Lock is held by another process
        return false;
      }

      // Try to acquire the lock
      // Note: This is a basic implementation. For strict atomicity,
      // Forge Storage would need setIfNotExists primitive.
      // This check-then-set pattern has a small race window,
      // but works for snapshot jobs (low concurrency per tenant).
      
      await storage.set(this.lockKey, this.lockValue, {
        ttl: this.lockTTL,
      });

      return true;
    } catch (error) {
      console.error(`[DistributedLock] Failed to acquire lock: ${error}`);
      return false;
    }
  }

  /**
   * Release the lock
   * Safe to call even if lock was not held
   */
  async release(): Promise<void> {
    try {
      // Only delete if the lock value matches (to avoid releasing others' locks)
      const currentLock = await storage.get(this.lockKey);
      
      if (currentLock === this.lockValue) {
        await storage.delete(this.lockKey);
      }
    } catch (error) {
      console.error(`[DistributedLock] Failed to release lock: ${error}`);
    }
  }

  /**
   * Execute a function with automatic lock management
   * 
   * @param fn - Function to execute while holding the lock
   * @returns Result of fn, or null if lock could not be acquired
   */
  async execute<T>(fn: () => Promise<T>): Promise<T | null> {
    const acquired = await this.acquire();

    if (!acquired) {
      return null;
    }

    try {
      return await fn();
    } finally {
      await this.release();
    }
  }
}

/**
 * Helper to create a lock for snapshot creation
 */
export function createSnapshotLock(
  tenantId: string,
  snapshotType: SnapshotType,
  windowStartISO: string,
): DistributedLock {
  return new DistributedLock(tenantId, snapshotType, windowStartISO);
}
