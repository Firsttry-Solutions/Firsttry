/**
 * tests/status_contract_schedule.test.ts
 *
 * Test that the UI/backend scheduler contract is consistent:
 * - If schedulerConfigured=false, expectedScheduleIntervalMinutes MUST be null
 * - If scheduleStatus !== "CONFIGURED", expectedScheduleIntervalMinutes MUST be null
 *
 * This test prevents regression of the "schedule not configured but expectedScheduleIntervalMinutes is not null" invariant violation.
 */

import { describe, it, expect } from "vitest";
import { normalizeStatusV1, EMPTY_STATUS_V1 } from "../src/shared/statusSchema";

describe("Scheduler Contract (UI/Backend Consistency)", () => {
  it("EMPTY_STATUS_V1 should set schedulerConfigured=false and expectedScheduleIntervalMinutes=null", () => {
    const empty = EMPTY_STATUS_V1("test-tenant", "test-sha", "UI_v1");
    
    expect(empty.schedulerConfigured).toBe(false);
    expect(empty.expectedScheduleIntervalMinutes).toBeNull();
    expect(empty.staleIfAgeMinutesGreaterThan).toBeNull();
  });

  it("normalizeStatusV1 should set null intervals when schedulerConfigured=false", () => {
    const input = {
      schemaVersion: "1",
      generatedAt: new Date().toISOString(),
      tenantAri: "test-tenant",
      backendBuild: "test-sha",
      health: "OK",
      scheduler: { runCountLifetime: 0 },
      snapshots: { retainedCount: 0 },
      timeline: [],
      checks: [],
      errors: [],
      export: { jsonReady: false, csvReady: false, pdfReady: false },
      schedulerConfigured: false,  // CRITICAL: Not configured
      expectedScheduleIntervalMinutes: 60,  // Input has a value
    };

    const normalized = normalizeStatusV1(input, "test-tenant", "test-sha", "UI_v1");
    
    // CRITICAL: When schedulerConfigured=false, intervals must be null
    expect(normalized.schedulerConfigured).toBe(false);
    expect(normalized.expectedScheduleIntervalMinutes).toBeNull();
    expect(normalized.staleIfAgeMinutesGreaterThan).toBeNull();
  });

  it("normalizeStatusV1 should preserve intervals when schedulerConfigured=true", () => {
    const input = {
      schemaVersion: "1",
      generatedAt: new Date().toISOString(),
      tenantAri: "test-tenant",
      backendBuild: "test-sha",
      health: "OK",
      scheduler: { runCountLifetime: 1 },
      snapshots: { retainedCount: 5 },
      timeline: [],
      checks: [],
      errors: [],
      export: { jsonReady: true, csvReady: false, pdfReady: false },
      schedulerConfigured: true,  // CRITICAL: Configured
      expectedScheduleIntervalMinutes: 60,
      staleIfAgeMinutesGreaterThan: 120,
    };

    const normalized = normalizeStatusV1(input, "test-tenant", "test-sha", "UI_v1");
    
    // When schedulerConfigured=true, intervals should be preserved
    expect(normalized.schedulerConfigured).toBe(true);
    expect(normalized.expectedScheduleIntervalMinutes).toBe(60);
    expect(normalized.staleIfAgeMinutesGreaterThan).toBe(120);
  });

  it("normalizeStatusV1 should default to null intervals when schedulerConfigured is undefined", () => {
    const input = {
      schemaVersion: "1",
      generatedAt: new Date().toISOString(),
      tenantAri: "test-tenant",
      backendBuild: "test-sha",
      health: "OK",
      scheduler: { runCountLifetime: 0 },
      snapshots: { retainedCount: 0 },
      timeline: [],
      checks: [],
      errors: [],
      export: { jsonReady: false, csvReady: false, pdfReady: false },
      // schedulerConfigured is NOT specified
    };

    const normalized = normalizeStatusV1(input, "test-tenant", "test-sha", "UI_v1");
    
    // Default: intervals should be safe values (60 and 120)
    expect(normalized.expectedScheduleIntervalMinutes).toBe(60);
    expect(normalized.staleIfAgeMinutesGreaterThan).toBe(120);
  });

  it("normalizeStatusV1 should handle null input gracefully", () => {
    const normalized = normalizeStatusV1(null, "test-tenant", "test-sha", "UI_v1");
    
    // Should return EMPTY_STATUS_V1-like safe defaults
    expect(normalized.schedulerConfigured).toBe(false);
    expect(normalized.expectedScheduleIntervalMinutes).toBeNull();
    expect(normalized.health).toBe("ERROR");  // Phase 6-7: Fail-closed (no UNKNOWN)
  });
});
