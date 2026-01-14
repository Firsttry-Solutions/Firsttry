/**
 * Storage wrapper for StatusSnapshot and evidence metadata
 * Uses Forge storage (app scope) exclusively.
 */

import { storage } from "@forge/api";
import { StatusSnapshot, generateSnapshotId } from "./statusSnapshot";
import { sanitizeKey } from "../utils/sanitizeKey";

const STATUS_SNAPSHOT_KEY = (tenantKey: string) => `statusSnapshot:${sanitizeKey(tenantKey)}`;
const EVIDENCE_SNAPSHOT_PREFIX = (tenantKey: string) => `evidenceSnapshot:${sanitizeKey(tenantKey)}`;
const RUN_LEDGER_PREFIX = (tenantKey: string) => `runLedger:${sanitizeKey(tenantKey)}`;

/**
 * Retrieve the current status snapshot for a tenant.
 * Returns null if no snapshot has been written yet.
 */
export async function getStatusSnapshot(
  tenantKey: string
): Promise<StatusSnapshot | null> {
  try {
    const key = STATUS_SNAPSHOT_KEY(tenantKey);
    const data = await storage.get(key);
    return data as StatusSnapshot | null;
  } catch (err) {
    console.error(`[statusStorage] Error reading status snapshot for ${tenantKey}:`, err);
    throw err;
  }
}

/**
 * Write or update the status snapshot for a tenant.
 */
export async function putStatusSnapshot(snapshot: StatusSnapshot): Promise<void> {
  try {
    const key = STATUS_SNAPSHOT_KEY(snapshot.tenantKey);
    await storage.set(key, snapshot);
  } catch (err) {
    console.error(`[statusStorage] Error writing status snapshot for ${snapshot.tenantKey}:`, err);
    throw err;
  }
}

/**
 * List metadata of all evidence snapshots for a tenant.
 * Returns count and latest timestamp.
 */
export async function listEvidenceSnapshotMeta(
  tenantKey: string
): Promise<{ count: number; latestIso: string | null }> {
  try {
    const prefix = EVIDENCE_SNAPSHOT_PREFIX(tenantKey);
    // Forge storage does not have a native list API, so we approximate:
    // In production, you would maintain a separate index. For now, return a stub.
    // This will be enriched once evidence snapshots are actually written.
    return { count: 0, latestIso: null };
  } catch (err) {
    console.error(
      `[statusStorage] Error listing evidence snapshots for ${tenantKey}:`,
      err
    );
    throw err;
  }
}

/**
 * Create a minimal error snapshot when permissions are insufficient.
 */
export function createPermissionErrorSnapshot(
  tenantKey: string,
  reason: string
): StatusSnapshot {
  const nowIso = new Date().toISOString();
  return {
    schemaVersion: 1,
    tenantKey,
    generatedAtIso: nowIso,
    snapshotId: generateSnapshotId(nowIso),
    mode: "onload",

    scheduler: {
      expectedIntervalSec: 3600,
      staleThresholdSec: 7200,
      lastHeartbeatIso: null,
      lastAttemptIso: nowIso,
      lastSuccessIso: null,
      failures7d: 0,
    },

    storage: {
      snapshotCountRetained: 0,
      lastSnapshotIso: null,
    },

    permissions: {
      viewerHasSufficientAccess: false,
      reasonIfFalse: reason,
    },

    checks: [],

    computed: {
      freshness: "STALE",
      health: "ERROR",
      errorReason: `INSUFFICIENT_PERMISSIONS: ${reason}`,
    },
  };
}

/**
 * Create a minimal snapshot indicating no scheduler has run yet.
 */
export function createNoSchedulerSnapshot(tenantKey: string): StatusSnapshot {
  const nowIso = new Date().toISOString();
  return {
    schemaVersion: 1,
    tenantKey,
    generatedAtIso: nowIso,
    snapshotId: generateSnapshotId(nowIso),
    mode: "onload",

    scheduler: {
      expectedIntervalSec: 3600,
      staleThresholdSec: 7200,
      lastHeartbeatIso: null,
      lastAttemptIso: null,
      lastSuccessIso: null,
      failures7d: 0,
    },

    storage: {
      snapshotCountRetained: 0,
      lastSnapshotIso: null,
    },

    permissions: {
      viewerHasSufficientAccess: true,
    },

    checks: [],

    computed: {
      freshness: "STALE",
      health: "ERROR",
      errorReason: "NO_SNAPSHOT_YET_WAIT_FOR_SCHEDULED_RUN",
    },
  };
}

/**
 * Create an ERROR snapshot for resolver failures (fail-closed pattern).
 * Never throws; always returns a valid snapshot.
 */
export function createResolverErrorSnapshot(
  tenantKey: string,
  errorCode: string,
  errorMsg: string
): StatusSnapshot {
  const nowIso = new Date().toISOString();
  return {
    schemaVersion: 1,
    tenantKey,
    generatedAtIso: nowIso,
    snapshotId: `error-${generateSnapshotId(nowIso)}`,
    mode: "manual",

    scheduler: {
      expectedIntervalSec: 3600,
      staleThresholdSec: 7200,
      lastHeartbeatIso: null,
      lastAttemptIso: nowIso,
      lastSuccessIso: null,
      failures7d: 0,
    },

    storage: {
      snapshotCountRetained: 0,
      lastSnapshotIso: null,
    },

    permissions: {
      viewerHasSufficientAccess: true,
    },

    checks: [],

    computed: {
      freshness: "STALE",
      health: "ERROR",
      errorReason: `${errorCode}: ${errorMsg}`,
    },
  };
}
