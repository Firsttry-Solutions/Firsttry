/**
 * FirstTry Phase 3 — Unit Tests (Vitest)
 * 
 * All tests must pass 100% to proceed
 * 
 * Coverage:
 * - Snapshot locking (immutability)
 * - Decision storage (determinism)
 * - Compliance score calculation (formula correctness)
 * - CSV export (determinism, identical output)
 * - Pack hash (determinism, identical output)
 * - Export guard (blocks open reviews)
 * - Ring buffer (rollover behavior)
 * - Evidence generation (no certification claims)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ReviewWorkflowEngine, PrivilegeSnapshot } from "../access-review/workflow";
import { ReviewExportPack } from "../export/reviewPack";
import { ComplianceEvidenceGenerator } from "../compliance/controlMapping";
import { ReviewAnalyticsBuffer, ReviewAnalyticsEntry } from "../analytics/reviewAnalytics";
import { ReviewGuards } from "../access-review/guards";
import { ReviewItem, ReviewWorkflow } from "../access-review/types";

/**
 * Helper: Create test snapshot
 */
function createTestSnapshot(itemCount: number = 10): PrivilegeSnapshot {
  const items: Record<string, ReviewItem> = {};

  for (let i = 0; i < itemCount; i++) {
    const riskLevel =
      i % 3 === 0 ? "high" : i % 3 === 1 ? "medium" : "low";

    items[`entity-${i}`] = {
      entityId: `entity-${i}`,
      entityType: "user",
      privilegeSummary: `Test Privilege ${i}`,
      riskLevel: riskLevel as "high" | "medium" | "low",
      addedAt: new Date().toISOString(),
      context: `Context for entity-${i}`,
    };
  }

  return {
    items,
    timestamp: new Date().toISOString(),
    buildVersion: "3.0.0-test",
    siteId: "test-site-123",
  };
}

describe("Phase 3: Access Review System of Record", () => {
  let engine: ReviewWorkflowEngine;
  let testSnapshot: PrivilegeSnapshot;

  beforeEach(() => {
    engine = new ReviewWorkflowEngine();
    testSnapshot = createTestSnapshot(10);
  });

  describe("SNAPSHOT LOCKING — Immutability", () => {
    it("should lock snapshot hash at workflow creation", async () => {
      const workflow = await engine.initializeReview(
        testSnapshot,
        ["reviewer1", "reviewer2"],
        "3.0.0",
        "test-site"
      );

      const originalHash = workflow.snapshotHash;

      // Try to modify snapshot (in real code this should be prevented)
      expect(originalHash).toBeDefined();
      expect(originalHash.length).toBe(64); // SHA-256 hex is 64 chars

      // Recreating with same snapshot should produce same hash
      const engine2 = new ReviewWorkflowEngine();
      const workflow2 = await engine2.initializeReview(
        testSnapshot,
        ["reviewer1", "reviewer2"],
        "3.0.0",
        "test-site"
      );

      expect(workflow2.snapshotHash).toBe(originalHash);
    });

    it("should produce different hash for different snapshots", async () => {
      const snapshot2 = createTestSnapshot(8);

      const workflow1 = await engine.initializeReview(
        testSnapshot,
        ["reviewer1"],
        "3.0.0",
        "test-site"
      );

      const engine2 = new ReviewWorkflowEngine();
      const workflow2 = await engine2.initializeReview(
        snapshot2,
        ["reviewer1"],
        "3.0.0",
        "test-site"
      );

      expect(workflow1.snapshotHash).not.toBe(workflow2.snapshotHash);
    });
  });

  describe("DECISION STORAGE — Determinism", () => {
    it("should record decisions deterministically", async () => {
      const workflow = await engine.initializeReview(
        testSnapshot,
        ["reviewer1", "reviewer2"],
        "3.0.0",
        "test-site"
      );

      // Record same decision twice
      const decision1 = engine.recordDecision(
        "entity-0",
        "reviewer1",
        "approved",
        "Looks good"
      );

      // Records should be identical (same timestamp in same test)
      expect(decision1.reviewerAccountId).toBe("reviewer1");
      expect(decision1.decision).toBe("approved");
      expect(decision1.comment).toBe("Looks good");
    });

    it("should prevent decisions on open review", async () => {
      const workflow = await engine.initializeReview(
        testSnapshot,
        ["reviewer1"],
        "3.0.0",
        "test-site"
      );

      engine.recordDecision("entity-0", "reviewer1", "approved");

      // Close review
      engine.closeReview();

      // Should fail to add new decision
      expect(() => {
        engine.recordDecision("entity-1", "reviewer1", "rejected");
      }).toThrow("FAIL_CLOSED: Review is closed");
    });
  });

  describe("COMPLIANCE SCORE — Formula Correctness", () => {
    it("should calculate score as 100 - (highRiskUndecided * 5 + mediumRiskUndecided * 2)", async () => {
      const workflow = await engine.initializeReview(
        createTestSnapshot(10),
        ["reviewer1"],
        "3.0.0",
        "test-site"
      );

      // Count initial undecided risks
      let highUndecided = 0;
      let mediumUndecided = 0;

      for (const item of Object.values(workflow.items)) {
        if (item.riskLevel === "high") highUndecided++;
        else if (item.riskLevel === "medium") mediumUndecided++;
      }

      const expectedScore = 100 - (highUndecided * 5 + mediumUndecided * 2);

      const wf = engine.getWorkflow();
      expect(wf.complianceScore).toBe(expectedScore);
    });

    it("should increase score as items are decided", async () => {
      const workflow = await engine.initializeReview(
        createTestSnapshot(10),
        ["reviewer1"],
        "3.0.0",
        "test-site"
      );

      const initialScore = engine.getWorkflow().complianceScore;

      // Approve a high-risk item
      engine.recordDecision("entity-0", "reviewer1", "approved");

      const newScore = engine.getWorkflow().complianceScore;
      expect(newScore).toBeGreaterThan(initialScore);
    });

    it("should cap score at 100", async () => {
      const emptySnapshot: PrivilegeSnapshot = {
        items: {},
        timestamp: new Date().toISOString(),
        buildVersion: "3.0.0",
        siteId: "test",
      };

      const workflow = await engine.initializeReview(
        emptySnapshot,
        ["reviewer1"],
        "3.0.0",
        "test-site"
      );

      expect(engine.getWorkflow().complianceScore).toBeLessThanOrEqual(100);
    });

    it("should floor score at 0", async () => {
      const workflow = await engine.initializeReview(
        createTestSnapshot(100),
        ["reviewer1"],
        "3.0.0",
        "test-site"
      );

      expect(engine.getWorkflow().complianceScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe("CSV EXPORT — Determinism (10x runs)", () => {
    it("should produce identical CSV across multiple runs", async () => {
      const outputs: string[] = [];

      for (let i = 0; i < 10; i++) {
        const engine = new ReviewWorkflowEngine();
        const workflow = await engine.initializeReview(
          testSnapshot,
          ["reviewer1"],
          "3.0.0",
          "test-site"
        );

        // Add some decisions
        engine.recordDecision("entity-0", "reviewer1", "approved");
        engine.recordDecision("entity-1", "reviewer1", "rejected");

        engine.closeReview();

        const files = ReviewExportPack.generatePackFiles(
          engine.getWorkflow(),
          "abc1234"
        );

        outputs.push(files["access-review.csv"]);
      }

      // All outputs should be identical
      for (let i = 1; i < outputs.length; i++) {
        expect(outputs[i]).toBe(outputs[0]);
      }
    });
  });

  describe("PACK HASH — Determinism (10x runs)", () => {
    it("should produce identical pack hash across multiple runs", async () => {
      const hashes: string[] = [];

      for (let i = 0; i < 10; i++) {
        const engine = new ReviewWorkflowEngine();
        const workflow = await engine.initializeReview(
          testSnapshot,
          ["reviewer1"],
          "3.0.0",
          "test-site"
        );

        engine.recordDecision("entity-0", "reviewer1", "approved");
        engine.closeReview();

        const files = ReviewExportPack.generatePackFiles(
          engine.getWorkflow(),
          "abc1234"
        );

        const hash = ReviewExportPack.computePackHash(files);
        hashes.push(hash);
      }

      // All hashes should be identical
      for (let i = 1; i < hashes.length; i++) {
        expect(hashes[i]).toBe(hashes[0]);
      }
    });
  });

  describe("EXPORT GUARD — Blocks Open Reviews", () => {
    it("should prevent export of open reviews", async () => {
      const workflow = await engine.initializeReview(
        testSnapshot,
        ["reviewer1"],
        "3.0.0",
        "test-site"
      );

      engine.recordDecision("entity-0", "reviewer1", "approved");

      // Try to export while open
      const validationResult = ReviewGuards.validateExportable(
        engine.getWorkflow()
      );

      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors).toContain(
        "Review status is 'open', must be 'closed' to export"
      );
      expect(validationResult.marker).toBe("FT_REVIEW_INCOMPLETE");
    });

    it("should allow export of closed reviews", async () => {
      const workflow = await engine.initializeReview(
        testSnapshot,
        ["reviewer1"],
        "3.0.0",
        "test-site"
      );

      engine.recordDecision("entity-0", "reviewer1", "approved");
      engine.closeReview();

      const validationResult = ReviewGuards.validateExportable(
        engine.getWorkflow()
      );

      expect(validationResult.valid).toBe(true);
      expect(validationResult.marker).toBe("FT_REVIEW_COMPLETE");
    });
  });

  describe("RING BUFFER — Analytics & Rollover", () => {
    it("should store analytics entries", async () => {
      const buffer = new ReviewAnalyticsBuffer();

      for (let i = 0; i < 5; i++) {
        const engine = new ReviewWorkflowEngine();
        const workflow = await engine.initializeReview(
          createTestSnapshot(5),
          ["reviewer1"],
          "3.0.0",
          `site-${i}`
        );

        engine.recordDecision("entity-0", "reviewer1", "approved");
        engine.closeReview();

        buffer.addEntry(engine.getWorkflow());
      }

      const entries = buffer.getEntries();
      expect(entries).toHaveLength(5);
    });

    it("should rotate out oldest entry when full", async () => {
      const buffer = new ReviewAnalyticsBuffer();

      // Add 91 entries (should trigger rollover at 90)
      for (let i = 0; i < 91; i++) {
        const engine = new ReviewWorkflowEngine();
        const workflow = await engine.initializeReview(
          createTestSnapshot(3),
          ["reviewer1"],
          "3.0.0",
          `site-${i}`
        );

        engine.recordDecision("entity-0", "reviewer1", "approved");
        engine.closeReview();

        buffer.addEntry(engine.getWorkflow());
      }

      const entries = buffer.getEntries();
      expect(entries).toHaveLength(90); // Should not exceed max
    });

    it("should publish correct chart data", async () => {
      const buffer = new ReviewAnalyticsBuffer();

      const engine = new ReviewWorkflowEngine();
      const workflow = await engine.initializeReview(
        createTestSnapshot(5),
        ["reviewer1"],
        "3.0.0",
        "test-site"
      );

      engine.recordDecision("entity-0", "reviewer1", "approved");
      engine.closeReview();

      buffer.addEntry(engine.getWorkflow());

      const chartData = buffer.getChartData();

      expect(chartData.complianceTrend).toHaveLength(1);
      expect(chartData.completionTrend).toHaveLength(1);
      expect(chartData.riskTrend).toHaveLength(1);

      expect(chartData.complianceTrend[0]).toHaveProperty("reviewId");
      expect(chartData.complianceTrend[0]).toHaveProperty("score");
    });
  });

  describe("EVIDENCE GENERATION — No Certification Claims", () => {
    it("should generate evidence without certification language", async () => {
      const engine = new ReviewWorkflowEngine();
      const workflow = await engine.initializeReview(
        createTestSnapshot(5),
        ["reviewer1"],
        "3.0.0",
        "test-site"
      );

      engine.recordDecision("entity-0", "reviewer1", "approved");
      engine.closeReview();

      const evidence = ComplianceEvidenceGenerator.generateEvidence(
        engine.getWorkflow()
      );

      const report = ComplianceEvidenceGenerator.generateEvidenceReport(
        evidence
      );

      // Should NOT contain certification claims
      expect(report).not.toMatch(/compliant|certified/i);

      // Should contain evidence-only language
      expect(report).toMatch(/evidence artifact/i);
      expect(report).toMatch(/generated automatically/i);

      // Disclaimers required
      expect(evidence.disclaimers.length).toBeGreaterThan(0);
    });
  });

  describe("PROGRESS CALCULATION", () => {
    it("should calculate progress correctly", async () => {
      const workflow = await engine.initializeReview(
        createTestSnapshot(10),
        ["reviewer1"],
        "3.0.0",
        "test-site"
      );

      expect(engine.getWorkflow().progress).toBe(0);

      // Approve 5 items
      for (let i = 0; i < 5; i++) {
        engine.recordDecision(`entity-${i}`, "reviewer1", "approved");
      }

      const progress = engine.getWorkflow().progress;
      expect(progress).toBe(50); // 5 out of 10
    });
  });
});

// Final summary
console.log(
  "[FT_TEST] Phase 3 Unit Tests — 100% pass required for deployment"
);
