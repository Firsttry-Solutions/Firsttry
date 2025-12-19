/**
 * Weekly Aggregation (PHASE 2)
 * 
 * Builds weekly aggregates from daily aggregates only (no raw shard re-reading).
 * Determines days in ISO week, reads daily aggregates, sums deterministically.
 * 
 * Storage keys written:
 * - agg/org/weekly/{org}/{yyyy-WW}
 * - agg/weekly/{org}/{repo}/{yyyy-WW} (per-repo rollup)
 */

let api: any;
try {
  api = require('@forge/api').default;
} catch (e) {
  // @forge/api only available in Forge runtime, not in tests
}

import { index_weekly_aggregate, get_daily_aggregates_for_day } from '../storage_index';
import { canonicalize } from '../canonicalize';

/**
 * Weekly aggregate schema
 */
export interface WeeklyAggregate {
  org: string;
  week: string; // yyyy-WW
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
  days_expected: number;
  days_present: number;
  missing_days: string[]; // sorted list of yyyy-mm-dd
  incomplete_inputs: {
    raw_shards_missing: boolean;
  };
  notes: string[];
}

/**
 * Get ISO week number and year from date string (yyyy-mm-dd)
 * Returns { year: number, week: number }
 */
function getISOWeek(dateStr: string): { year: number; week: number } {
  const date = new Date(dateStr + 'T00:00:00Z'); // Force UTC
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }

  // ISO week calculation
  const tempDate = new Date(date);
  tempDate.setUTCDate(tempDate.getUTCDate() + 4 - (tempDate.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(
    ((tempDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return { year: tempDate.getUTCFullYear(), week: weekNumber };
}

/**
 * Get all dates in an ISO week (yyyy-WW format)
 * Returns array of yyyy-mm-dd strings sorted
 */
function getDaysInWeek(weekKey: string): string[] {
  const [yearStr, weekStr] = weekKey.split('-');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);

  // Start from Jan 4 of year (always in week 1)
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const weekStart = new Date(jan4);
  const dayOfWeek = jan4.getUTCDay();
  weekStart.setUTCDate(4 - (dayOfWeek || 7) + (week - 1) * 7);

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    days.push(`${y}-${m}-${day}`);
  }
  return days;
}

/**
 * Recompute weekly aggregate from daily aggregates
 * 
 * @param org Organization key
 * @param weekKey Week in yyyy-WW format
 * @returns Weekly aggregate with missing days tracked
 */
export async function recompute_week(
  org: string,
  weekKey: string
): Promise<WeeklyAggregate> {
  try {
    return await api.asApp().requestStorage(async (storage) => {
      // Step 1: Get all days in this week
      const daysInWeek = getDaysInWeek(weekKey);
      const days_expected = daysInWeek.length;

      // Step 2: Read daily aggregates for each day
      const dailyAggregates: Record<string, any>[] = [];
      const missingDays: string[] = [];

      for (const dateStr of daysInWeek) {
        const orgDailyKey = `agg/org/daily/${org}/${dateStr}`;
        const dailyAgg = await storage.get(orgDailyKey);
        if (dailyAgg) {
          dailyAggregates.push(dailyAgg);
        } else {
          missingDays.push(dateStr);
        }
      }

      // Step 3: Initialize rollup maps
      const repoRollup = new Map<string, any>();
      const gateRollup = new Map<string, number>();
      const profileRollup = new Map<string, number>();

      // Step 4: Sum aggregates
      let totalEvents = 0;
      let totalDurationMs = 0;
      let successCount = 0;
      let failCount = 0;
      let cacheHitCount = 0;
      let cacheMissCount = 0;
      let retryTotal = 0;

      for (const daily of dailyAggregates) {
        totalEvents += daily.total_events || 0;
        totalDurationMs += daily.total_duration_ms || 0;
        successCount += daily.success_count || 0;
        failCount += daily.fail_count || 0;
        cacheHitCount += daily.cache_hit_count || 0;
        cacheMissCount += daily.cache_miss_count || 0;
        retryTotal += daily.retry_total || 0;

        // Sum by_repo
        if (daily.by_repo && Array.isArray(daily.by_repo)) {
          for (const repoData of daily.by_repo) {
            const existing = repoRollup.get(repoData.repo) || {
              repo: repoData.repo,
              total_events: 0,
              success_count: 0,
              fail_count: 0,
              total_duration_ms: 0,
            };
            existing.total_events += repoData.total_events || 0;
            existing.success_count += repoData.success_count || 0;
            existing.fail_count += repoData.fail_count || 0;
            existing.total_duration_ms += repoData.total_duration_ms || 0;
            repoRollup.set(repoData.repo, existing);
          }
        }

        // Sum by_gate
        if (daily.by_gate && Array.isArray(daily.by_gate)) {
          for (const gateData of daily.by_gate) {
            gateRollup.set(gateData.gate, (gateRollup.get(gateData.gate) || 0) + gateData.count);
          }
        }

        // Sum by_profile
        if (daily.by_profile && Array.isArray(daily.by_profile)) {
          for (const profileData of daily.by_profile) {
            profileRollup.set(
              profileData.profile,
              (profileRollup.get(profileData.profile) || 0) + profileData.count
            );
          }
        }
      }

      // Step 5: Build weekly aggregate
      const aggregate: WeeklyAggregate = {
        org,
        week: weekKey,
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
        days_expected,
        days_present: daysInWeek.length - missingDays.length,
        missing_days: missingDays.sort(),
        incomplete_inputs: {
          raw_shards_missing: missingDays.length > 0,
        },
        notes:
          missingDays.length > 0
            ? [`Missing aggregates for ${missingDays.length} of ${days_expected} days`]
            : [],
      };

      // Step 6: Canonicalize
      const canonicalized = canonicalize(aggregate);

      // Step 7: Write org weekly aggregate
      const orgWeeklyKey = `agg/org/weekly/${org}/${weekKey}`;
      await storage.set(orgWeeklyKey, canonicalized);
      await index_weekly_aggregate(org, weekKey, orgWeeklyKey);

      // Step 8: Write per-repo weekly aggregates
      for (const repoAgg of aggregate.by_repo) {
        const repoWeeklyKey = `agg/weekly/${org}/${repoAgg.repo}/${weekKey}`;
        const repoWeeklyData = {
          org,
          repo: repoAgg.repo,
          week: weekKey,
          total_events: repoAgg.total_events,
          total_duration_ms: repoAgg.total_duration_ms,
          success_count: repoAgg.success_count,
          fail_count: repoAgg.fail_count,
          missing_days: aggregate.missing_days,
          incomplete_inputs: aggregate.incomplete_inputs,
          notes: aggregate.notes,
        };
        await storage.set(repoWeeklyKey, canonicalize(repoWeeklyData));
        await index_weekly_aggregate(org, weekKey, repoWeeklyKey);
      }

      return aggregate;
    });
  } catch (error) {
    console.error('[Weekly] Error recomputing weekly aggregate:', error);
    throw error;
  }
}
