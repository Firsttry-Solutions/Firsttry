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
 * Implements STRICT INVARIANTS:
 * 1) If prev.status=AVAILABLE + prev.snapshotId exists:
 *    - BLOCK next.status=NO_SNAPSHOT (unless explicitly allowed)
 *    - BLOCK next.status=INITIALIZING (prevent "reset" flicker)
 *    - BLOCK next.status=AVAILABLE if next.snapshotId is null/undefined (cannot prove it's valid)
 *    - BLOCK next.status=AVAILABLE if next.createdAtUtc < prev.createdAtUtc (cannot downgrade to older)
 *    - BLOCK next.status=AVAILABLE if next.snapshotId differs but next.createdAtUtc missing (cannot prove newer)
 * 2) Allow all other transitions (NO_SNAPSHOT→AVAILABLE, ERROR→AVAILABLE, etc.)
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
  // INVARIANT: If prev is AVAILABLE with snapshot, protect it strictly
  // =========================================================================
  if (prevStatus === "AVAILABLE" && prevHasSnapshot) {
    
    // RULE 1: BLOCK AVAILABLE→NO_SNAPSHOT unless explicitly allowed
    if (nextStatus === "NO_SNAPSHOT") {
      const isAllowedReason = next.reasonCode && ALLOWED_DOWNGRADE_REASONS.has(next.reasonCode);
      if (!isAllowedReason) {
        const now = Date.now();
        if (now - lastInvariantBlockLogTime > INVARIANT_LOG_THROTTLE_MS) {
          console.warn(
            "[UI_INVARIANT_BLOCK] AVAILABLE→NO_SNAPSHOT downgrade blocked.",
            { snapshotId: prev.snapshotId, createdAtUtc: prev.createdAtUtc }
          );
          lastInvariantBlockLogTime = now;
        }
        return {
          ...prev,
          reasonCode: "INVARIANT_BLOCKED_DOWNGRADE_AVAILABLE_TO_NO_SNAPSHOT",
        };
      }
    }

    // RULE 2: BLOCK AVAILABLE→INITIALIZING (prevent reset flicker)
    if (nextStatus === "INITIALIZING") {
      const now = Date.now();
      if (now - lastInvariantBlockLogTime > INVARIANT_LOG_THROTTLE_MS) {
        console.warn(
          "[UI_INVARIANT_BLOCK] AVAILABLE→INITIALIZING reset blocked.",
          { snapshotId: prev.snapshotId, createdAtUtc: prev.createdAtUtc }
        );
        lastInvariantBlockLogTime = now;
      }
      return {
        ...prev,
        reasonCode: "INVARIANT_BLOCKED_DOWNGRADE_AVAILABLE_TO_INITIALIZING",
      };
    }

    // RULE 3: For AVAILABLE→AVAILABLE, enforce strict replacement rules
    if (nextStatus === "AVAILABLE") {
      // RULE 3a: If next.snapshotId is missing, cannot replace prev (cannot verify validity)
      if (!nextHasSnapshot) {
        return prev; // Keep prev, next is invalid
      }

      // RULE 3b: If snapshotId changed, must prove next is newer via createdAtUtc
      if (next.snapshotId !== prev.snapshotId) {
        // Both must have createdAtUtc to compare
        if (!prev.createdAtUtc || !next.createdAtUtc) {
          return prev; // Cannot prove newer, keep prev
        }

        // Compare timestamps: next must be >= prev
        const prevTime = new Date(prev.createdAtUtc).getTime();
        const nextTime = new Date(next.createdAtUtc).getTime();
        
        if (nextTime < prevTime) {
          return prev; // Older timestamp, keep prev
        }

        // nextTime >= prevTime: accept next
        return next;
      }

      // RULE 3c: Same snapshotId, keep prev (no update needed)
      if (next.snapshotId === prev.snapshotId) {
        return prev;
      }
    }
  }

  // =========================================================================
  // ALLOW: All other transitions
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
