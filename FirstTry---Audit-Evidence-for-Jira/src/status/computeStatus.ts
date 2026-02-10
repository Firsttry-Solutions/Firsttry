/**
 * Deterministic health computation
 * Single logic source for all health state transitions.
 */

import { Severity, Freshness, StatusSnapshot } from "./statusSnapshot";

/**
 * Compute freshness: FRESH if last success is within threshold, else STALE.
 */
export function computeFreshness(
  nowIso: string,
  lastSuccessIso: string | null,
  staleThresholdSec: number
): Freshness {
  if (!lastSuccessIso) return "STALE";

  const now = new Date(nowIso).getTime();
  const lastSuccess = new Date(lastSuccessIso).getTime();
  const ageMs = now - lastSuccess;
  const ageSec = ageMs / 1000;

  if (ageSec <= staleThresholdSec) return "FRESH";
  return "STALE";
}

/**
 * Compute health: Deterministic rules applied in order.
 *
 * Returns: { health, degradedReason?, errorReason? }
 *
 * Rules (applied in order, first match wins):
 * 1. If insufficient permissions → ERROR with reason
 * 2. Else if no heartbeat AND no snapshots → ERROR (no scheduler run yet)
 * 3. Else if freshness==STALE → DEGRADED (data is old)
 * 4. Else if failures7d > 0 → WARNING (recent failures but currently fresh)
 * 5. Else → OK
 */
export function computeHealth(snapshot: StatusSnapshot): {
  health: Severity;
  degradedReason?: string;
  errorReason?: string;
} {
  // Rule 1: Permissions check
  if (!snapshot.permissions.viewerHasSufficientAccess) {
    return {
      health: "ERROR",
      errorReason: `INSUFFICIENT_PERMISSIONS: ${
        snapshot.permissions.reasonIfFalse || "Unknown reason"
      }`,
    };
  }

  // Rule 2: No scheduler heartbeat and no snapshots
  if (snapshot.scheduler.lastHeartbeatIso === null && snapshot.storage.snapshotCountRetained === 0) {
    return {
      health: "ERROR",
      errorReason: "NO_SCHEDULER_HEARTBEAT_AND_NO_SNAPSHOTS",
    };
  }

  // Rule 3: Data is stale
  const freshness = computeFreshness(
    snapshot.generatedAtIso,
    snapshot.scheduler.lastSuccessIso,
    snapshot.scheduler.staleThresholdSec
  );

  if (freshness === "STALE") {
    return {
      health: "DEGRADED",
      degradedReason: `STALE_DATA (last success: ${snapshot.scheduler.lastSuccessIso || "never"})`,
    };
  }

  // Rule 4: Recent failures
  if (snapshot.scheduler.failures7d > 0) {
    return {
      health: "WARNING",
      degradedReason: `RECENT_FAILURES (${snapshot.scheduler.failures7d} in last 7 days)`,
    };
  }

  // Rule 5: All good
  return { health: "OK" };
}

/**
 * Apply health computation to a snapshot in-place.
 * Returns the mutated snapshot.
 */
export function applyHealthComputation(snapshot: StatusSnapshot): StatusSnapshot {
  const freshness = computeFreshness(
    snapshot.generatedAtIso,
    snapshot.scheduler.lastSuccessIso,
    snapshot.scheduler.staleThresholdSec
  );

  const { health, degradedReason, errorReason } = computeHealth(snapshot);

  snapshot.computed = {
    freshness,
    health,
    degradedReason,
    errorReason,
  };

  return snapshot;
}
