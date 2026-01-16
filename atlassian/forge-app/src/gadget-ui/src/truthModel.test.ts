/**
 * TESTS: Truth Model State Machine Invariants
 *
 * Ensures the GovernanceViewModel computes correctly and invariants are enforced.
 * These tests validate:
 * - Each runtime state is computed correctly
 * - Invariants hold (no FRESH without snapshot, etc.)
 * - Label/reason combinations are sensible
 */

import { describe, it, expect } from "vitest";
import {
  computeGovernanceViewModel,
  GovernanceRuntimeState,
  RuntimeSignals,
  type GovernanceViewModel,
} from "../truthModel";

const NOW_ISO = "2026-01-16T12:00:00Z";
const NOW = new Date(NOW_ISO);

const baseSignals: RuntimeSignals = {
  tenantIdentityStatus: "OK",
  backendStatus: "OK",
  scheduleStatus: "CONFIGURED",
  expectedScheduleIntervalMinutes: 5,
  lastSuccessfulRunISO: new Date(NOW.getTime() - 5 * 60 * 1000).toISOString(),
  lastAttemptISO: new Date(NOW.getTime() - 5 * 60 * 1000).toISOString(),
  snapshot: {
    id: "snap123",
    generatedAtISO: new Date(NOW.getTime() - 5 * 60 * 1000).toISOString(),
    sha256: "abc123",
  },
  storageStatus: "NONEMPTY",
  snapshotCountRetained: 5,
  checksCompletedLifetime: 100,
  failures7d: 0,
  skippedChecks7d: 0,
  exportSubsystemStatus: "READY",
  permissionsVisibility: "OK",
  stalenessThresholdMinutes: 30,
  nowISO: NOW_ISO,
};

describe("GovernanceViewModel State Machine", () => {
  describe("RUNNING state", () => {
    it("computes RUNNING when snapshot fresh and last run exists", () => {
      const vm = computeGovernanceViewModel(baseSignals);
      expect(vm.runtimeState).toBe(GovernanceRuntimeState.RUNNING);
      expect(vm.isOperational).toBe(true);
      expect(vm.overallHealthLabel).toBe("Operational");
    });

    it("RUNNING state cannot have FRESH freshness without snapshot", () => {
      const signals = { ...baseSignals, snapshot: null };
      const vm = computeGovernanceViewModel(signals);
      expect(vm.runtimeState).not.toBe(GovernanceRuntimeState.RUNNING);
      expect(vm.dataFreshnessLabel).not.toBe("Fresh");
    });
  });

  describe("STALE state", () => {
    it("computes STALE when snapshot age > threshold", () => {
      const staleTime = new Date(NOW.getTime() - 45 * 60 * 1000); // 45 min ago, > 30 min threshold
      const signals = {
        ...baseSignals,
        snapshot: {
          id: "snap123",
          generatedAtISO: staleTime.toISOString(),
          sha256: "abc123",
        },
      };
      const vm = computeGovernanceViewModel(signals);
      expect(vm.runtimeState).toBe(GovernanceRuntimeState.STALE);
      expect(vm.dataFreshnessLabel).toBe("Stale");
    });
  });

  describe("WAITING_FIRST_RUN state", () => {
    it("computes WAITING_FIRST_RUN when schedule configured but no run and no snapshot", () => {
      const signals = {
        ...baseSignals,
        lastSuccessfulRunISO: null,
        lastAttemptISO: null,
        snapshot: null,
      };
      const vm = computeGovernanceViewModel(signals);
      expect(vm.runtimeState).toBe(GovernanceRuntimeState.WAITING_FIRST_RUN);
      expect(vm.schedulerStatusLabel).toBe("Configured, awaiting first run");
      expect(vm.dataFreshnessLabel).toBe("Never");
    });

    it("WAITING_FIRST_RUN freshness must be Never (not Fresh)", () => {
      const signals = {
        ...baseSignals,
        lastSuccessfulRunISO: null,
        lastAttemptISO: null,
        snapshot: null,
      };
      const vm = computeGovernanceViewModel(signals);
      expect(vm.dataFreshnessLabel).not.toBe("Fresh");
      expect(vm.dataFreshnessLabel).toBe("Never");
    });
  });

  describe("BOOTING state", () => {
    it("computes BOOTING when tenant unknown", () => {
      const signals = { ...baseSignals, tenantIdentityStatus: "UNKNOWN" };
      const vm = computeGovernanceViewModel(signals);
      expect(vm.runtimeState).toBe(GovernanceRuntimeState.BOOTING);
      expect(vm.hasTenantIdentity).toBe(false);
      expect(vm.overallHealthLabel).toBe("Initializing");
    });

    it("computes BOOTING when backend unreachable", () => {
      const signals = { ...baseSignals, backendStatus: "UNREACHABLE" };
      const vm = computeGovernanceViewModel(signals);
      expect(vm.runtimeState).toBe(GovernanceRuntimeState.BOOTING);
      expect(vm.hasBackendReachability).toBe(false);
    });
  });

  describe("DEGRADED state", () => {
    it("computes DEGRADED when failures exist", () => {
      const signals = { ...baseSignals, failures7d: 3 };
      const vm = computeGovernanceViewModel(signals);
      expect(vm.runtimeState).toBe(GovernanceRuntimeState.DEGRADED);
      expect(vm.healthReason).toContain("3 failures");
    });

    it("computes DEGRADED when permissions limited", () => {
      const signals = { ...baseSignals, permissionsVisibility: "LIMITED" };
      const vm = computeGovernanceViewModel(signals);
      expect(vm.runtimeState).toBe(GovernanceRuntimeState.DEGRADED);
      expect(vm.healthReason).toContain("Limited visibility");
    });
  });

  describe("BROKEN state", () => {
    it("computes BROKEN when backend error", () => {
      const signals = { ...baseSignals, backendStatus: "ERROR" };
      const vm = computeGovernanceViewModel(signals);
      expect(vm.runtimeState).toBe(GovernanceRuntimeState.BROKEN);
      expect(vm.isOperational).toBe(false);
    });

    it("computes BROKEN when export subsystem error", () => {
      const signals = { ...baseSignals, exportSubsystemStatus: "ERROR" };
      const vm = computeGovernanceViewModel(signals);
      expect(vm.runtimeState).toBe(GovernanceRuntimeState.BROKEN);
    });
  });

  describe("Invariants", () => {
    it("snapshot age is null when snapshot is null", () => {
      const signals = { ...baseSignals, snapshot: null };
      const vm = computeGovernanceViewModel(signals);
      expect(vm.snapshotAgeMinutes).toBeNull();
    });

    it("FRESH freshness requires snapshot", () => {
      const signals = { ...baseSignals, snapshot: null };
      const vm = computeGovernanceViewModel(signals);
      expect(vm.dataFreshnessLabel).not.toBe("Fresh");
    });

    it("empty storage means zero snapshots retained", () => {
      const signals = {
        ...baseSignals,
        storageStatus: "EMPTY",
        snapshotCountRetained: 0,
      };
      const vm = computeGovernanceViewModel(signals);
      expect(vm.snapshotCountRetained).toBe(0);
      expect(vm.storageStateLabel).toBe("Empty");
    });

    it("schedule not configured means no expected interval", () => {
      const signals = { ...baseSignals, scheduleStatus: "NOT_CONFIGURED" };
      const vm = computeGovernanceViewModel(signals);
      expect(vm.expectedScheduleIntervalMinutes).toBeNull();
    });

    it("WAITING_FIRST_RUN cannot show Fresh data", () => {
      const signals = {
        ...baseSignals,
        lastSuccessfulRunISO: null,
        snapshot: null,
      };
      const vm = computeGovernanceViewModel(signals);
      if (vm.runtimeState === GovernanceRuntimeState.WAITING_FIRST_RUN) {
        expect(vm.dataFreshnessLabel).not.toBe("Fresh");
      }
    });
  });

  describe("Export mode computation", () => {
    it("SNAPSHOT_BASED when snapshot exists and export ready", () => {
      const vm = computeGovernanceViewModel(baseSignals);
      expect(vm.exportMode).toBe("SNAPSHOT_BASED");
      expect(vm.exportReadinessLabel).toBe("Ready (snapshot-based)");
      expect(vm.exportAvailable).toBe(true);
    });

    it("MANUAL_UI_STATE when snapshot exists but export not ready", () => {
      const signals = { ...baseSignals, exportSubsystemStatus: "NOT_READY" };
      const vm = computeGovernanceViewModel(signals);
      expect(vm.exportMode).toBe("MANUAL_UI_STATE");
      expect(vm.exportReadinessLabel).toBe("Ready (manual, UI state only)");
    });

    it("DISABLED when export subsystem error", () => {
      const signals = { ...baseSignals, exportSubsystemStatus: "ERROR" };
      const vm = computeGovernanceViewModel(signals);
      expect(vm.exportMode).toBe("DISABLED");
      expect(vm.exportAvailable).toBe(false);
    });

    it("downloads available matches export availability", () => {
      const vm = computeGovernanceViewModel(baseSignals);
      expect(vm.downloadsAvailable).toBe(vm.exportAvailable);
    });
  });

  describe("Label and reason consistency", () => {
    it("all labels and reasons are non-empty strings", () => {
      const vm = computeGovernanceViewModel(baseSignals);
      expect(vm.overallHealthLabel).toBeTruthy();
      expect(vm.healthReason).toBeTruthy();
      expect(vm.dataFreshnessLabel).toBeTruthy();
      expect(vm.freshnessReason).toBeTruthy();
      expect(vm.schedulerStatusLabel).toBeTruthy();
      expect(vm.schedulerReason).toBeTruthy();
      expect(vm.lastSnapshotLabel).toBeTruthy();
      expect(vm.snapshotReason).toBeTruthy();
      expect(vm.exportReadinessLabel).toBeTruthy();
      expect(vm.exportReason).toBeTruthy();
      expect(vm.storageStateLabel).toBeTruthy();
      expect(vm.storageReason).toBeTruthy();
      expect(vm.permissionVisibilityLabel).toBeTruthy();
      expect(vm.permissionReason).toBeTruthy();
    });

    it("reason matches label state", () => {
      const vm = computeGovernanceViewModel(baseSignals);
      if (vm.overallHealthLabel === "Operational") {
        expect(vm.healthReason).toContain("functioning");
      }
      if (vm.dataFreshnessLabel === "Fresh") {
        expect(vm.freshnessReason).toContain("old");
      }
    });
  });

  describe("Snapshot age calculation", () => {
    it("calculates correct age in minutes", () => {
      const agedTime = new Date(NOW.getTime() - 10 * 60 * 1000); // 10 min ago
      const signals = {
        ...baseSignals,
        snapshot: {
          id: "snap123",
          generatedAtISO: agedTime.toISOString(),
          sha256: "abc123",
        },
      };
      const vm = computeGovernanceViewModel(signals);
      expect(vm.snapshotAgeMinutes).toBe(10);
      expect(vm.lastSnapshotLabel).toBe("10min ago");
    });

    it("null age when snapshot is null", () => {
      const signals = { ...baseSignals, snapshot: null };
      const vm = computeGovernanceViewModel(signals);
      expect(vm.snapshotAgeMinutes).toBeNull();
      expect(vm.lastSnapshotLabel).toBe("Never");
    });
  });
});
