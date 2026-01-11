import { describe, it, expect } from "vitest";
import {
  computeOverallBadge,
  validateNoContradictions,
  getReasonCodeLabel,
  getStatusIcon,
  getAriaLabel,
  ReasonCode,
  StatusLabel,
  SubsystemStatus,
  UnifiedGovernanceStatus,
  SubsystemKey,
} from "../../src/core/unified_status_model";

describe("unified_status_model", () => {
  // =========================================================================
  // TESTS: computeOverallBadge
  // =========================================================================

  describe("computeOverallBadge", () => {
    it("should return RED if any subsystem is red", () => {
      const subsystems: SubsystemStatus[] = [
        {
          key: SubsystemKey.scheduler,
          badge: { color: "green", label: StatusLabel.HEALTHY },
          reasonCode: ReasonCode.OK,
          message: "Healthy",
          impact: "None",
          recommendedAction: "None",
        },
        {
          key: SubsystemKey.storage,
          badge: { color: "red", label: StatusLabel.FAILING },
          reasonCode: ReasonCode.STORAGE_ERROR,
          message: "Storage error",
          impact: "Critical",
          recommendedAction: "Check database",
        },
        {
          key: SubsystemKey.permissions,
          badge: { color: "green", label: StatusLabel.HEALTHY },
          reasonCode: ReasonCode.OK,
          message: "Healthy",
          impact: "None",
          recommendedAction: "None",
        },
      ];

      const badge = computeOverallBadge(subsystems);
      expect(badge.color).toBe("red");
      expect(badge.label).toBe(StatusLabel.FAILING);
    });

    it("should return YELLOW if any subsystem is yellow (and no red)", () => {
      const subsystems: SubsystemStatus[] = [
        {
          key: SubsystemKey.scheduler,
          badge: { color: "green", label: StatusLabel.HEALTHY },
          reasonCode: ReasonCode.OK,
          message: "Healthy",
          impact: "None",
          recommendedAction: "None",
        },
        {
          key: SubsystemKey.export,
          badge: { color: "yellow", label: StatusLabel.DEGRADED },
          reasonCode: ReasonCode.EXPORT_PENDING,
          message: "Export pending",
          impact: "Minor",
          recommendedAction: "Check queue",
        },
      ];

      const badge = computeOverallBadge(subsystems);
      expect(badge.color).toBe("yellow");
      expect(badge.label).toBe(StatusLabel.DEGRADED);
    });

    it("should return GREEN if all subsystems are green", () => {
      const subsystems: SubsystemStatus[] = [
        {
          key: SubsystemKey.scheduler,
          badge: { color: "green", label: StatusLabel.HEALTHY },
          reasonCode: ReasonCode.OK,
          message: "Healthy",
          impact: "None",
          recommendedAction: "None",
        },
        {
          key: SubsystemKey.permissions,
          badge: { color: "green", label: StatusLabel.HEALTHY },
          reasonCode: ReasonCode.OK,
          message: "Healthy",
          impact: "None",
          recommendedAction: "None",
        },
      ];

      const badge = computeOverallBadge(subsystems);
      expect(badge.color).toBe("green");
      expect(badge.label).toBe(StatusLabel.HEALTHY);
    });

    it("should return GRAY if all subsystems are gray (empty or initializing)", () => {
      const subsystems: SubsystemStatus[] = [
        {
          key: SubsystemKey.overall,
          badge: { color: "gray", label: StatusLabel.INITIALIZING },
          reasonCode: ReasonCode.INITIALIZING_NO_DATA,
          message: "Initializing",
          impact: "None",
          recommendedAction: "Wait",
        },
      ];

      const badge = computeOverallBadge(subsystems);
      expect(badge.color).toBe("gray");
      expect(badge.label).toBe(StatusLabel.INITIALIZING);
    });

    it("should handle empty subsystems array (return gray)", () => {
      const badge = computeOverallBadge([]);
      expect(badge.color).toBe("gray");
      expect(badge.label).toBe(StatusLabel.INITIALIZING);
    });

    it("should prioritize RED over YELLOW over GREEN", () => {
      // All three colors present
      const subsystems: SubsystemStatus[] = [
        {
          key: SubsystemKey.scheduler,
          badge: { color: "green", label: StatusLabel.HEALTHY },
          reasonCode: ReasonCode.OK,
          message: "Healthy",
          impact: "None",
          recommendedAction: "None",
        },
        {
          key: SubsystemKey.export,
          badge: { color: "yellow", label: StatusLabel.DEGRADED },
          reasonCode: ReasonCode.EXPORT_PENDING,
          message: "Export pending",
          impact: "Minor",
          recommendedAction: "Check",
        },
        {
          key: SubsystemKey.storage,
          badge: { color: "red", label: StatusLabel.FAILING },
          reasonCode: ReasonCode.STORAGE_ERROR,
          message: "Storage error",
          impact: "Critical",
          recommendedAction: "Check database",
        },
      ];

      const badge = computeOverallBadge(subsystems);
      expect(badge.color).toBe("red");
    });
  });

  // =========================================================================
  // TESTS: validateNoContradictions
  // =========================================================================

  describe("validateNoContradictions", () => {
    function createValidStatus(): UnifiedGovernanceStatus {
      return {
        schemaVersion: "unified_status_v1",
        generatedAt: new Date().toISOString(),
        overall: {
          key: SubsystemKey.overall,
          badge: { color: "green", label: StatusLabel.HEALTHY },
          reasonCode: ReasonCode.OK,
          message: "All systems healthy",
          impact: "None",
          recommendedAction: "None",
          lastSuccessAt: new Date().toISOString(),
        },
        subsystems: [],
        kpis: [],
        phases: [],
        export: {
          badge: { color: "green", label: StatusLabel.HEALTHY },
          reasonCode: ReasonCode.EXPORT_READY,
          message: "Export ready",
          isReady: true,
          manualCopyAlwaysAvailable: true,
        },
      };
    }

    it("should pass validation for a healthy status", () => {
      const status = createValidStatus();
      expect(() => validateNoContradictions(status)).not.toThrow();
    });

    it("should reject contradiction: lastSuccessAt set + message says 'not available'", () => {
      const status = createValidStatus();
      status.overall.message = "Data not available yet";
      status.overall.lastSuccessAt = new Date().toISOString();

      expect(() => validateNoContradictions(status)).toThrow(/CONTRADICTION.*lastSuccessAt/i);
    });

    it("should reject contradiction: isReady=true but reasonCode is not EXPORT_READY or OK", () => {
      const status = createValidStatus();
      status.export.isReady = true;
      status.export.reasonCode = ReasonCode.EXPORT_PENDING;

      expect(() => validateNoContradictions(status)).toThrow(/CONTRADICTION.*export.isReady/i);
    });

    it("should reject contradiction: isReady=false + manualCopyAlwaysAvailable=false", () => {
      const status = createValidStatus();
      status.export.isReady = false;
      status.export.manualCopyAlwaysAvailable = false;

      expect(() => validateNoContradictions(status)).toThrow(/manual copy must always work/i);
    });

    it("should reject contradiction: overall green but reasonCode is not OK", () => {
      const status = createValidStatus();
      status.overall.badge.color = "green";
      status.overall.reasonCode = ReasonCode.SCHEDULER_DELAYED;

      expect(() => validateNoContradictions(status)).toThrow(/overall.*green.*reasonCode/i);
    });

    it("should reject contradiction: overall red but reasonCode is OK", () => {
      const status = createValidStatus();
      status.overall.badge.color = "red";
      status.overall.reasonCode = ReasonCode.OK;

      expect(() => validateNoContradictions(status)).toThrow(/overall.*red.*reasonCode/i);
    });

    it("should allow isReady=false if manualCopyAlwaysAvailable=true", () => {
      const status = createValidStatus();
      status.export.isReady = false;
      status.export.manualCopyAlwaysAvailable = true;
      status.export.reasonCode = ReasonCode.EXPORT_PENDING;

      expect(() => validateNoContradictions(status)).not.toThrow();
    });

    it("should allow message='Pending data' without lastSuccessAt", () => {
      const status = createValidStatus();
      status.overall.message = "Pending data";
      delete status.overall.lastSuccessAt;

      expect(() => validateNoContradictions(status)).not.toThrow();
    });
  });

  // =========================================================================
  // TESTS: Helper Functions
  // =========================================================================

  describe("getReasonCodeLabel", () => {
    it("should map ReasonCode.OK to 'System operational'", () => {
      expect(getReasonCodeLabel(ReasonCode.OK)).toBe("System operational");
    });

    it("should map ReasonCode.STORAGE_ERROR to 'Storage error'", () => {
      expect(getReasonCodeLabel(ReasonCode.STORAGE_ERROR)).toBe("Storage error");
    });

    it("should handle all reason codes without error", () => {
      Object.values(ReasonCode).forEach((code) => {
        const label = getReasonCodeLabel(code);
        expect(label).toBeTruthy();
        expect(typeof label).toBe("string");
      });
    });
  });

  describe("getStatusIcon", () => {
    it("should return ✓ for green", () => {
      expect(getStatusIcon("green")).toBe("✓");
    });

    it("should return ✗ for red", () => {
      expect(getStatusIcon("red")).toBe("✗");
    });

    it("should return ⚠ for yellow", () => {
      expect(getStatusIcon("yellow")).toBe("⚠");
    });

    it("should return ◉ for gray", () => {
      expect(getStatusIcon("gray")).toBe("◉");
    });
  });

  describe("getAriaLabel", () => {
    it("should generate accessible aria-label with all components", () => {
      const badge = { color: "green" as const, label: StatusLabel.HEALTHY };
      const message = "All systems operational";
      const reasonCode = ReasonCode.OK;

      const label = getAriaLabel(badge, message, reasonCode);

      expect(label).toContain("Healthy");
      expect(label).toContain("All systems operational");
      expect(label).toContain("System operational");
    });

    it("should handle degraded status", () => {
      const badge = { color: "yellow" as const, label: StatusLabel.DEGRADED };
      const message = "Export queue backed up";
      const reasonCode = ReasonCode.EXPORT_PENDING;

      const label = getAriaLabel(badge, message, reasonCode);

      expect(label).toContain("Degraded");
      expect(label).toContain("Export pending");
    });
  });

  // =========================================================================
  // TESTS: Schema Presence
  // =========================================================================

  describe("UnifiedGovernanceStatus schema", () => {
    it("should include schemaVersion field for versioning", () => {
      const status: UnifiedGovernanceStatus = {
        schemaVersion: "unified_status_v1",
        generatedAt: new Date().toISOString(),
        overall: {
          key: SubsystemKey.overall,
          badge: { color: "green", label: StatusLabel.HEALTHY },
          reasonCode: ReasonCode.OK,
          message: "Healthy",
          impact: "None",
          recommendedAction: "None",
        },
        subsystems: [],
        kpis: [],
        phases: [],
        export: {
          badge: { color: "green", label: StatusLabel.HEALTHY },
          reasonCode: ReasonCode.EXPORT_READY,
          message: "Ready",
          isReady: true,
          manualCopyAlwaysAvailable: true,
        },
      };

      expect(status.schemaVersion).toBe("unified_status_v1");
    });

    it("should include generatedAt timestamp in ISO 8601 format", () => {
      const now = new Date().toISOString();
      const status: UnifiedGovernanceStatus = {
        schemaVersion: "unified_status_v1",
        generatedAt: now,
        overall: {
          key: SubsystemKey.overall,
          badge: { color: "green", label: StatusLabel.HEALTHY },
          reasonCode: ReasonCode.OK,
          message: "Healthy",
          impact: "None",
          recommendedAction: "None",
        },
        subsystems: [],
        kpis: [],
        phases: [],
        export: {
          badge: { color: "green", label: StatusLabel.HEALTHY },
          reasonCode: ReasonCode.EXPORT_READY,
          message: "Ready",
          isReady: true,
          manualCopyAlwaysAvailable: true,
        },
      };

      expect(new Date(status.generatedAt)).toBeInstanceOf(Date);
      expect(status.generatedAt).toBe(now);
    });

    it("should allow optional timestamps in SubsystemStatus", () => {
      const subsystem: SubsystemStatus = {
        key: SubsystemKey.scheduler,
        badge: { color: "yellow", label: StatusLabel.DEGRADED },
        reasonCode: ReasonCode.SCHEDULER_DELAYED,
        message: "Scheduler delayed",
        impact: "Minor",
        recommendedAction: "Check task queue",
        lastAttemptAt: new Date().toISOString(),
        lastSuccessAt: new Date("2025-01-01").toISOString(),
        nextExpectedAt: new Date("2025-01-02").toISOString(),
      };

      expect(subsystem.lastAttemptAt).toBeTruthy();
      expect(subsystem.lastSuccessAt).toBeTruthy();
      expect(subsystem.nextExpectedAt).toBeTruthy();
    });
  });

  // =========================================================================
  // TESTS: Backward Compatibility
  // =========================================================================

  describe("Backward compatibility", () => {
    it("should allow unifiedStatus as optional top-level field alongside existing payload", () => {
      // Simulate legacy resolver response with new unifiedStatus field added
      const legacyResponse = {
        // existing fields (preserved)
        schemaVersion: "governance_resolver_v1",
        lastRefreshAt: new Date().toISOString(),
        failureCount7d: 5,
        degradedReasons: ["scheduler delayed"],

        // new unified status field (added without breaking existing consumers)
        unifiedStatus: {
          schemaVersion: "unified_status_v1" as const,
          generatedAt: new Date().toISOString(),
          overall: {
            key: SubsystemKey.overall,
            badge: { color: "yellow", label: StatusLabel.DEGRADED },
            reasonCode: ReasonCode.SCHEDULER_DELAYED,
            message: "Scheduler delayed",
            impact: "Minor",
            recommendedAction: "Check",
          },
          subsystems: [],
          kpis: [],
          phases: [],
          export: {
            badge: { color: "green", label: StatusLabel.HEALTHY },
            reasonCode: ReasonCode.EXPORT_READY,
            message: "Ready",
            isReady: true,
            manualCopyAlwaysAvailable: true,
          },
        },
      };

      // Old consumers ignore unifiedStatus, new ones use it
      expect(legacyResponse.failureCount7d).toBe(5);
      expect(legacyResponse.unifiedStatus).toBeTruthy();
    });
  });
});
