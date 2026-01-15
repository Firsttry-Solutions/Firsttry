import { describe, test, expect } from "vitest";
import { normalizeStatusV1, EMPTY_STATUS_V1 } from "../src/shared/statusSchema";
import { buildExportPayloadFromStatus } from "../src/gadget-ui/src/exportPayload";
import { toSummaryTextFromPayload } from "../src/gadget-ui/src/summaryText";

/**
 * Dashboard Pre-Deploy No-Throw Tests
 *
 * These tests verify that all critical dashboard functions:
 * 1. Never throw, even with malformed input
 * 2. Preserve truth: unknown values are null, not 0/false
 * 3. Mark unknown fields explicitly via unknownMetrics/unknownBoundaries arrays
 * 4. Support both old and new schema formats (backward compat)
 *
 * These tests are essential for pre-deployment validation and prevent regressions.
 */

describe("Dashboard Pre-Deploy: No-Throw + Truth Contract", () => {
  describe("normalizeStatusV1 safety", () => {
    test("should normalize empty/null input without throwing", () => {
      expect(() => normalizeStatusV1(null, "test", "1.0", "1.0")).not.toThrow();
      expect(() => normalizeStatusV1(undefined, "test", "1.0", "1.0")).not.toThrow();
      expect(() => normalizeStatusV1({}, "test", "1.0", "1.0")).not.toThrow();
    });

    test("should handle malformed nested objects without throwing", () => {
      const malformed: any = {
        tenantIdentity: null,
        checks: "not-array",
        boundaries: { noJiraWrites: "nope" },
        operationalMetrics: { checksCompletedLifetime: "not-number" },
      };
      expect(() => normalizeStatusV1(malformed, "test", "1.0", "1.0")).not.toThrow();
    });

    test("should return EMPTY_STATUS_V1 on invalid input", () => {
      const result = normalizeStatusV1("invalid", "test", "1.0", "1.0");
      expect(result.operationalMetrics?.checksCompletedLifetime).toBe(null);
      expect(result.boundaries?.noJiraWrites).toBe(null);
    });

    test("should preserve real 0 values (not treat as unknown)", () => {
      const input: any = {
        operationalMetrics: {
          checksCompletedLifetime: 0,
          snapshotsRetainedCount: 0,
          daysContinuousOperation: 0,
        },
        boundaries: {
          noJiraWrites: false,
          noConfigChanges: false,
          noEnforcement: false,
        },
      };
      const result = normalizeStatusV1(input, "test", "1.0", "1.0");
      expect(result.operationalMetrics?.checksCompletedLifetime).toBe(0);
      expect(result.operationalMetrics?.snapshotsRetainedCount).toBe(0);
      expect(result.boundaries?.noJiraWrites).toBe(false);
      expect(result.boundaries?.noConfigChanges).toBe(false);
    });

    test("should convert undefined to null (unknown marker)", () => {
      const input: any = {
        operationalMetrics: {
          checksCompletedLifetime: undefined,
          snapshotsRetainedCount: undefined,
        },
      };
      const result = normalizeStatusV1(input, "test", "1.0", "1.0");
      expect(result.operationalMetrics?.checksCompletedLifetime).toBe(null);
      expect(result.operationalMetrics?.snapshotsRetainedCount).toBe(null);
    });
  });

  describe("EMPTY_STATUS_V1 defaults", () => {
    test("should have null for all operationalMetrics (not 0/false)", () => {
      const empty = EMPTY_STATUS_V1("tenant-id", "1.0.0", "1.0.0");
      expect(empty.operationalMetrics?.checksCompletedLifetime).toBe(null);
      expect(empty.operationalMetrics?.snapshotsRetainedCount).toBe(null);
      expect(empty.operationalMetrics?.daysContinuousOperation).toBe(null);
      expect(empty.operationalMetrics?.failureCount7d).toBe(null);
      expect(empty.operationalMetrics?.skippedChecksCount7d).toBe(null);
    });

    test("should have null for all boundaries (not false)", () => {
      const empty = EMPTY_STATUS_V1("tenant-id", "1.0.0", "1.0.0");
      expect(empty.boundaries?.noJiraWrites).toBe(null);
      expect(empty.boundaries?.noConfigChanges).toBe(null);
      expect(empty.boundaries?.noEnforcement).toBe(null);
      expect(empty.boundaries?.noRecommendations).toBe(null);
      expect(empty.boundaries?.observationalOnly).toBe(null);
    });
  });

  describe("buildExportPayloadFromStatus safety", () => {
    test("should export empty status without throwing", () => {
      const empty = EMPTY_STATUS_V1("tenant-id", "1.0.0", "1.0.0");
      expect(() => buildExportPayloadFromStatus(empty)).not.toThrow();
    });

    test("should mark all unknown fields when status is empty", () => {
      const empty = EMPTY_STATUS_V1("tenant-id", "1.0.0", "1.0.0");
      const payload = buildExportPayloadFromStatus(empty);

      expect(payload.unknownMetrics).toContain("checksCompletedLifetime");
      expect(payload.unknownMetrics).toContain("snapshotsRetainedCount");
      expect(payload.unknownMetrics).toContain("daysContinuousOperation");
      expect(payload.unknownBoundaries).toContain("noJiraWrites");
      expect(payload.unknownBoundaries).toContain("noConfigChanges");
      expect(payload.unknownBoundaries).toContain("noEnforcement");
    });

    test("should preserve real values and NOT mark them as unknown", () => {
      const input: any = {
        operationalMetrics: {
          checksCompletedLifetime: 42,
          snapshotsRetainedCount: 15,
          daysContinuousOperation: 90,
          failureCount7d: 2,
          skippedChecksCount7d: 0,
        },
        boundaries: {
          noJiraWrites: false,
          noConfigChanges: false,
          noEnforcement: true,
          noRecommendations: false,
          observationalOnly: false,
        },
      };
      const status = normalizeStatusV1(input, "test", "1.0", "1.0");
      const payload = buildExportPayloadFromStatus(status);

      // Values must be preserved exactly (not converted to unknown)
      expect(payload.operationalMetrics?.checksCompletedLifetime).toBe(42);
      expect(payload.operationalMetrics?.snapshotsRetainedCount).toBe(15);
      expect(payload.operationalMetrics?.daysContinuousOperation).toBe(90);
      expect(payload.operationalMetrics?.skippedChecksCount7d).toBe(0); // 0 is valid
      expect(payload.boundaries?.noJiraWrites).toBe(false); // false is valid
      expect(payload.boundaries?.noEnforcement).toBe(true);

      // Unknown arrays must be empty (all fields known)
      expect(payload.unknownMetrics.length).toBe(0);
      expect(payload.unknownBoundaries.length).toBe(0);
    });

    test("should handle mixed known/unknown fields", () => {
      const input: any = {
        operationalMetrics: {
          checksCompletedLifetime: 42,
          snapshotsRetainedCount: null, // unknown
          daysContinuousOperation: 90,
          failureCount7d: null,
          skippedChecksCount7d: 0,
        },
        boundaries: {
          noJiraWrites: false,
          noConfigChanges: null,
          noEnforcement: true,
        },
      };
      const status = normalizeStatusV1(input, "test", "1.0", "1.0");
      const payload = buildExportPayloadFromStatus(status);

      // Known values preserved
      expect(payload.operationalMetrics?.checksCompletedLifetime).toBe(42);
      expect(payload.operationalMetrics?.daysContinuousOperation).toBe(90);
      expect(payload.boundaries?.noJiraWrites).toBe(false);
      expect(payload.boundaries?.noEnforcement).toBe(true);

      // Unknown values remain null AND explicitly marked
      expect(payload.operationalMetrics?.snapshotsRetainedCount).toBe(null);
      expect(payload.unknownMetrics).toContain("snapshotsRetainedCount");
      expect(payload.unknownMetrics).toContain("failureCount7d");
      expect(payload.boundaries?.noConfigChanges).toBe(null);
      expect(payload.unknownBoundaries).toContain("noConfigChanges");
    });

    test("should never use 0/false as silent unknown marker (CRITICAL)", () => {
      // This is the key regression test: the bug was that unknown values
      // were coerced to 0/false, making them indistinguishable from real data.
      const input: any = {
        operationalMetrics: {
          checksCompletedLifetime: undefined, // unknown
          snapshotsRetainedCount: 0,          // known (explicitly 0)
          daysContinuousOperation: undefined, // unknown
        },
        boundaries: {
          noJiraWrites: undefined,            // unknown
          noConfigChanges: false,             // known (explicitly false)
          noEnforcement: undefined,           // unknown
        },
      };
      const status = normalizeStatusV1(input, "test", "1.0", "1.0");
      const payload = buildExportPayloadFromStatus(status);

      // Unknown must be null, not 0 or false
      expect(payload.operationalMetrics?.checksCompletedLifetime).toBe(null);
      expect(payload.operationalMetrics?.daysContinuousOperation).toBe(null);
      expect(payload.boundaries?.noJiraWrites).toBe(null);
      expect(payload.boundaries?.noEnforcement).toBe(null);

      // Real 0/false must be preserved
      expect(payload.operationalMetrics?.snapshotsRetainedCount).toBe(0);
      expect(payload.boundaries?.noConfigChanges).toBe(false);

      // Unknown arrays must mark unknowns, not real 0/false
      expect(payload.unknownMetrics).toContain("checksCompletedLifetime");
      expect(payload.unknownMetrics).toContain("daysContinuousOperation");
      expect(payload.unknownMetrics).not.toContain("snapshotsRetainedCount");
      expect(payload.unknownBoundaries).toContain("noJiraWrites");
      expect(payload.unknownBoundaries).toContain("noEnforcement");
      expect(payload.unknownBoundaries).not.toContain("noConfigChanges");
    });
  });

  describe("toSummaryTextFromPayload safety", () => {
    test("should generate summary without throwing", () => {
      const empty = EMPTY_STATUS_V1("tenant-id", "1.0.0", "1.0.0");
      const payload = buildExportPayloadFromStatus(empty);
      expect(() => toSummaryTextFromPayload(payload)).not.toThrow();
    });

    test("should include unknown markers in summary text", () => {
      const empty = EMPTY_STATUS_V1("tenant-id", "1.0.0", "1.0.0");
      const payload = buildExportPayloadFromStatus(empty);
      const summary = toSummaryTextFromPayload(payload);

      expect(summary.toLowerCase()).toContain("unknown");
      expect(summary).toContain("checksCompletedLifetime");
      expect(summary).toContain("noJiraWrites");
    });

    test("should note when all metrics are known", () => {
      const input: any = {
        operationalMetrics: {
          checksCompletedLifetime: 42,
          snapshotsRetainedCount: 15,
          daysContinuousOperation: 90,
          failureCount7d: 2,
          skippedChecksCount7d: 0,
        },
        boundaries: {
          noJiraWrites: false,
          noConfigChanges: false,
          noEnforcement: false,
          noRecommendations: false,
          observationalOnly: false,
        },
      };
      const status = normalizeStatusV1(input, "test", "1.0", "1.0");
      const payload = buildExportPayloadFromStatus(status);
      const summary = toSummaryTextFromPayload(payload);

      expect(summary).toContain("All");
      expect(summary).toContain("known");
    });
  });

  describe("End-to-end feature rendering", () => {
    test("full pipeline: raw input → normalize → export → summary without throwing", () => {
      const rawInput: any = {
        tenantIdentity: { available: true },
        checks: [{ id: "1", name: "check1", status: "PASS" }],
        operationalMetrics: { checksCompletedLifetime: 42 },
        boundaries: { noJiraWrites: false },
      };

      expect(() => {
        const status = normalizeStatusV1(rawInput, "test", "1.0", "1.0");
        const payload = buildExportPayloadFromStatus(status);
        const summary = toSummaryTextFromPayload(payload);
      }).not.toThrow();
    });

    test("full pipeline with empty/malformed input", () => {
      const malformed: any = { foo: "bar", nested: { x: null } };

      expect(() => {
        const status = normalizeStatusV1(malformed, "test", "1.0", "1.0");
        const payload = buildExportPayloadFromStatus(status);
        const summary = toSummaryTextFromPayload(payload);
      }).not.toThrow();
    });
  });

  describe("Backward compatibility (legacy fields)", () => {
    test("should normalize old format with top-level operationalMetrics fields", () => {
      const oldFormat: any = {
        checksCompletedLifetime: 42,
        snapshotsRetainedCount: 15,
        daysContinuousOperation: 90,
      };
      const status = normalizeStatusV1(oldFormat, "test", "1.0", "1.0");

      // Should preserve values from legacy fields
      expect(status.operationalMetrics?.checksCompletedLifetime).toBe(42);
      expect(status.operationalMetrics?.snapshotsRetainedCount).toBe(15);
      expect(status.operationalMetrics?.daysContinuousOperation).toBe(90);
    });

    test("should prefer new format over legacy when both present", () => {
      const mixed: any = {
        // legacy
        checksCompletedLifetime: 10,
        // new format (should take precedence)
        operationalMetrics: {
          checksCompletedLifetime: 42,
        },
      };
      const status = normalizeStatusV1(mixed, "test", "1.0", "1.0");
      expect(status.operationalMetrics?.checksCompletedLifetime).toBe(42); // new wins
    });
  });
});
