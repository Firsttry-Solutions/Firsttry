/**
 * Daily Aggregation (PHASE 2)
 * 
 * Computes deterministic daily aggregates from raw shards.
 * Reads all raw shards for a day using Storage Index Ledger,
 * produces summary statistics with completeness flags.
 * 
 * Storage keys written:
 * - agg/org/daily/{org}/{yyyy-mm-dd}
 * - agg/daily/{org}/{repo}/{yyyy-mm-dd} (per-repo rollup)
 */

let api: any;
try {
  api = require('@forge/api').default;
} catch (e) {
  // @forge/api only available in Forge runtime, not in tests
}

import { get_raw_shards_for_day, index_daily_aggregate } from '../storage_index';
import { canonicalize } from '../canonicalize';

/**
 * Daily aggregate schema
 */
export interface DailyAggregate {
  org: string;
  date: string; // yyyy-mm-dd
  total_events: number;
  total_duration_ms: number;
  success_count: number;
  fail_count: number;
  cache_hit_count?: number;
  cache_miss_count?: number;
  retry_total: number;
  by_repo: Array<{
    repo: string;
    total_events: number;
    success_count: number;
    fail_count: number;
    total_duration_ms: number;
  }>;
  by_gate: Array<{
    gate: string;
    count: number;
  }>;
  by_profile: Array<{
    profile: string;
    count: number;
  }>;
  incomplete_inputs: {
    raw_shards_missing: boolean;
    raw_shards_count: number;
    raw_events_counted: number;
  };
  notes: string[];
}

/**
 * Recompute daily aggregate for an org on a specific date
 * 
 * @param org Organization key
 * @param dateStr Date in yyyy-mm-dd format
 * @returns Daily aggregate with completeness flags
 */
export async function recompute_daily(
  org: string,
  dateStr: string
): Promise<DailyAggregate> {
  try {
    return await api.asApp().requestStorage(async (storage) => {
      // Step 1: Get all raw shard keys for this day from index
      const shardKeys = await get_raw_shards_for_day(org, dateStr);

      // Step 2: Read all events from all shards
      const allEvents: Record<string, unknown>[] = [];
      for (const shardKey of shardKeys) {
        const shardData = await storage.get(shardKey) as Record<string, unknown>[] | undefined;
        if (shardData && Array.isArray(shardData)) {
          allEvents.push(...shardData);
        }
      }

      // Step 3: Initialize rollup maps
      const repoRollup = new Map<string, any>();
      const gateRollup = new Map<string, number>();
      const profileRollup = new Map<string, number>();

      // Step 4: Aggregate
      let totalEvents = 0;
      let totalDurationMs = 0;
      let successCount = 0;
      let failCount = 0;
      let cacheHitCount = 0;
      let cacheMissCount = 0;
      let retryTotal = 0;

      for (const event of allEvents) {
        totalEvents++;

        // Duration
        const duration = (event.duration_ms as number) || 0;
        totalDurationMs += duration;

        // Status
        const status = event.status as string;
        if (status === 'success') {
          successCount++;
        } else if (status === 'fail') {
          failCount++;
        }

        // Cache hits/misses (optional fields)
        if (event.cache_hit === true) {
          cacheHitCount++;
        }
        if (event.cache_hit === false) {
          cacheMissCount++;
        }

        // Retry count
        const retryCount = (event.retry_count as number) || 0;
        retryTotal += retryCount;

        // By repo
        const repo = event.repo_key as string;
        const repoData = repoRollup.get(repo) || {
          repo,
          total_events: 0,
          success_count: 0,
          fail_count: 0,
          total_duration_ms: 0,
        };
        repoData.total_events++;
        repoData.total_duration_ms += duration;
        if (status === 'success') repoData.success_count++;
        else if (status === 'fail') repoData.fail_count++;
        repoRollup.set(repo, repoData);

        // By gate
        const gates = event.gates as string[] | undefined;
        if (gates && Array.isArray(gates)) {
          for (const gate of gates) {
            gateRollup.set(gate, (gateRollup.get(gate) || 0) + 1);
          }
        }

        // By profile
        const profile = event.profile as string;
        profileRollup.set(profile, (profileRollup.get(profile) || 0) + 1);
      }

      // Step 5: Build aggregate object
      const aggregate: DailyAggregate = {
        org,
        date: dateStr,
        total_events: totalEvents,
        total_duration_ms: totalDurationMs,
        success_count: successCount,
        fail_count: failCount,
        cache_hit_count: cacheHitCount > 0 ? cacheHitCount : undefined,
        cache_miss_count: cacheMissCount > 0 ? cacheMissCount : undefined,
        retry_total: retryTotal,
        by_repo: Array.from(repoRollup.values()).sort((a, b) => a.repo.localeCompare(b.repo)),
        by_gate: Array.from(gateRollup.entries())
          .map(([gate, count]) => ({ gate, count }))
          .sort((a, b) => a.gate.localeCompare(b.gate)),
        by_profile: Array.from(profileRollup.entries())
          .map(([profile, count]) => ({ profile, count }))
          .sort((a, b) => a.profile.localeCompare(b.profile)),
        incomplete_inputs: {
          raw_shards_missing: shardKeys.length === 0,
          raw_shards_count: shardKeys.length,
          raw_events_counted: totalEvents,
        },
        notes:
          shardKeys.length === 0
            ? ["No raw shards indexed for date; aggregate computed from zero events"]
            : [],
      };

      // Step 6: Canonicalize before storage
      const canonicalized = canonicalize(aggregate);

      // Step 7: Write org daily aggregate
      const orgAggKey = `agg/org/daily/${org}/${dateStr}`;
      await storage.set(orgAggKey, canonicalized);
      await index_daily_aggregate(org, dateStr, orgAggKey);

      // Step 8: Write per-repo aggregates
      for (const repoAgg of aggregate.by_repo) {
        const repoAggKey = `agg/daily/${org}/${repoAgg.repo}/${dateStr}`;
        const repoAggData = {
          org,
          repo: repoAgg.repo,
          date: dateStr,
          total_events: repoAgg.total_events,
          total_duration_ms: repoAgg.total_duration_ms,
          success_count: repoAgg.success_count,
          fail_count: repoAgg.fail_count,
          incomplete_inputs: aggregate.incomplete_inputs,
          notes: aggregate.notes,
        };
        await storage.set(repoAggKey, canonicalize(repoAggData));
        await index_daily_aggregate(org, dateStr, repoAggKey);
      }

      return aggregate;
    });
  } catch (error) {
    console.error('[Daily] Error recomputing daily aggregate:', error);
    throw error;
  }
}
