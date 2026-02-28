/**
 * v5.6.5 Scheduled Snapshot Kickoff
 *
 * Forge scheduledTrigger handler (weekly interval).
 * - Opt-in: reads SCHEDULE_ENABLED_KEY; exits silently if disabled (default OFF)
 * - Acquires advisory lock per ISO-week to prevent double-runs
 * - Deletes stale locks (missing expiry or past TTL) — eliminates pre-v5 DoS
 * - Records status + missed-run signals
 * - Delegates to enqueueSnapshotMaster adapter (wired to Phase 6 SnapshotCapturer)
 * - Never throws (scheduled triggers must not crash)
 * AUDIT: Phase05 remediation - keys must be deterministic
 */
import * as crypto from "crypto";
import { storage } from "@forge/api";
import { makeGlobalStorageKey } from "../../shared/storageKey";
import {
  SCHEDULE_ENABLED_KEY,
  SCHEDULE_STATUS_KEY,
  SCHEDULE_LOCK_PREFIX,
  SCHEDULE_LOCK_TTL_MS,
  DEPLOY_OBSERVED_AT_KEY,
  V565_SCHEMA_VERSION,
  nowUtcIso,
  nowEpochMs,
  capReason,
} from "../../v565/constants";
import { setJobStatus } from "./jobStatus";
import { abortIfMasterFailed } from "./workerAbort";
import { enqueueSnapshotMaster } from "./snapshotMasterEnqueueAdapter";

/** ISO-week string: YYYY-WNN */
function isoWeekKey(d: Date): string {
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const dayDiff = Math.floor((d.getTime() - jan4.getTime()) / 86400000);
  const weekNum = Math.ceil((dayDiff + jan4.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

// AUDIT: Phase05 remediation - Helper for lock key (global, no tenant data)
function getScheduleLockKey(weekKey: string): string {
  return makeGlobalStorageKey("ft_v565_schedule_lock", weekKey);
}

type LockRecord = {
  schemaVersion: string;
  acquiredAtUtc: string;
  acquiredEpochMs: number;
  expiresEpochMs?: number;
  jobId: string;
};

type ScheduleStatusRecord = {
  schemaVersion: string;
  lastAttemptUtc: string;
  outcome: "SUCCESS" | "SKIPPED_DISABLED" | "SKIPPED_LOCKED" | "FAILED";
  jobId?: string;
  error?: string;
  weekKey?: string;
};

export const run = async (event?: any): Promise<void> => {
  const now = new Date();
  const weekKey = isoWeekKey(now);
  const lockKey = getScheduleLockKey(weekKey);
  const jobId = crypto.randomUUID();

  console.log(`FT_PROOF_SCHEDULE_TRIGGER_ENTRY_v1 weekKey=${weekKey} jobId=${jobId}`);

  try {
    // Record deploy observation (for offset disclosure) — set-once, not overwritten
    const existingObserved = (await storage.get(DEPLOY_OBSERVED_AT_KEY)) as string | undefined;
    if (!existingObserved) {
      const observed = nowUtcIso();
      await storage.set(DEPLOY_OBSERVED_AT_KEY, observed);
      console.log("FT_PROOF_DEPLOY_RESET_AWARE_v1 observedAtUtc=" + observed);
    }

    // Opt-in gate: default OFF
    const enabled = (await storage.get(SCHEDULE_ENABLED_KEY)) === true;
    if (!enabled) {
      console.log("FT_PROOF_SCHEDULE_SKIPPED_DISABLED_v1 weekKey=" + weekKey);
      await storage.set(SCHEDULE_STATUS_KEY, {
        schemaVersion: V565_SCHEMA_VERSION,
        lastAttemptUtc: nowUtcIso(),
        outcome: "SKIPPED_DISABLED",
        weekKey,
      } as ScheduleStatusRecord);
      return;
    }

    // Worker abort check
    if (await abortIfMasterFailed(jobId)) return;

    // Lock acquisition with stale lock deletion
    const existingLock = (await storage.get(lockKey)) as LockRecord | undefined;
    if (existingLock) {
      // Stale lock deletion: if lock is missing expiry or past TTL, delete it
      const hasValidExpiry = typeof existingLock.expiresEpochMs === "number" && existingLock.expiresEpochMs > 0;
      const isExpired = hasValidExpiry && existingLock.expiresEpochMs! < nowEpochMs();
      const isMissingExpiry = !hasValidExpiry;

      // Also detect locks older than TTL based on acquiredEpochMs
      const isStaleByAge =
        typeof existingLock.acquiredEpochMs === "number" &&
        (nowEpochMs() - existingLock.acquiredEpochMs) > SCHEDULE_LOCK_TTL_MS;

      if (isExpired || isMissingExpiry || isStaleByAge) {
        console.log(`FT_PROOF_STALE_LOCK_DELETED_v1 weekKey=${weekKey} reason=${isExpired ? "expired" : isMissingExpiry ? "missingExpiry" : "staleByAge"}`);
        await storage.delete(lockKey);
        // Fall through to acquire lock
      } else {
        console.log("FT_PROOF_SCHEDULE_SKIPPED_LOCKED_v1 weekKey=" + weekKey + " existingJobId=" + (existingLock.jobId || "unknown"));
        await storage.set(SCHEDULE_STATUS_KEY, {
          schemaVersion: V565_SCHEMA_VERSION,
          lastAttemptUtc: nowUtcIso(),
          outcome: "SKIPPED_LOCKED",
          weekKey,
        } as ScheduleStatusRecord);
        return;
      }
    }

    // Acquire lock
    const lockRecord: LockRecord = {
      schemaVersion: V565_SCHEMA_VERSION,
      acquiredAtUtc: nowUtcIso(),
      acquiredEpochMs: nowEpochMs(),
      expiresEpochMs: nowEpochMs() + SCHEDULE_LOCK_TTL_MS,
      jobId,
    };
    await storage.set(lockKey, lockRecord);

    // Re-read to confirm we hold the lock (best-effort race detection)
    const lockedRead = (await storage.get(lockKey)) as LockRecord | undefined;
    if (!lockedRead || lockedRead.jobId !== jobId) {
      console.log("FT_PROOF_SCHEDULE_LOCK_LOST_RACE_v1 weekKey=" + weekKey);
      await storage.set(SCHEDULE_STATUS_KEY, {
        schemaVersion: V565_SCHEMA_VERSION,
        lastAttemptUtc: nowUtcIso(),
        outcome: "SKIPPED_LOCKED",
        weekKey,
      } as ScheduleStatusRecord);
      return;
    }

    // Delegate to adapter
    await enqueueSnapshotMaster({
      jobId,
      executionContext: "APP",
      trigger: "SCHEDULED",
      dryRun: false,
      context: event,
    });

    console.log("FT_PROOF_SCHEDULE_SUCCESS_v1 weekKey=" + weekKey + " jobId=" + jobId);
    await storage.set(SCHEDULE_STATUS_KEY, {
      schemaVersion: V565_SCHEMA_VERSION,
      lastAttemptUtc: nowUtcIso(),
      outcome: "SUCCESS",
      jobId,
      weekKey,
    } as ScheduleStatusRecord);

  } catch (e: any) {
    const errMsg = capReason(String(e?.message || e));
    console.error("FT_PROOF_SCHEDULE_FAILED_v1 weekKey=" + weekKey + " jobId=" + jobId + " error=" + errMsg);
    try {
      await setJobStatus(jobId, "FAILED");
      await storage.set(SCHEDULE_STATUS_KEY, {
        schemaVersion: V565_SCHEMA_VERSION,
        lastAttemptUtc: nowUtcIso(),
        outcome: "FAILED",
        jobId,
        error: errMsg,
        weekKey,
      } as ScheduleStatusRecord);
    } catch { /* best-effort status persistence */ }
    // MUST NOT throw — scheduled triggers must not crash
  }
};
