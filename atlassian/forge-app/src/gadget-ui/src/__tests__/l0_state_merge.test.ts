/**
 * REGRESSION TESTS: L0 Dashboard State Merge Invariant
 * 
 * CRITICAL: These tests must FAIL if the invariant is broken.
 * They verify that AVAILABLE state can never be downgraded to NO_SNAPSHOT
 * unless an explicit reset reason exists.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { mergeDashboardState, __resetInvariantLogThrottle__ } from "../l0_state_merge";
import type { L0DashboardState } from "../l0_snapshot_mapper";

describe("L0 Dashboard State Merge Invariant Guard", () => {
  beforeEach(() => {
    __resetInvariantLogThrottle__();
  });

  // =========================================================================
  // TEST A: BLOCKS DOWNGRADE - AVAILABLE with snapshot cannot become NO_SNAPSHOT
  // =========================================================================
  describe("TEST_A: Blocks AVAILABLE→NO_SNAPSHOT downgrade", () => {
    it("should NOT allow downgrade from AVAILABLE to NO_SNAPSHOT", () => {
      const prevState: L0DashboardState = {
        status: "AVAILABLE",
        reasonCode: "PROOF_OK",
        snapshotId: "snap_123abc",
        createdAtUtc: "2026-01-24T10:00:00.000Z",
        schemaVersion: "L0",
        error: null,
        note: "Valid snapshot",
      };

      const nextState: L0DashboardState = {
        status: "NO_SNAPSHOT",
        reasonCode: "STATE_NO_SNAPSHOT",
        snapshotId: null,
        createdAtUtc: null,
        schemaVersion: "L0",
        error: "NO_SNAPSHOT_POINTER",
        note: "No snapshot available",
      };

      const merged = mergeDashboardState(prevState, nextState);

      // INVARIANT: Must keep AVAILABLE, not downgrade to NO_SNAPSHOT
      expect(merged.status).toBe("AVAILABLE");
      expect(merged.snapshotId).toBe("snap_123abc");
      expect(merged.createdAtUtc).toBe("2026-01-24T10:00:00.000Z");
      expect(merged.reasonCode).toBe("INVARIANT_BLOCKED_DOWNGRADE_AVAILABLE_TO_NO_SNAPSHOT");
    });

    it("should block downgrade even if next state lacks snapshotId", () => {
      const prevState: L0DashboardState = {
        status: "AVAILABLE",
        reasonCode: "PROOF_OK",
        snapshotId: "snap_xyz",
        createdAtUtc: "2026-01-24T11:00:00.000Z",
        schemaVersion: "L0",
        error: null,
        note: "Snapshot present",
      };

      const nextState: L0DashboardState = {
        status: "NO_SNAPSHOT",
        reasonCode: "STATE_NO_SNAPSHOT",
        snapshotId: null, // ← next has no snapshot
        createdAtUtc: null,
        schemaVersion: "L0",
        error: "SNAPSHOT_MISSING",
        note: "No snapshot",
      };

      const merged = mergeDashboardState(prevState, nextState);

      expect(merged.status).toBe("AVAILABLE");
      expect(merged.snapshotId).toBe("snap_xyz"); // Kept from prev
    });
  });

  // =========================================================================
  // TEST B: ALLOWS UPGRADE - NO_SNAPSHOT can become AVAILABLE
  // =========================================================================
  describe("TEST_B: Allows NO_SNAPSHOT→AVAILABLE upgrade", () => {
    it("should upgrade from NO_SNAPSHOT to AVAILABLE", () => {
      const prevState: L0DashboardState = {
        status: "NO_SNAPSHOT",
        reasonCode: "STATE_NO_SNAPSHOT",
        snapshotId: null,
        createdAtUtc: null,
        schemaVersion: "L0",
        error: "NO_SNAPSHOT_POINTER",
        note: "No snapshot yet",
      };

      const nextState: L0DashboardState = {
        status: "AVAILABLE",
        reasonCode: "PROOF_OK",
        snapshotId: "snap_newdata",
        createdAtUtc: "2026-01-24T12:00:00.000Z",
        schemaVersion: "L0",
        error: null,
        note: "Fresh snapshot",
      };

      const merged = mergeDashboardState(prevState, nextState);

      expect(merged.status).toBe("AVAILABLE");
      expect(merged.snapshotId).toBe("snap_newdata");
      expect(merged.createdAtUtc).toBe("2026-01-24T12:00:00.000Z");
    });
  });

  // =========================================================================
  // TEST C: ALLOWS NEWER SNAPSHOT - AVAILABLE can be replaced with newer AVAILABLE
  // =========================================================================
  describe("TEST_C: Allows AVAILABLE→AVAILABLE (newer snapshot)", () => {
    it("should allow upgrade to newer snapshot when both AVAILABLE", () => {
      const prevState: L0DashboardState = {
        status: "AVAILABLE",
        reasonCode: "PROOF_OK",
        snapshotId: "snap_old",
        createdAtUtc: "2026-01-24T10:00:00.000Z",
        schemaVersion: "L0",
        error: null,
        note: "Older snapshot",
      };

      const nextState: L0DashboardState = {
        status: "AVAILABLE",
        reasonCode: "PROOF_OK",
        snapshotId: "snap_new",
        createdAtUtc: "2026-01-24T14:00:00.000Z",
        schemaVersion: "L0",
        error: null,
        note: "Newer snapshot",
      };

      const merged = mergeDashboardState(prevState, nextState);

      // Should use new snapshot
      expect(merged.status).toBe("AVAILABLE");
      expect(merged.snapshotId).toBe("snap_new");
      expect(merged.createdAtUtc).toBe("2026-01-24T14:00:00.000Z");
    });

    it("should keep same snapshot when both AVAILABLE with same ID", () => {
      const prevState: L0DashboardState = {
        status: "AVAILABLE",
        reasonCode: "PROOF_OK",
        snapshotId: "snap_same",
        createdAtUtc: "2026-01-24T10:00:00.000Z",
        schemaVersion: "L0",
        error: null,
        note: "Snapshot",
      };

      const nextState: L0DashboardState = {
        status: "AVAILABLE",
        reasonCode: "PROOF_OK",
        snapshotId: "snap_same", // Same ID
        createdAtUtc: "2026-01-24T10:00:00.000Z",
        schemaVersion: "L0",
        error: null,
        note: "Snapshot",
      };

      const merged = mergeDashboardState(prevState, nextState);

      expect(merged.status).toBe("AVAILABLE");
      expect(merged.snapshotId).toBe("snap_same");
    });
  });

  // =========================================================================
  // TEST D: FIRST LOAD - NO PREVIOUS STATE
  // =========================================================================
  describe("TEST_D: First load (no previous state)", () => {
    it("should use next state when prev is null", () => {
      const nextState: L0DashboardState = {
        status: "AVAILABLE",
        reasonCode: "PROOF_OK",
        snapshotId: "snap_first",
        createdAtUtc: "2026-01-24T09:00:00.000Z",
        schemaVersion: "L0",
        error: null,
        note: "First load",
      };

      const merged = mergeDashboardState(null, nextState);

      expect(merged.status).toBe("AVAILABLE");
      expect(merged.snapshotId).toBe("snap_first");
    });

    it("should use next state when prev is undefined", () => {
      const nextState: L0DashboardState = {
        status: "NO_SNAPSHOT",
        reasonCode: "STATE_NO_SNAPSHOT",
        snapshotId: null,
        createdAtUtc: null,
        schemaVersion: "L0",
        error: "NO_SNAPSHOT_POINTER",
        note: "First load, no snapshot",
      };

      const merged = mergeDashboardState(undefined, nextState);

      expect(merged.status).toBe("NO_SNAPSHOT");
      expect(merged.snapshotId).toBeNull();
    });
  });

  // =========================================================================
  // TEST E: OTHER STATE TRANSITIONS (INVALID, ERROR, etc.)
  // =========================================================================
  describe("TEST_E: Other valid state transitions", () => {
    it("should allow INVALID_SNAPSHOT→AVAILABLE", () => {
      const prevState: L0DashboardState = {
        status: "INVALID_SNAPSHOT",
        reasonCode: "STATE_INVALID_SNAPSHOT",
        snapshotId: null,
        createdAtUtc: null,
        schemaVersion: "L0",
        error: "SNAPSHOT_SCHEMA_MISMATCH",
        note: "Invalid",
      };

      const nextState: L0DashboardState = {
        status: "AVAILABLE",
        reasonCode: "PROOF_OK",
        snapshotId: "snap_fixed",
        createdAtUtc: "2026-01-24T15:00:00.000Z",
        schemaVersion: "L0",
        error: null,
        note: "Now valid",
      };

      const merged = mergeDashboardState(prevState, nextState);

      expect(merged.status).toBe("AVAILABLE");
      expect(merged.snapshotId).toBe("snap_fixed");
    });

    it("should allow HARD_ERROR→AVAILABLE", () => {
      const prevState: L0DashboardState = {
        status: "HARD_ERROR",
        reasonCode: "STATE_HARD_ERROR",
        snapshotId: null,
        createdAtUtc: null,
        schemaVersion: "L0",
        error: "FT_UNKNOWN_ERROR",
        note: "Error state",
      };

      const nextState: L0DashboardState = {
        status: "AVAILABLE",
        reasonCode: "PROOF_OK",
        snapshotId: "snap_recovered",
        createdAtUtc: "2026-01-24T16:00:00.000Z",
        schemaVersion: "L0",
        error: null,
        note: "Recovered",
      };

      const merged = mergeDashboardState(prevState, nextState);

      expect(merged.status).toBe("AVAILABLE");
      expect(merged.snapshotId).toBe("snap_recovered");
    });

    it("should allow AVAILABLE→HARD_ERROR (explicit backend error)", () => {
      const prevState: L0DashboardState = {
        status: "AVAILABLE",
        reasonCode: "PROOF_OK",
        snapshotId: "snap_was_ok",
        createdAtUtc: "2026-01-24T16:00:00.000Z",
        schemaVersion: "L0",
        error: null,
        note: "Was good",
      };

      const nextState: L0DashboardState = {
        status: "HARD_ERROR",
        reasonCode: "STATE_HARD_ERROR",
        snapshotId: null,
        createdAtUtc: null,
        schemaVersion: "L0",
        error: "BACKEND_STORAGE_CORRUPTED",
        note: "Backend error",
      };

      const merged = mergeDashboardState(prevState, nextState);

      // HARD_ERROR is allowed (explicit backend failure)
      expect(merged.status).toBe("HARD_ERROR");
    });
  });

  // =========================================================================
  // TEST F: RANDOMIZED SEQUENCE TEST (deterministic seed)
  // =========================================================================
  describe("TEST_F: Deterministic randomized sequence test", () => {
    /**
     * Simple seeded PRNG for deterministic randomness
     */
    class SeededRandom {
      private seed: number;
      constructor(seed: number) {
        this.seed = seed;
      }
      next(): number {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
      }
      choice<T>(arr: T[]): T {
        return arr[Math.floor(this.next() * arr.length)];
      }
    }

    it("should never downgrade AVAILABLE to NO_SNAPSHOT in 1000 random sequences", () => {
      const rng = new SeededRandom(42); // Fixed seed for reproducibility

      const states: Array<"INITIALIZING" | "NO_SNAPSHOT" | "AVAILABLE" | "INVALID" | "ERROR"> = [
        "INITIALIZING",
        "NO_SNAPSHOT",
        "AVAILABLE",
        "INVALID",
        "ERROR",
      ];

      let currentState: L0DashboardState | null = null;
      let sequenceCount = 0;
      let blockedCount = 0;

      // Generate 1000 random state transitions
      for (let i = 0; i < 1000; i++) {
        sequenceCount++;

        // Generate random next state
        const nextStateType = rng.choice(states);
        let nextState: L0DashboardState;

        switch (nextStateType) {
          case "AVAILABLE":
            nextState = {
              status: "AVAILABLE",
              reasonCode: "PROOF_OK",
              snapshotId: `snap_${i}`,
              createdAtUtc: new Date().toISOString(),
              schemaVersion: "L0",
              error: null,
              note: "Available",
            };
            break;
          case "NO_SNAPSHOT":
            nextState = {
              status: "NO_SNAPSHOT",
              reasonCode: "STATE_NO_SNAPSHOT",
              snapshotId: null,
              createdAtUtc: null,
              schemaVersion: "L0",
              error: "NO_SNAPSHOT_POINTER",
              note: "No snapshot",
            };
            break;
          case "INVALID":
            nextState = {
              status: "INVALID_SNAPSHOT",
              reasonCode: "STATE_INVALID_SNAPSHOT",
              snapshotId: null,
              createdAtUtc: null,
              schemaVersion: "L0",
              error: "SCHEMA_MISMATCH",
              note: "Invalid",
            };
            break;
          case "ERROR":
            nextState = {
              status: "HARD_ERROR",
              reasonCode: "STATE_HARD_ERROR",
              snapshotId: null,
              createdAtUtc: null,
              schemaVersion: "L0",
              error: "FT_ERROR",
              note: "Error",
            };
            break;
          default:
            nextState = {
              status: "NO_SNAPSHOT",
              reasonCode: "STATE_NO_SNAPSHOT",
              snapshotId: null,
              createdAtUtc: null,
              schemaVersion: "L0",
              error: "UNKNOWN",
              note: "Unknown",
            };
        }

        // Apply merge
        const prev = currentState;
        currentState = mergeDashboardState(prev, nextState);

        // CRITICAL INVARIANT CHECK:
        // If prev was AVAILABLE with snapshotId, and next was NO_SNAPSHOT,
        // current must STILL be AVAILABLE
        if (
          prev &&
          prev.status === "AVAILABLE" &&
          prev.snapshotId &&
          nextState.status === "NO_SNAPSHOT"
        ) {
          blockedCount++;
          // Verify invariant held
          expect(currentState.status).toBe("AVAILABLE");
          expect(currentState.snapshotId).toBe(prev.snapshotId);
        }
      }

      console.log(
        `Randomized test completed: ${sequenceCount} sequences, ${blockedCount} downgrade attempts blocked`
      );
      expect(blockedCount).toBeGreaterThan(0); // Sanity check: at least some blocks happened
    });
  });
});
