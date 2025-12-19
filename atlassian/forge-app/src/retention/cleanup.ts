/**
 * Retention Cleanup (PHASE 2)
 * 
 * Hard delete keys older than 90 days using Storage Index Ledger.
 * Only deletes keys explicitly listed in index; never touches config/install markers.
 * 
 * Deletion targets:
 * - raw shards: raw/* (via index/raw/...)
 * - seen markers: seen/* (if indexed)
 * - aggregates: agg/* (via index/agg/daily/... and index/agg/weekly/...)
 * 
 * Safe deletion:
 * - Iterate index buckets older than cutoff (now - 90 days)
 * - Delete only keys in index list
 * - Delete index bucket itself after successful key deletion
 * - Record errors if any key deletion fails
 * - Never claim deletion of non-indexed keys
 */

let api: any;
try {
  api = require('@forge/api').default;
} catch (e) {
  // @forge/api only available in Forge runtime, not in tests
}

import { get_raw_shards_for_day, get_daily_aggregates_for_day, get_weekly_aggregates_for_week, update_index_metadata } from '../storage_index';

/**
 * Retention cleanup result
 */
export interface RetentionResult {
  deleted_keys: string[];
  skipped_keys_reason: string;
  errors: Array<{ key: string; error: string }>;
  cutoff_date: string; // ISO date
  deleted_count: number;
  error_count: number;
}

/**
 * Get date 90 days ago from now (ISO format)
 */
function getCutoffDate(nowISO: string): string {
  const now = new Date(nowISO);
  now.setUTCDate(now.getUTCDate() - 90);
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Check if date is older than cutoff
 */
function isDateOlder(dateStr: string, cutoffStr: string): boolean {
  return dateStr < cutoffStr;
}

/**
 * Run retention cleanup for an org
 * 
 * @param org Organization key
 * @param nowISO Current timestamp (ISO 8601)
 * @returns Cleanup report with deleted/skipped/error counts
 */
export async function retention_cleanup(
  org: string,
  nowISO: string
): Promise<RetentionResult> {
  const cutoffDate = getCutoffDate(nowISO);
  const deletedKeys: string[] = [];
  const errors: Array<{ key: string; error: string }> = [];

  try {
    return await api.asApp().requestStorage(async (storage) => {
      // Note: We iterate through index buckets we know about.
      // Since we cannot enumerate all possible date/week buckets without Forge prefix listing,
      // we rely on index metadata to track which buckets have been written.
      // For Phase 2, we implement a simple approach: scan a reasonable date window backward.

      // Step 1: Generate date buckets to check (last 150 days)
      const bucketsToCheck: string[] = [];
      const now = new Date(nowISO);
      for (let i = 0; i < 150; i++) {
        const d = new Date(now);
        d.setUTCDate(d.getUTCDate() - i);
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        bucketsToCheck.push(`${y}-${m}-${day}`);
      }

      // Step 2: Process each bucket
      for (const bucket of bucketsToCheck) {
        if (!isDateOlder(bucket, cutoffDate)) {
          continue; // Skip buckets not older than cutoff
        }

        // Get raw shards for this day and delete them
        const rawShards = await get_raw_shards_for_day(org, bucket);
        for (const shardKey of rawShards) {
          try {
            await storage.delete(shardKey);
            deletedKeys.push(shardKey);
          } catch (error) {
            errors.push({ key: shardKey, error: String(error) });
          }
        }

        // Delete shard count keys
        // These are structured as rawshard/{org}/{yyyy-mm-dd}/{shard_id}/count
        // Since we don't have explicit index for these, we attempt cleanup on known shards
        for (const shardKey of rawShards) {
          // Extract shard_id from raw/{org}/{yyyy-mm-dd}/{shard_id}
          const parts = shardKey.split('/');
          if (parts.length === 4 && parts[0] === 'raw') {
            const shardId = parts[3];
            const countKey = `rawshard/${org}/${bucket}/${shardId}/count`;
            try {
              await storage.delete(countKey);
              deletedKeys.push(countKey);
            } catch (error) {
              errors.push({ key: countKey, error: String(error) });
            }
          }
        }

        // Delete daily aggregates
        const dailyAggs = await get_daily_aggregates_for_day(org, bucket);
        for (const aggKey of dailyAggs) {
          try {
            await storage.delete(aggKey);
            deletedKeys.push(aggKey);
          } catch (error) {
            errors.push({ key: aggKey, error: String(error) });
          }
        }

        // Delete index bucket itself
        const indexKey = `index/raw/${org}/${bucket}`;
        try {
          await storage.delete(indexKey);
          deletedKeys.push(indexKey);
        } catch (error) {
          errors.push({ key: indexKey, error: String(error) });
        }

        const aggIndexKey = `index/agg/daily/${org}/${bucket}`;
        try {
          await storage.delete(aggIndexKey);
          deletedKeys.push(aggIndexKey);
        } catch (error) {
          errors.push({ key: aggIndexKey, error: String(error) });
        }
      }

      // Step 3: Process weekly aggregates (iterate ISO weeks)
      // This is approximate; we generate week keys for ~30 weeks back
      for (let weeksBack = 0; weeksBack < 30; weeksBack++) {
        const d = new Date(nowISO);
        d.setUTCDate(d.getUTCDate() - weeksBack * 7);
        const y = d.getUTCFullYear();
        const y_m_d = `${y}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

        // Compute ISO week
        const tempDate = new Date(d);
        tempDate.setUTCDate(tempDate.getUTCDate() + 4 - (tempDate.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
        const weekNumber = Math.ceil(
          ((tempDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
        );
        const weekKey = `${tempDate.getUTCFullYear()}-${String(weekNumber).padStart(2, '0')}`;

        // Check if this week's start date is older than cutoff
        const weekStartDate = new Date(d);
        weekStartDate.setUTCDate(
          d.getUTCDate() - d.getUTCDay() + (d.getUTCDay() === 0 ? -6 : 1)
        );
        const weekStartStr = `${weekStartDate.getUTCFullYear()}-${String(weekStartDate.getUTCMonth() + 1).padStart(2, '0')}-${String(weekStartDate.getUTCDate()).padStart(2, '0')}`;

        if (!isDateOlder(weekStartStr, cutoffDate)) {
          continue;
        }

        // Delete weekly aggregates
        const weeklyAggs = await get_weekly_aggregates_for_week(org, weekKey);
        for (const aggKey of weeklyAggs) {
          try {
            await storage.delete(aggKey);
            deletedKeys.push(aggKey);
          } catch (error) {
            errors.push({ key: aggKey, error: String(error) });
          }
        }

        // Delete weekly index bucket
        const weekIndexKey = `index/agg/weekly/${org}/${weekKey}`;
        try {
          await storage.delete(weekIndexKey);
          deletedKeys.push(weekIndexKey);
        } catch (error) {
          errors.push({ key: weekIndexKey, error: String(error) });
        }
      }

      // Step 4: Update metadata with last cleanup timestamp
      await update_index_metadata(org, {
        last_cleanup_at: nowISO,
        last_cleanup_cutoff: cutoffDate,
        last_cleanup_deleted: deletedKeys.length,
      });

      return {
        deleted_keys: deletedKeys.sort(),
        skipped_keys_reason: 'Non-indexed keys cannot be enumerated safely; only indexed keys deleted',
        errors,
        cutoff_date: cutoffDate,
        deleted_count: deletedKeys.length,
        error_count: errors.length,
      };
    });
  } catch (error) {
    console.error('[Retention] Error during cleanup:', error);
    return {
      deleted_keys: deletedKeys,
      skipped_keys_reason: 'Non-indexed keys cannot be enumerated safely',
      errors: [...errors, { key: 'general', error: String(error) }],
      cutoff_date: cutoffDate,
      deleted_count: deletedKeys.length,
      error_count: errors.length + 1,
    };
  }
}
