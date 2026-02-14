/**
 * Phase 2: Ring buffer for drift history (max 180 entries).
 */

import api from "@forge/api";
import { DriftBufferEntry } from "../continuous-drift/types";

const BUFFER_KEY = "phase2.driftBuffer";
const MAX_ENTRIES = 180;
const QUOTA_BYTES_ESTIMATE = 8 * 1024 * 1024; // 8 MiB
const DEGRADATION_THRESHOLD = 0.80;
const CRITICAL_THRESHOLD = 0.95;

/**
 * Store drift buffer entry in ring buffer.
 * Returns { usageRatio, isNearLimit, isCritical }
 */
export async function storeDriftBufferEntry(
  entry: DriftBufferEntry
): Promise<{
  usageRatio: number;
  isNearLimit: boolean;
  isCritical: boolean;
}> {
  const storage = api.asApp().requestStorage();

  // Load existing buffer
  let buffer: DriftBufferEntry[] = [];
  try {
    const existing = await storage.get(BUFFER_KEY);
    if (existing) {
      buffer = JSON.parse(existing);
    }
  } catch (err) {
    console.error(`[FT_DRIFT_BUFFER_LOAD_FAILED]`, err);
    buffer = [];
  }

  // If buffer already at 180, remove oldest entry
  if (buffer.length >= MAX_ENTRIES) {
    buffer.shift();
  }

  // Append new entry
  buffer.push(entry);

  // Estimate usage
  const baseline = await storage.get("phase2.baselineSnapshot");
  const health = await storage.get("phase2.health");

  const usageBytes =
    (baseline ? JSON.stringify(baseline).length : 0) +
    (health ? JSON.stringify(health).length : 0) +
    JSON.stringify(buffer).length;

  const usageRatio = usageBytes / QUOTA_BYTES_ESTIMATE;
  const isNearLimit = usageRatio >= DEGRADATION_THRESHOLD;
  const isCritical = usageRatio >= CRITICAL_THRESHOLD;

  // Determine what to store
  let bufferToStore = buffer;
  if (isCritical && buffer.length > 0) {
    // Store minimal entry for last item
    const lastEntry = buffer[buffer.length - 1];
    const minimalEntry: DriftBufferEntry = {
      snapshotHash: lastEntry.snapshotHash,
      timestampUtc: lastEntry.timestampUtc,
      drifts: [], // Empty drifts to save space
    };
    bufferToStore = [...buffer.slice(0, -1), minimalEntry];
    console.log(`[FT_DRIFT_STORAGE_NEAR_LIMIT_MINIMAL_ENTRY] ratio=${usageRatio.toFixed(3)}`);
  }

  // Try to store buffer
  try {
    await storage.set(BUFFER_KEY, JSON.stringify(bufferToStore));
    console.log(`[FT_DRIFT_BUFFER_STORED] entries=${bufferToStore.length} usageRatio=${usageRatio.toFixed(3)}`);
  } catch (err) {
    console.error(`[FT_DRIFT_BUFFER_STORE_FAILED]`, err);
    throw err; // Fail closed
  }

  return { usageRatio, isNearLimit, isCritical };
}

/**
 * Get drift count from last 30 days
 */
export async function getDriftCountLast30Days(): Promise<number> {
  const storage = api.asApp().requestStorage();

  try {
    const bufferStr = await storage.get(BUFFER_KEY);
    if (!bufferStr) {
      return 0;
    }

    const buffer: DriftBufferEntry[] = JSON.parse(bufferStr);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let count = 0;
    for (const entry of buffer) {
      const entryDate = new Date(entry.timestampUtc);
      if (entryDate >= thirtyDaysAgo) {
        count += entry.drifts.length;
      }
    }

    return count;
  } catch (err) {
    console.error(`[FT_DRIFT_COUNT_30D_FAILED]`, err);
    return 0;
  }
}

/**
 * Load full buffer
 */
export async function loadDriftBuffer(): Promise<DriftBufferEntry[]> {
  const storage = api.asApp().requestStorage();

  try {
    const bufferStr = await storage.get(BUFFER_KEY);
    if (!bufferStr) {
      return [];
    }
    return JSON.parse(bufferStr);
  } catch (err) {
    console.error(`[FT_DRIFT_BUFFER_LOAD_FAILED]`, err);
    return [];
  }
}
