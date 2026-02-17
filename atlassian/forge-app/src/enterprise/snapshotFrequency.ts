/**
 * Snapshot Frequency Indicator
 * 
 * FT_PROOF_SLA_RESOLUTION_DISCLOSURE_v1
 * 
 * Compute snapshot frequency bucket from observed snapshot timestamps.
 * Deterministic. No Date. String-based ISO time parsing.
 */

import { storage } from "@forge/api";
import { sanitizeKey } from "../utils/sanitizeKey";

export type FrequencyBucket = "Hour-level" | "Day-level" | "Week-level" | null;

export interface SnapshotFrequencyResult {
  avgHours: number | null;
  bucket: FrequencyBucket;
}

/**
 * Parse ISO UTC time string to extract numeric timestamp
 * NO Date() usage - string-based parsing only
 * Returns numeric value for comparison
 */
function parseIsoToMinutes(isoStr: string): number | null {
  if (!isoStr || typeof isoStr !== "string") return null;

  try {
    // Extract YYYY-MM-DDTHH:MM:SS from isoStr
    // Format: 2025-02-17T15:30:00Z
    const match = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (!match) return null;

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const hours = parseInt(match[4], 10);
    const minutes = parseInt(match[5], 10);

    // Compute days since epoch (approx): days = (year-2000)*365 + month*30 + day
    // This is just for ordering, not precise
    const daysApprox = (year - 2000) * 365 + (month - 1) * 30 + (day - 1);
    
    // Total minutes = days_in_minutes + hours_in_minutes + minutes
    return daysApprox * 24 * 60 + hours * 60 + minutes;
  } catch (err) {
    console.error(`[snapshotFrequency] Parse error: ${err}`);
    return null;
  }
}

/**
 * Compute interval between two ISO timestamp strings (in hours)
 * Uses numeric parsing, no Date
 */
function computeIntervalHours(iso1: string, iso2: string): number | null {
  const mins1 = parseIsoToMinutes(iso1);
  const mins2 = parseIsoToMinutes(iso2);

  if (mins1 === null || mins2 === null) return null;

  // Diff in minutes, then convert to hours
  const diffMinutes = Math.abs(mins1 - mins2);
  return Math.max(1, Math.round(diffMinutes / 60));
}

/**
 * Get snapshot frequency from last 30 snapshots
 */
export async function getSnapshotFrequency(tenantKey: string): Promise<SnapshotFrequencyResult> {
  const headKey = `ft:ledger:v1:${sanitizeKey(tenantKey)}:head`;

  try {
    const headData = await storage.get(headKey);
    if (!headData) {
      return { avgHours: null, bucket: null };
    }

    let current = typeof headData === "string" ? JSON.parse(headData) : headData;
    const timestamps: string[] = [];
    let collected = 0;
    const MAX_COLLECT = 30;

    while (current && collected < MAX_COLLECT) {
      if (current.observedAtUtc) {
        timestamps.push(current.observedAtUtc);
        collected++;
      }

      if (current.previousBlockKey) {
        try {
          const parentData = await storage.get(current.previousBlockKey);
          if (parentData) {
            current = typeof parentData === "string" ? JSON.parse(parentData) : parentData;
          } else {
            break;
          }
        } catch (err) {
          break;
        }
      } else {
        break;
      }
    }

    if (timestamps.length < 2) {
      return { avgHours: null, bucket: null };
    }

    // Compute intervals (timestamps are in reverse chronological order)
    const intervals: number[] = [];
    for (let i = 0; i < timestamps.length - 1; i++) {
      const interval = computeIntervalHours(timestamps[i], timestamps[i + 1]);
      if (interval !== null && interval > 0) {
        intervals.push(interval);
      }
    }

    if (intervals.length === 0) {
      return { avgHours: null, bucket: null };
    }

    const avgHours = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);

    let bucket: FrequencyBucket;
    if (avgHours <= 6) {
      bucket = "Hour-level";
    } else if (avgHours <= 36) {
      bucket = "Day-level";
    } else {
      bucket = "Week-level";
    }

    return { avgHours, bucket };
  } catch (err) {
    console.error(`[snapshotFrequency] Error: ${err}`);
    return { avgHours: null, bucket: null };
  }
}
