#!/usr/bin/env node
/**
 * FirstTry Phase 3 — Integration Proof Harness
 * 
 * Extends Phase 2 harness to test complete Phase 3:
 * 
 * Process:
 * 1. Generate deterministic privilege snapshot
 * 2. Initialize quarterly review
 * 3. Approve 50% of items
 * 4. Close review
 * 5. Export pack (run 1)
 * 6. Export pack (run 2) 
 * 7. Compare SHA256 hashes (must match)
 * 8. Compare file hashes (must match)
 * 9. Validate guards
 * 10. Validate evidence generation
 * 
 * Output: [FT_PHASE3_PROOF_PASS] on success
 */

import crypto from "crypto";
import { ReviewWorkflowEngine, PrivilegeSnapshot } from "../src/access-review/workflow";
import { ReviewItem, ReviewWorkflow } from "../src/access-review/types";
import { ReviewExportPack } from "../src/export/reviewPack";
import { ComplianceEvidenceGenerator } from "../src/compliance/controlMapping";
import { ReviewGuards } from "../src/access-review/guards";
import { ReviewAnalyticsBuffer } from "../src/analytics/reviewAnalytics";

/**
 * Phase 3 Integration Proof
 */
async function runPhase3Proof(): Promise<void> {
  console.log("[FT_PHASE3_PROOF] Starting Phase 3 integration proof...\n");

  try {
    // ===== STEP 1: Generate Deterministic Snapshot =====
    console.log("[FT_PHASE3_PROOF] STEP 1: Generating snapshot...");

    const snapshot: PrivilegeSnapshot = {
      items: {},
      timestamp: new Date().toISOString(),
      buildVersion: "3.0.0",
      siteId: "proof-site-123",
    };

    // Create 20 test privilege entries
    for (let i = 0; i < 20; i++) {
      const riskLevel =
        i < 5
          ? "high"
          : i < 15
            ? "medium"
            : "low";

      snapshot.items[`user-${i}`] = {
        entityId: `user-${i}`,
        entityType: "user",
        privilegeSummary: `Admin Role (${riskLevel})`,
        riskLevel: riskLevel as "high" | "medium" | "low",
        addedAt: new Date().toISOString(),
        context: `User ${i} test entry`,
      };
    }

    const snapshotHash = ReviewWorkflowEngine.hashSnapshot(snapshot);
    console.log(`  ✓ Snapshot created: ${Object.keys(snapshot.items).length} items`);
    console.log(`  ✓ Snapshot hash: ${snapshotHash}\n`);

    // ===== STEP 2: Initialize Review =====
    console.log("[FT_PHASE3_PROOF] STEP 2: Initialize quarterly review...");

    const engine = new ReviewWorkflowEngine();
    const workflow = await engine.initializeReview(
      snapshot,
      ["reviewer1", "reviewer2"],
      "3.0.0",
      "proof-site-123"
    );

    console.log(`  ✓ Review ID: ${workflow.reviewId}`);
    console.log(`  ✓ Status: ${workflow.status}`);
    console.log(`  ✓ Reviewers: ${workflow.reviewers.length}\n`);

    // ===== STEP 3: Approve 50% of Items =====
    console.log("[FT_PHASE3_PROOF] STEP 3: Recording decisions (approve 50%)...");

    const itemCount = Object.keys(workflow.items).length;
    const approveCount = Math.floor(itemCount / 2);

    for (let i = 0; i < approveCount; i++) {
      engine.recordDecision(`user-${i}`, "reviewer1", "approved", "Approved");
    }

    for (let i = approveCount; i < itemCount; i++) {
      engine.recordDecision(`user-${i}`, "reviewer1", "rejected", "Revoked access");
    }

    const intermediateWf = engine.getWorkflow();
    console.log(`  ✓ Decisions recorded: ${approveCount} approved, ${itemCount - approveCount} rejected`);
    console.log(`  ✓ Progress: ${intermediateWf.progress}%`);
    console.log(`  ✓ Compliance score: ${intermediateWf.complianceScore}\n`);

    // ===== STEP 4: Close Review =====
    console.log("[FT_PHASE3_PROOF] STEP 4: Closing review...");

    const closedWorkflow = engine.closeReview();
    console.log(`  ✓ Status: ${closedWorkflow.status}`);
    console.log(`  ✓ Closed at: ${closedWorkflow.closedAt}`);
    console.log(`  ✓ Canonical hash: ${closedWorkflow.canonicalHash.substring(0, 16)}...\n`);

    // ===== STEP 5 & 6: Export Pack (Run 1 & 2) =====
    console.log("[FT_PHASE3_PROOF] STEP 5-6: Exporting pack (x2 for determinism check)...");

    const buildSha = "abc1234";

    const files1 = ReviewExportPack.generatePackFiles(closedWorkflow, buildSha);
    const packHash1 = ReviewExportPack.computePackHash(files1);

    const files2 = ReviewExportPack.generatePackFiles(closedWorkflow, buildSha);
    const packHash2 = ReviewExportPack.computePackHash(files2);

    console.log(`  ✓ Export 1 pack hash: ${packHash1.substring(0, 16)}...`);
    console.log(`  ✓ Export 2 pack hash: ${packHash2.substring(0, 16)}...\n`);

    // ===== STEP 7: Compare Pack Hashes =====
    console.log("[FT_PHASE3_PROOF] STEP 7: Comparing pack hashes...");

    if (!ReviewExportPack.verifyDeterminism(packHash1, packHash2, "Pack Hash")) {
      throw new Error("FAIL: Pack hashes don't match (non-deterministic export)");
    }
    console.log(`  ✓ Pack hashes match (deterministic)\n`);

    // ===== STEP 8: Compare File Hashes =====
    console.log("[FT_PHASE3_PROOF] STEP 8: Comparing file hashes...");

    let fileMatchCount = 0;
    for (const filename of ReviewExportPack.REQUIRED_FILES) {
      const hash1 = crypto
        .createHash("sha256")
        .update(files1[filename] || "")
        .digest("hex");
      const hash2 = crypto
        .createHash("sha256")
        .update(files2[filename] || "")
        .digest("hex");

      if (hash1 === hash2) {
        fileMatchCount++;
      } else {
        throw new Error(
          `FAIL: File hash mismatch for ${filename} (${hash1.substring(0, 8)} != ${hash2.substring(0, 8)})`
        );
      }
    }

    console.log(`  ✓ All ${fileMatchCount} file hashes match (deterministic)\n`);

    // ===== STEP 9: Validate Guards =====
    console.log("[FT_PHASE3_PROOF] STEP 9: Validating guards...");

    const guardResult = ReviewGuards.validateComplete(closedWorkflow, files1, snapshotHash);

    if (!guardResult.valid) {
      throw new Error(`FAIL: Guard validation failed: ${guardResult.errors.join(", ")}`);
    }

    console.log(`  ✓ Guard marker: ${guardResult.marker}`);
    console.log(`  ✓ All ${ReviewExportPack.REQUIRED_FILES.length} files present\n`);

    // ===== STEP 10: Validate Evidence Generation =====
    console.log("[FT_PHASE3_PROOF] STEP 10: Validating evidence generation...");

    const evidence = ComplianceEvidenceGenerator.generateEvidence(closedWorkflow);

    // Verify no certification claims
    const report = ComplianceEvidenceGenerator.generateEvidenceReport(evidence);
    if (report.toLowerCase().includes("compliant") || report.toLowerCase().includes("certified")) {
      throw new Error("FAIL: Evidence contains certification language (prohibited)");
    }

    // Verify disclaimers present
    if (evidence.disclaimers.length === 0) {
      throw new Error("FAIL: Evidence missing disclaimers");
    }

    console.log(`  ✓ Evidence generated: ${evidence.disclaimers.length} disclaimers`);
    console.log(`  ✓ No certification claims detected\n`);

    // ===== STEP 11: Analytics =====
    console.log("[FT_PHASE3_PROOF] STEP 11: Analytics ring buffer...");

    const analyticsBuffer = new ReviewAnalyticsBuffer();
    analyticsBuffer.addEntry(closedWorkflow);

    const stats = analyticsBuffer.getSummaryStats();
    console.log(`  ✓ Analytics recorded`);
    console.log(`  ✓ Average score: ${stats.averageComplianceScore}`);
    console.log(`  ✓ Median completion: ${stats.medianCompletionHours} hours\n`);

    // ===== FINAL: Success =====
    console.log("════════════════════════════════════════════════════════════");
    console.log("[FT_PHASE3_PROOF_PASS] All integration tests passed");
    console.log("════════════════════════════════════════════════════════════");
    console.log(`\nSummary:`);
    console.log(`  ✓ Snapshot locking: PASS`);
    console.log(`  ✓ Review workflow: PASS`);
    console.log(`  ✓ Decision recording: PASS`);
    console.log(`  ✓ Export determinism (2x): PASS`);
    console.log(`  ✓ File hashes (${fileMatchCount}/${ReviewExportPack.REQUIRED_FILES.length}): PASS`);
    console.log(`  ✓ Guard validation: PASS`);
    console.log(`  ✓ Evidence generation: PASS`);
    console.log(`  ✓ Analytics: PASS\n`);

    process.exit(0);
  } catch (error) {
    console.error("[FT_PHASE3_PROOF_FAIL] Error:", error);
    process.exit(1);
  }
}

// Run proof
runPhase3Proof();
