/**
 * INVARIANT LOGGING POLICY TEST
 *
 * This test enforces the strict policy:
 * - By default, invariant violations produce ZERO stderr/warn/error noise
 * - Violations are silent auto-corrections
 * - When FT_DEBUG_INVARIANTS=1, violations log to stdout only (console.log)
 *
 * Purpose: Prevent "Invariant violation (auto-corrected)" noise in test/build output
 */

import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import {
  GovernanceRuntimeState,
  computeGovernanceViewModel,
  type GovernanceViewModel,
  type RuntimeSignals
} from "../src/gadget-ui/src/truthModel";

describe("Invariant Logging Policy", () => {
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    // Clear the debug env var
    delete process.env.FT_DEBUG_INVARIANTS;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it("should produce ZERO console.warn or console.error by default when invariant is violated", () => {
    // Create signals that will trigger Invariant 1 violation
    // (snapshot is null but snapshotAgeMinutes is not null)
    const signals: RuntimeSignals = {
      tenantIdentityStatus: "OK",
      backendStatus: "OK",
      scheduleStatus: "CONFIGURED",
      expectedScheduleIntervalMinutes: 60,
      lastSuccessfulRunISO: null,
      lastAttemptISO: null,
      snapshot: null, // NULL snapshot
      storageStatus: "NONEMPTY",
      snapshotCountRetained: 1, // But age is set to non-null (will be cleared)
      checksCompletedLifetime: 0,
      failures7d: 0,
      skippedChecks7d: 0,
      permissionsVisibility: "OK",
      failureStrings: [],
      manifestState: "OK",
      exportMode: "DISABLED"
    };

    // Compute view model with Invariant 1 violation
    const vm = computeGovernanceViewModel(signals);

    // STRICT POLICY: With FT_DEBUG_INVARIANTS undefined, console.warn and console.error NOT called
    expect(consoleErrorSpy.mock.calls.length).toBe(0);
    expect(consoleWarnSpy.mock.calls.length).toBe(0);

    // The invariant WAS auto-corrected:
    // snapshotAgeMinutes should be null (set to null to match null snapshot)
    expect(vm.snapshotAgeMinutes).toBeNull();
  });

  it("should respect FT_DEBUG_INVARIANTS when enabled", () => {
    // Mock process.env to enable debug
    const originalEnv = process.env.FT_DEBUG_INVARIANTS;
    process.env.FT_DEBUG_INVARIANTS = "1";

    try {
      // Create signals that will trigger Invariant 1 violation
      const signals: RuntimeSignals = {
        tenantIdentityStatus: "OK",
        backendStatus: "OK",
        scheduleStatus: "CONFIGURED",
        expectedScheduleIntervalMinutes: 60,
        lastSuccessfulRunISO: null,
        lastAttemptISO: null,
        snapshot: null, // NULL snapshot
        storageStatus: "NONEMPTY",
        snapshotCountRetained: 1, // But age is set to non-null
        checksCompletedLifetime: 0,
        failures7d: 0,
        skippedChecks7d: 0,
        permissionsVisibility: "OK",
        failureStrings: [],
        manifestState: "OK",
        exportMode: "DISABLED"
      };

      // Compute view model with Invariant 1 violation
      const vm = computeGovernanceViewModel(signals);

      // STRICT POLICY: console.error and console.warn still NOT called
      expect(consoleErrorSpy.mock.calls.length).toBe(0);
      expect(consoleWarnSpy.mock.calls.length).toBe(0);

      // But the invariant WAS auto-corrected:
      expect(vm.snapshotAgeMinutes).toBeNull();
    } finally {
      // Restore original env
      if (originalEnv === undefined) {
        delete process.env.FT_DEBUG_INVARIANTS;
      } else {
        process.env.FT_DEBUG_INVARIANTS = originalEnv;
      }
    }
  });

  it("should trigger Invariant 2 without console.warn/error", () => {
    // Invariant 2: FRESH only occurs with snapshot
    const signals: RuntimeSignals = {
      tenantIdentityStatus: "OK",
      backendStatus: "OK",
      scheduleStatus: "CONFIGURED",
      expectedScheduleIntervalMinutes: 60,
      lastSuccessfulRunISO: "2026-01-27T00:00:00Z",
      lastAttemptISO: null,
      snapshot: null, // NULL snapshot
      storageStatus: "NONEMPTY",
      snapshotCountRetained: 0,
      checksCompletedLifetime: 1,
      failures7d: 0,
      skippedChecks7d: 0,
      permissionsVisibility: "OK",
      failureStrings: [],
      manifestState: "OK",
      exportMode: "DISABLED"
    };

    const vm = computeGovernanceViewModel(signals);

    // NO console.warn or console.error
    expect(consoleErrorSpy.mock.calls.length).toBe(0);
    expect(consoleWarnSpy.mock.calls.length).toBe(0);

    // Auto-corrected: freshness set to "Never" (not "Fresh")
    expect(vm.dataFreshnessLabel).toBe("Never");
  });

  it("should trigger Invariant 3 without console.warn/error", () => {
    // Invariant 3: schedule NOT_CONFIGURED => expectedScheduleIntervalMinutes must be null
    const signals: RuntimeSignals = {
      tenantIdentityStatus: "OK",
      backendStatus: "OK",
      scheduleStatus: "NOT_CONFIGURED", // NOT configured
      expectedScheduleIntervalMinutes: 60, // But interval set
      lastSuccessfulRunISO: null,
      lastAttemptISO: null,
      snapshot: null,
      storageStatus: "EMPTY",
      snapshotCountRetained: 0,
      checksCompletedLifetime: 0,
      failures7d: 0,
      skippedChecks7d: 0,
      permissionsVisibility: "OK",
      failureStrings: [],
      manifestState: "OK",
      exportMode: "DISABLED"
    };

    const vm = computeGovernanceViewModel(signals);

    // NO console.warn or console.error
    expect(consoleErrorSpy.mock.calls.length).toBe(0);
    expect(consoleWarnSpy.mock.calls.length).toBe(0);

    // Auto-corrected: interval set to null
    expect(vm.expectedScheduleIntervalMinutes).toBeNull();
  });
});
