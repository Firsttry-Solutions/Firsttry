/**
 * Storage Index Ledger (PHASE 2 - CRITICAL)
 * 
 * Because Forge storage may not support "list by prefix" reliably,
 * we maintain a bounded, append-only index to enable safe enumeration.
 * 
 * Supports Phase 2 aggregation and retention:
 * - Find all raw shards touched on a day
 * - Find all aggregates written on a day/week
 * - Delete only indexed keys during cleanup
 * 
 * Index structure (minimal, append-only with periodic compaction):
 * - index/raw/{org}/{yyyy-mm-dd} → sorted deduplicated list of shard keys
 * - index/agg/daily/{org}/{yyyy-mm-dd} → sorted deduplicated list of agg keys
 * - index/agg/weekly/{org}/{yyyy-WW} → sorted deduplicated list of weekly agg keys
 * - index/meta/{org} → metadata (last compaction, cleanup cursor, etc.)
 * 
 * Key constraints:
 * - Max ~1000 keys per daily bucket (reasonable for most workloads)
 * - If exceeded, implement pagination (index/{org}/{date}/p{n})
 * - Deduplicate on write
 * - Sort deterministically
 */

let api: any;
try {
  api = require('@forge/api').default;
} catch (e) {
  // @forge/api only available in Forge runtime, not in tests
}

const MAX_KEYS_PER_BUCKET = 1000;

/**
 * Index entry: minimal tracking of written keys
 */
interface IndexEntry {
  key: string;
  written_at?: string; // ISO timestamp when recorded
}

/**
 * Record a raw shard key in the daily index
 * Called by ingest on successful write
 */
export async function index_raw_shard(org: string, dateStr: string, shardKey: string): Promise<void> {
  try {
    await api.asApp().requestStorage(async (storage) => {
      const indexKey = `index/raw/${org}/${dateStr}`;
      const existing = (await storage.get(indexKey) as string[] | undefined) || [];

      // Deduplicate and sort
      const updated = Array.from(new Set([...existing, shardKey])).sort();

      // Check bounds
      if (updated.length > MAX_KEYS_PER_BUCKET) {
        console.warn(
          `[Index] Raw shard index for ${org}/${dateStr} exceeds max (${updated.length} > ${MAX_KEYS_PER_BUCKET}); paging not implemented in Phase 2`
        );
      }

      await storage.set(indexKey, updated);
    });
  } catch (error) {
    console.error('[Index] Error indexing raw shard:', error);
    // Do not throw; index is optional for Phase 2
  }
}

/**
 * Get all raw shard keys for a day
 */
export async function get_raw_shards_for_day(org: string, dateStr: string): Promise<string[]> {
  try {
    return await api.asApp().requestStorage(async (storage) => {
      const indexKey = `index/raw/${org}/${dateStr}`;
      return (await storage.get(indexKey) as string[] | undefined) || [];
    });
  } catch (error) {
    console.error('[Index] Error getting raw shards:', error);
    return [];
  }
}

/**
 * Record a daily aggregate key in the index
 * Called by daily recompute after successful write
 */
export async function index_daily_aggregate(org: string, dateStr: string, aggKey: string): Promise<void> {
  try {
    await api.asApp().requestStorage(async (storage) => {
      const indexKey = `index/agg/daily/${org}/${dateStr}`;
      const existing = (await storage.get(indexKey) as string[] | undefined) || [];

      // Deduplicate and sort
      const updated = Array.from(new Set([...existing, aggKey])).sort();

      if (updated.length > MAX_KEYS_PER_BUCKET) {
        console.warn(
          `[Index] Daily agg index for ${org}/${dateStr} exceeds max (${updated.length} > ${MAX_KEYS_PER_BUCKET})`
        );
      }

      await storage.set(indexKey, updated);
    });
  } catch (error) {
    console.error('[Index] Error indexing daily aggregate:', error);
    // Do not throw
  }
}

/**
 * Get all daily aggregate keys for a day
 */
export async function get_daily_aggregates_for_day(org: string, dateStr: string): Promise<string[]> {
  try {
    return await api.asApp().requestStorage(async (storage) => {
      const indexKey = `index/agg/daily/${org}/${dateStr}`;
      return (await storage.get(indexKey) as string[] | undefined) || [];
    });
  } catch (error) {
    console.error('[Index] Error getting daily aggregates:', error);
    return [];
  }
}

/**
 * Record a weekly aggregate key in the index
 */
export async function index_weekly_aggregate(org: string, weekKey: string, aggKey: string): Promise<void> {
  try {
    await api.asApp().requestStorage(async (storage) => {
      const indexKey = `index/agg/weekly/${org}/${weekKey}`;
      const existing = (await storage.get(indexKey) as string[] | undefined) || [];

      const updated = Array.from(new Set([...existing, aggKey])).sort();

      if (updated.length > MAX_KEYS_PER_BUCKET) {
        console.warn(
          `[Index] Weekly agg index for ${org}/${weekKey} exceeds max (${updated.length} > ${MAX_KEYS_PER_BUCKET})`
        );
      }

      await storage.set(indexKey, updated);
    });
  } catch (error) {
    console.error('[Index] Error indexing weekly aggregate:', error);
  }
}

/**
 * Get all weekly aggregate keys for a week
 */
export async function get_weekly_aggregates_for_week(org: string, weekKey: string): Promise<string[]> {
  try {
    return await api.asApp().requestStorage(async (storage) => {
      const indexKey = `index/agg/weekly/${org}/${weekKey}`;
      return (await storage.get(indexKey) as string[] | undefined) || [];
    });
  } catch (error) {
    console.error('[Index] Error getting weekly aggregates:', error);
    return [];
  }
}

/**
 * Get metadata for org (compaction cursor, cleanup timestamp)
 */
export async function get_index_metadata(org: string): Promise<Record<string, unknown>> {
  try {
    return await api.asApp().requestStorage(async (storage) => {
      const indexKey = `index/meta/${org}`;
      return (await storage.get(indexKey) as Record<string, unknown> | undefined) || {};
    });
  } catch (error) {
    console.error('[Index] Error getting index metadata:', error);
    return {};
  }
}

/**
 * Update metadata for org (e.g., last cleanup run)
 */
export async function update_index_metadata(
  org: string,
  meta: Record<string, unknown>
): Promise<void> {
  try {
    await api.asApp().requestStorage(async (storage) => {
      const indexKey = `index/meta/${org}`;
      await storage.set(indexKey, meta);
    });
  } catch (error) {
    console.error('[Index] Error updating index metadata:', error);
  }
}
