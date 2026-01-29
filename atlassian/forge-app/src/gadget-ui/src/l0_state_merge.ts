/**
 * L0 Dashboard State Merge Guard
 * 
 * Implements invariant: AVAILABLE snapshot state can NEVER be downgraded to NO_SNAPSHOT
 * unless an explicit "reset" action or reason code exists and is gated.
 * 
 * INVARIANT RULE:
 * If previousState.status === "AVAILABLE" AND previousState.snapshotId is truthy
 * AND nextState.status === "NO_SNAPSHOT", the downgrade is BLOCKED.
 * Return previousState and attach reason="INVARIANT_BLOCKED_DOWNGRADE_AVAILABLE_TO_NO_SNAPSHOT".
 */

import { L0DashboardState } from "./l0_snapshot_mapper";

/**
 * Known "reset" reason codes that are ALLOWED to downgrade AVAILABLE→NO_SNAPSHOT
 * Currently: EMPTY (no explicit reset reasons exist in backend contract)
 * If backend adds explicit admin-initiated reset, add it here.
 */
const ALLOWED_DOWNGRADE_REASONS = new Set<string>([
  // "ADMIN_RESET_BY_FORCE", // Example: if backend adds this
  // "EXPLICIT_CLEAR_ACTION",
]);

/**
 * Global flag to prevent log spam for repeated invariant blocks
 * (dedupe within session)
 */
let lastInvariantBlockLogTime = 0;
const INVARIANT_LOG_THROTTLE_MS = 5000; // log max once per 5 seconds

/**
 * Merge previous dashboard state with next mapped state
 * 
 * Implements:
 * 1) Prevent AVAILABLE→NO_SNAPSHOT downgrade unless explicitly allowed
 * 2) Allow all other transitions (INITIALIZING→AVAILABLE, NO_SNAPSHOT→AVAILABLE, etc.)
 * 3) Allow newer AVAILABLE snapshot to replace older AVAILABLE
 * 4) Log when invariant blocks a downgrade (throttled)
 * 
 * @param prev Previous dashboard state (can be null/undefined on first load)
 * @param next Next mapped state from response
 * @returns Merged state (either next, or prev if invariant blocked)
 */
export function mergeDashboardState(
  prev: L0DashboardState | null | undefined,
  next: L0DashboardState
): L0DashboardState {
  // No previous state: use next as-is (first load)
  if (!prev) {
    return next;
  }

  // Extract key fields from both states
  const prevStatus = prev.status;
  const nextStatus = next.status;
  const prevHasSnapshot = prev.snapshotId !== null && prev.snapshotId !== undefined;
  const nextHasSnapshot = next.snapshotId !== null && next.snapshotId !== undefined;

  // =========================================================================
  // INVARIANT GUARD: Prevent AVAILABLE→NO_SNAPSHOT downgrade
  // =========================================================================
  if (
    prevStatus === "AVAILABLE" &&
    prevHasSnapshot &&
    nextStatus === "NO_SNAPSHOT"
  ) {
    // Check if this downgrade is explicitly allowed by reason code
    const isAllowedReason = next.reasonCode && ALLOWED_DOWNGRADE_REASONS.has(next.reasonCode);

    if (!isAllowedReason) {
      // BLOCK: Log warning and return previous state
      const now = Date.now();
      if (now - lastInvariantBlockLogTime > INVARIANT_LOG_THROTTLE_MS) {
        console.warn(
          "[UI_INVARIANT_BLOCK] AVAILABLE→NO_SNAPSHOT downgrade blocked. Retaining snapshot.",
          {
            prevSnapshotId: prev.snapshotId,
            prevCreatedAtUtc: prev.createdAtUtc,
            nextStatus,
            reason: "No explicit reset approval found",
            timestamp: new Date().toISOString(),
          }
        );
        lastInvariantBlockLogTime = now;
      }

      // Return previous state but mark with invariant-blocked reason
      return {
        ...prev,
        // Add a marker that invariant blocked a downgrade
        // (This can be used in UI to show a subtle warning if desired)
        reasonCode: "INVARIANT_BLOCKED_DOWNGRADE_AVAILABLE_TO_NO_SNAPSHOT",
      };
    }
  }

  // =========================================================================
  // ALLOW: AVAILABLE→AVAILABLE (newer snapshot)
  // =========================================================================
  if (prevStatus === "AVAILABLE" && nextStatus === "AVAILABLE") {
    // If next has a newer snapshotId, use it
    if (nextHasSnapshot && next.snapshotId !== prev.snapshotId) {
      return next; // Newer snapshot replaces older
    }
    // Same snapshot, keep current
    if (next.snapshotId === prev.snapshotId) {
      return prev; // No change needed
    }
  }

  // =========================================================================
  // ALLOW: All other transitions (NO_SNAPSHOT→AVAILABLE, ERROR→AVAILABLE, etc.)
  // =========================================================================
  return next;
}

/**
 * Test-only export: Reset throttle state for unit tests
 * (allows tests to verify log output without waiting 5 seconds)
 */
export function __resetInvariantLogThrottle__() {
  lastInvariantBlockLogTime = 0;
}
