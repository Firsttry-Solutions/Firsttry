/**
 * PHASE 4: Immutable Evidence Storage Model
 * 
 * Append-only, immutable record storage for Jira ingestion evidence.
 * NO updates, NO deletes, NO overwrites.
 * 
 * Each evidence snapshot contains:
 * - evidence_source (jira_metadata | jira_coverage | jira_permission_error)
 * - evidence_snapshot (the actual ingested data or error)
 * - snapshot_timestamp (ISO 8601, when snapshot was taken)
 * - coverage_flags (AVAILABLE | PARTIAL | MISSING | NOT_PERMITTED_BY_SCOPE)
 */

import api from '@forge/api';

export enum EvidenceSource {
  JIRA_METADATA = 'jira_metadata',
  JIRA_COVERAGE = 'jira_coverage',
  JIRA_PERMISSION_ERROR = 'jira_permission_error',
}

export interface EvidenceRecord {
  id: string; // Unique ID for this evidence record
  source: EvidenceSource;
  snapshot: Record<string, any>; // The actual ingested data
  timestamp: string; // ISO 8601
  coverageFlags: Record<string, string>; // Map of dataset → AVAILABLE|PARTIAL|MISSING|NOT_PERMITTED_BY_SCOPE
  appId: string;
}

/**
 * Generate deterministic evidence ID from timestamp + source
 */
function generateEvidenceId(source: EvidenceSource, timestamp: string): string {
  // Format: evidence_{source}_{timestamp_epoch_ms}
  const epoch = new Date(timestamp).getTime();
  return `evidence_${source}_${epoch}`;
}

/**
 * Store evidence record (append-only)
 * 
 * This operation is idempotent: calling with the same timestamp + source twice
 * will write the same record.
 */
export async function storeEvidenceRecord(
  source: EvidenceSource,
  snapshot: Record<string, any>,
  timestamp: string,
  coverageFlags: Record<string, string>
): Promise<string> {
  const evidenceId = generateEvidenceId(source, timestamp);

  const record: EvidenceRecord = {
    id: evidenceId,
    source,
    snapshot,
    timestamp,
    coverageFlags,
    appId: 'ari:cloud:ecosystem::app/59d86182-c1c6-49ea-b2fb-6ee5be52b7fc',
  };

  // Store in Forge storage under evidence index
  const storageKey = `evidence/${evidenceId}`;

  await api.asApp().requestStorage(async (storage) => {
    // Check if already exists (idempotency)
    const existing = await storage.get(storageKey);
    if (existing) {
      // Record already exists, no update needed
      return;
    }

    // Append new record
    await storage.set(storageKey, record);

    // Update evidence index (append-only list of IDs)
    const indexKey = `evidence:index`;
    const index = (await storage.get(indexKey) || []) as string[];
    if (!index.includes(evidenceId)) {
      index.push(evidenceId);
      await storage.set(indexKey, index);
    }
  });

  return evidenceId;
}

/**
 * Retrieve a single evidence record by ID
 */
export async function getEvidenceRecord(evidenceId: string): Promise<EvidenceRecord | null> {
  const storageKey = `evidence/${evidenceId}`;

  const record = await api.asApp().requestStorage(async (storage) => {
    return await storage.get(storageKey);
  });

  return record || null;
}

/**
 * List all evidence records in chronological order
 */
export async function listEvidenceRecords(
  limit: number = 100,
  offset: number = 0
): Promise<EvidenceRecord[]> {
  const records = await api.asApp().requestStorage(async (storage) => {
    const indexKey = `evidence:index`;
    const index = (await storage.get(indexKey) || []) as string[];

    // Sort by timestamp descending (most recent first)
    const sortedIds = index.sort().reverse();

    // Apply pagination
    const paginatedIds = sortedIds.slice(offset, offset + limit);

    // Fetch all records in parallel
    const recordPromises = paginatedIds.map(async (id) => {
      const record = await storage.get(`evidence/${id}`);
      return record as EvidenceRecord | null;
    });

    const allRecords = await Promise.all(recordPromises);
    return allRecords.filter((r) => r !== null) as EvidenceRecord[];
  });

  return records;
}

/**
 * Filter evidence records by source
 */
export async function filterEvidenceBySource(source: EvidenceSource): Promise<EvidenceRecord[]> {
  const records = await api.asApp().requestStorage(async (storage) => {
    const indexKey = `evidence:index`;
    const index = (await storage.get(indexKey) || []) as string[];

    // Fetch all records matching source
    const recordPromises = index.map(async (id) => {
      const record = await storage.get(`evidence/${id}`);
      return record as EvidenceRecord | null;
    });

    const allRecords = await Promise.all(recordPromises);
    return allRecords.filter((r) => r && r.source === source) as EvidenceRecord[];
  });

  return records;
}

/**
 * Get most recent evidence record for a given source
 */
export async function getMostRecentEvidence(source: EvidenceSource): Promise<EvidenceRecord | null> {
  const records = await filterEvidenceBySource(source);
  if (records.length === 0) {
    return null;
  }

  // Sort by timestamp descending
  records.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return records[0];
}

/**
 * Count total evidence records
 */
export async function countEvidenceRecords(): Promise<number> {
  const count = await api.asApp().requestStorage(async (storage) => {
    const indexKey = `evidence:index`;
    const index = (await storage.get(indexKey) || []) as string[];
    return index.length;
  });

  return count;
}

/**
 * Get coverage statistics from most recent evidence
 */
export async function getCoverageStatistics(source: EvidenceSource): Promise<{
  totalDatasets: number;
  available: number;
  partial: number;
  missing: number;
  notPermitted: number;
}> {
  const latestEvidence = await getMostRecentEvidence(source);

  if (!latestEvidence) {
    return {
      totalDatasets: 0,
      available: 0,
      partial: 0,
      missing: 0,
      notPermitted: 0,
    };
  }

  const flags = latestEvidence.coverageFlags;
  const stats = {
    totalDatasets: Object.keys(flags).length,
    available: 0,
    partial: 0,
    missing: 0,
    notPermitted: 0,
  };

  for (const status of Object.values(flags)) {
    switch (status) {
      case 'AVAILABLE':
        stats.available++;
        break;
      case 'PARTIAL':
        stats.partial++;
        break;
      case 'MISSING':
        stats.missing++;
        break;
      case 'NOT_PERMITTED_BY_SCOPE':
        stats.notPermitted++;
        break;
    }
  }

  return stats;
}
