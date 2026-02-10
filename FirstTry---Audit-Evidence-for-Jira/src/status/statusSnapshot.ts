/**
 * Canonical Status Snapshot Type
 *
 * Single source of truth for all dashboard metrics.
 * Every UI tile, export, and diagnostic is derived from this object.
 * Schema version 1 for migrations.
 */

export type Severity = "OK" | "WARNING" | "DEGRADED" | "ERROR";
export type Freshness = "FRESH" | "STALE";
export type CheckStatus = "READY" | "PENDING" | "FAILED";

export type StatusCheck = {
  id: string;
  name: string;
  status: CheckStatus;
  reasonCode?: string;
  impact?: string;
  lastRunIso?: string | null;
};

export type StatusSnapshot = {
  schemaVersion: 1;

  // identity + traceability
  tenantKey: string;
  generatedAtIso: string; // updated whenever snapshot changes
  snapshotId: string; // deterministic id (ISO + short random) for export consistency
  mode: "scheduled" | "manual" | "onload";

  scheduler: {
    expectedIntervalSec: number; // constant
    staleThresholdSec: number; // constant

    lastHeartbeatIso: string | null; // set at start of every scheduled trigger
    lastAttemptIso: string | null; // set at every attempt (scheduled/manual)
    lastSuccessIso: string | null; // set only when evidence snapshot is successfully written

    failures7d: number; // computed from run ledger
  };

  storage: {
    snapshotCountRetained: number; // computed from stored evidence snapshots
    lastSnapshotIso: string | null; // must reflect evidence snapshot timestamp
  };

  permissions: {
    viewerHasSufficientAccess: boolean;
    reasonIfFalse?: string;
  };

  checks: StatusCheck[];

  computed: {
    freshness: Freshness; // derived
    health: Severity; // derived
    degradedReason?: string; // required when health != OK
    errorReason?: string; // required when health == ERROR
  };
};

/**
 * Generate a deterministic snapshot ID from timestamp + random salt
 */
export function generateSnapshotId(isoString: string): string {
  const ts = isoString.replace(/[^\d]/g, "").slice(0, 12); // yyyyMMddHHmm
  const salt = Math.random().toString(36).slice(2, 6); // 4-char random
  return `${ts}-${salt}`;
}
