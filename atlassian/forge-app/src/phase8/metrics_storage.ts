/**
 * PHASE 8 v2: METRICS STORAGE LAYER
 *
 * Store and retrieve metrics runs with:
 * - Tenant isolation
 * - Pagination with deterministic ordering
 * - Canonical hashing for integrity verification
 */

import { storage } from '@forge/api';
import {
  MetricsRun,
  canonicalMetricsRunJson,
} from './metrics_model';
import { generateCanonicalHash } from './metrics_compute';

/**
 * Storage key patterns
 */
function metricsRunKey(tenantId: string, cloudId: string, metricsRunId: string): string {
  return `metrics:runs:${tenantId}:${cloudId}:${metricsRunId}`;
}

function metricsRunIndexKey(tenantId: string, cloudId: string): string {
  return `metrics:index:${tenantId}:${cloudId}`;
}

/**
 * Store a metrics run (immutable, with canonical hash)
 */
export async function storeMetricsRun(
  tenantId: string,
  cloudId: string,
  metricsRun: Omit<MetricsRun, 'canonical_hash'>
): Promise<MetricsRun> {
  // Generate canonical hash
  const canonical_hash = generateCanonicalHash(metricsRun);

  // Complete metrics run
  const completeRun: MetricsRun = {
    ...metricsRun,
    canonical_hash,
  };

  // Store in Forge storage (tenant-isolated)
  const key = metricsRunKey(tenantId, cloudId, metricsRun.metrics_run_id);
  await storage.set(key, JSON.stringify(completeRun));

  // Update index (deterministic order by computed_at DESC)
  const indexKey = metricsRunIndexKey(tenantId, cloudId);
  let index = await storage.get(indexKey);
  const runIndex: Array<{ id: string; computed_at: string }> = index
    ? JSON.parse(index)
    : [];

  // Add to index and sort deterministically
  runIndex.push({
    id: metricsRun.metrics_run_id,
    computed_at: metricsRun.computed_at,
  });

  // Sort by computed_at DESC (most recent first)
  runIndex.sort((a, b) => {
    const timeCompare = new Date(b.computed_at).getTime() - new Date(a.computed_at).getTime();
    if (timeCompare !== 0) return timeCompare;
    // Stable sort by ID if timestamps are equal
    return b.id.localeCompare(a.id);
  });

  await storage.set(indexKey, JSON.stringify(runIndex));

  return completeRun;
}

/**
 * Retrieve a specific metrics run by ID
 */
export async function getMetricsRun(
  tenantId: string,
  cloudId: string,
  metricsRunId: string
): Promise<MetricsRun | null> {
  const key = metricsRunKey(tenantId, cloudId, metricsRunId);
  const data = await storage.get(key);
  if (!data) return null;
  return JSON.parse(data);
}

/**
 * List metrics runs with pagination (deterministic order)
 */
export interface ListMetricsRunsOptions {
  page?: number; // 0-indexed
  limit?: number; // per page
}

export interface ListMetricsRunsResult {
  items: MetricsRun[];
  total_count: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export async function listMetricsRuns(
  tenantId: string,
  cloudId: string,
  options: ListMetricsRunsOptions = {}
): Promise<ListMetricsRunsResult> {
  const page = Math.max(0, options.page || 0);
  const limit = Math.max(1, Math.min(100, options.limit || 20));

  // Get index (already sorted by computed_at DESC)
  const indexKey = metricsRunIndexKey(tenantId, cloudId);
  const indexData = await storage.get(indexKey);
  const index: Array<{ id: string; computed_at: string }> = indexData
    ? JSON.parse(indexData)
    : [];

  const totalCount = index.length;
  const startIdx = page * limit;
  const endIdx = startIdx + limit;
  const pageIndex = index.slice(startIdx, endIdx);

  // Fetch metrics runs for this page
  const items: MetricsRun[] = [];
  for (const entry of pageIndex) {
    const run = await getMetricsRun(tenantId, cloudId, entry.id);
    if (run) {
      items.push(run);
    }
  }

  return {
    items,
    total_count: totalCount,
    page,
    limit,
    has_more: endIdx < totalCount,
  };
}

/**
 * Verify canonical hash (integrity check)
 */
export function verifyCanonicalHash(metricsRun: MetricsRun): boolean {
  const { canonical_hash, ...runWithoutHash } = metricsRun;
  const computed = generateCanonicalHash(runWithoutHash);
  return computed === canonical_hash;
}

/**
 * Delete a metrics run (for testing/cleanup)
 */
export async function deleteMetricsRun(
  tenantId: string,
  cloudId: string,
  metricsRunId: string
): Promise<void> {
  const key = metricsRunKey(tenantId, cloudId, metricsRunId);
  await storage.delete(key);

  // Update index
  const indexKey = metricsRunIndexKey(tenantId, cloudId);
  let index = await storage.get(indexKey);
  if (index) {
    const runIndex: Array<{ id: string; computed_at: string }> = JSON.parse(index);
    const filtered = runIndex.filter(r => r.id !== metricsRunId);
    if (filtered.length > 0) {
      await storage.set(indexKey, JSON.stringify(filtered));
    } else {
      await storage.delete(indexKey);
    }
  }
}
