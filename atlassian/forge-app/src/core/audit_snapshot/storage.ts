/**
 * Immutable Record Storage (Append-Only)
 * 
 * IMMUTABILITY GUARANTEE (A3):
 * - snapshotId is deterministic: sha256(generatedAtISO|jsonSha256).slice(0,16)
 * - Deterministic IDs create a content-addressing model
 * - Idempotent writes: calling storeSnapshotRecord() twice returns same snapshotId
 * - Records cannot be modified because ID is derived from immutable content
 * - Overwrites are rejected: check-exists-first pattern (line 21-26)
 * 
 * Rules:
 * - Tenant-scoped (includes cloudId in key)
 * - Append-only: never overwrite existing records
 * - Retention: keep last 20 snapshots
 * - snapshotId deterministic: sha256(generatedAtISO|jsonSha256).slice(0,16)
 * - Records are immutable after write
 */

import { storage } from '@forge/api';
import { SnapshotRecord } from './types';
import { sha256Hex } from './hash';

/**
 * Store snapshot record (append-only, immutable)
 * Returns the snapshotId
 */
export async function storeSnapshotRecord(
  cloudId: string,
  record: SnapshotRecord
): Promise<string> {
  const indexKey = `audit_snapshot:index:${cloudId}`;
  const recordKey = `audit_snapshot:record:${cloudId}:${record.snapshotId}`;

  // Check if record already exists (idempotent)
  const existing = await storage.get(recordKey);
  if (existing) {
    // Record already exists, return snapshotId without rewriting
    return record.snapshotId;
  }

  // Append to index (most recent first)
  const index = (await storage.get(indexKey)) || [];
  const newIndex = [record.snapshotId, ...(Array.isArray(index) ? index : [])];

  // Prune to 20 most recent
  const prunedIndex = newIndex.slice(0, 20);

  // Store record
  await storage.set(recordKey, record);

  // Update index
  await storage.set(indexKey, prunedIndex);

  return record.snapshotId;
}

/**
 * Retrieve snapshot record by ID
 */
export async function getSnapshotRecord(cloudId: string, snapshotId: string): Promise<SnapshotRecord | null> {
  const recordKey = `audit_snapshot:record:${cloudId}:${snapshotId}`;
  return await storage.get(recordKey);
}

/**
 * Get all snapshot IDs (most recent first)
 */
export async function getSnapshotIndex(cloudId: string): Promise<string[]> {
  const indexKey = `audit_snapshot:index:${cloudId}`;
  const index = await storage.get(indexKey);
  return Array.isArray(index) ? index : [];
}

/**
 * Generate deterministic snapshotId
 */
export function generateSnapshotId(generatedAtISO: string, jsonSha256: string): string {
  const text = `${generatedAtISO}|${jsonSha256}`;
  const hash = sha256Hex(text);
  return hash.slice(0, 16);
}
