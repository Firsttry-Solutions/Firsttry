#!/usr/bin/env node

/**
 * PHASE 3 SOR v1.1 - Integration Proof Harness
 * End-to-end workflow test:
 * 1. Open review
 * 2. Add decision
 * 3. Add exception
 * 4. Export pack
 * 5. Export again
 * 6. Verify SHA256 identical
 * 7. Verify stateHash matches
 * Output: [FT_PHASE3_PROOF_PASS]
 */

import * as crypto from "crypto";
import { 
  generateReviewId, 
  canonicalizeJson, 
  computeStateHash,
  generateExportPack,
  hashFilesPack
} from "../src/access-review/phase3Workflow";
import {
  generateDecisionsCsv,
  generateExceptionsCsv,
  verifyExportReproducibility,
  ExportPackFiles,
} from "../src/access-review/reviewPack";
import {
  ReviewWorkflowState,
  PrivilegeContext,
  ReviewReviewer,
  ReviewDecision,
  ReviewException,
} from "../src/access-review/types";

const testName = "PHASE3_SOR_V1.1_INTEGRATION_PROOF";

// ============================================================================
// TEST STATE BUILDER
// ============================================================================

function buildTestPrivilegeContext(): PrivilegeContext {
  return {
    accountId: "account-123",
    displayName: "Test Admin",
    isJiraSiteAdmin: true,
    isGlobalAdmin: false,
    isDenied: false,
  };
}

function buildTestReviewState(): ReviewWorkflowState {
  const nowUtc = "2025-01-10T12:00:00Z";

  return {
    reviewId: generateReviewId("test-site", "2025-Q1"),
    siteId: "test-site",
    quarter: "2025-Q1",
    schemaVersion: "ar.v1",
    ruleSetVersion: "phase3.v1",
    createdUtc: nowUtc,
    lastUpdatedUtc: nowUtc,
    status: "OPEN",
    privilegeContext: buildTestPrivilegeContext(),
    snapshotRef: {
      snapshotId: "snap-001",
      snapshotsUtc: nowUtc,
      itemCount: 2,
      baselineSha: "baseline-hash",
    },
    reviewers: [
      {
        accountId: "reviewer-1",
        displayName: "Reviewer One",
        role: "PRIMARY",
        assignedUtc: nowUtc,
      },
      {
        accountId: "reviewer-2",
        displayName: "Reviewer Two",
        role: "SECONDARY",
        assignedUtc: nowUtc,
      },
    ],
    decisions: [],
    exceptions: [],
    progress: { totalItems: 2, reviewedItems: 0, percent: 0 },
    complianceScore: {
      value: 80,
      basis: "partial_review",
      computedUtc: nowUtc,
    },
    stateHash: "",
    failure: undefined,
  };
}

// ============================================================================
// STEP 1: OPEN REVIEW
// ============================================================================

function step1_OpenReview(): ReviewWorkflowState {
  console.log("[FT_PHASE3_PROOF] Step 1: Open Review");

  const state = buildTestReviewState();

  // Compute state hash
  const stateWithoutHash = { ...state };
  delete (stateWithoutHash as any).stateHash;
  state.stateHash = computeStateHash(stateWithoutHash);

  console.log(`  reviewId: ${state.reviewId.substring(0, 12)}...`);
  console.log(`  quarter: ${state.quarter}`);
  console.log(`  stateHash: ${state.stateHash.substring(0, 12)}...`);
  console.log(`[FT_REVIEW_OPEN_COMPLETE]`);

  return state;
}

// ============================================================================
// STEP 2: ADD DECISION
// ============================================================================

function step2_AddDecision(state: ReviewWorkflowState): ReviewWorkflowState {
  console.log("[FT_PHASE3_PROOF] Step 2: Record Decision");

  const nowUtc = new Date().toISOString();
  const decision: ReviewDecision = {
    reviewerId: "reviewer-1",
    decision: "APPROVED",
    recordedUtc: nowUtc,
    justification: "Looks good",
    decisionHash: crypto
      .createHash("sha256")
      .update("reviewer-1:APPROVED:Looks good")
      .digest("hex"),
  };

  state.decisions.push(decision);
  state.lastUpdatedUtc = nowUtc;
  state.progress.reviewedItems = 1;
  state.progress.percent = Math.floor((1 / 2) * 100);

  // Recompute state hash
  const stateWithoutHash = { ...state };
  delete (stateWithoutHash as any).stateHash;
  state.stateHash = computeStateHash(stateWithoutHash);

  console.log(`  decision: ${decision.decision}`);
  console.log(`  newStateHash: ${state.stateHash.substring(0, 12)}...`);
  console.log(`[FT_REVIEW_DECISION_RECORDED]`);

  return state;
}

// ============================================================================
// STEP 3: ADD EXCEPTION
// ============================================================================

function step3_AddException(state: ReviewWorkflowState): ReviewWorkflowState {
  console.log("[FT_PHASE3_PROOF] Step 3: Add Exception");

  const nowUtc = new Date().toISOString();
  const expiresUtc = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  const exception: ReviewException = {
    exceptionId: "exc-001",
    itemId: "item-123",
    risk: "HIGH",
    expiresUtc: expiresUtc,
    createdUtc: nowUtc,
    justification: "Temporary high-risk access approved for incident response",
    justificationHash: crypto
      .createHash("sha256")
      .update("Temporary high-risk access approved for incident response")
      .digest("hex"),
  };

  state.exceptions.push(exception);
  state.lastUpdatedUtc = nowUtc;

  // Recompute state hash
  const stateWithoutHash = { ...state };
  delete (stateWithoutHash as any).stateHash;
  state.stateHash = computeStateHash(stateWithoutHash);

  console.log(`  exceptionId: ${exception.exceptionId}`);
  console.log(`  risk: ${exception.risk}`);
  console.log(`  expiresUtc: ${exception.expiresUtc}`);
  console.log(`  newStateHash: ${state.stateHash.substring(0, 12)}...`);
  console.log(`[FT_REVIEW_EXCEPTION_ADDED]`);

  return state;
}

// ============================================================================
// STEP 4: EXPORT PACK (FIRST)
// ============================================================================

function step4_ExportPack(state: ReviewWorkflowState): {
  state: ReviewWorkflowState;
  pack: ExportPackFiles;
  packHash: string;
} {
  console.log("[FT_PHASE3_PROOF] Step 4: Export Pack (First)");

  const buildShaShort = "abc12345";
  const buildUtc = new Date().toISOString();

  const pack = generateExportPack(state, buildShaShort, buildUtc);
  const packHash = hashFilesPack(pack);

  console.log(`  files: ${Object.keys(pack).length}`);
  console.log(`  packHash: ${packHash.substring(0, 12)}...`);
  console.log(`[FT_REVIEW_EXPORT_COMPLETE]`);

  return { state, pack, packHash };
}

// ============================================================================
// STEP 5: EXPORT PACK AGAIN (VERIFY REPRODUCIBILITY)
// ============================================================================

function step5_ExportAgain(
  state: ReviewWorkflowState,
  pack1: ExportPackFiles,
  packHash1: string
): {
  pack2: ExportPackFiles;
  packHash2: string;
  reproducible: boolean;
} {
  console.log("[FT_PHASE3_PROOF] Step 5: Export Again & Verify Reproducibility");

  const buildShaShort = "abc12345";
  const buildUtc = new Date().toISOString();

  const pack2 = generateExportPack(state, buildShaShort, buildUtc);
  const packHash2 = hashFilesPack(pack2);

  // Compare all files
  const fileMatches: Record<string, boolean> = {};
  let allMatch = true;

  for (const filename of Object.keys(pack1)) {
    const match = pack1[filename as keyof ExportPackFiles] === pack2[filename as keyof ExportPackFiles];
    fileMatches[filename] = match;
    if (!match) allMatch = false;
  }

  console.log(`  packHash1: ${packHash1.substring(0, 12)}...`);
  console.log(`  packHash2: ${packHash2.substring(0, 12)}...`);
  console.log(`  packHashesMatch: ${packHash1 === packHash2}`);

  for (const [filename, match] of Object.entries(fileMatches)) {
    console.log(`  ${filename}: ${match ? "✓" : "✗"}`);
  }

  if (allMatch && packHash1 === packHash2) {
    console.log(`[FT_REVIEW_EXPORT_REPRODUCIBLE] All files match`);
  } else {
    console.error(`[FT_REVIEW_EXPORT_NOT_REPRODUCIBLE] Files differ!`);
  }

  return {
    pack2,
    packHash2,
    reproducible: allMatch && packHash1 === packHash2,
  };
}

// ============================================================================
// STEP 6: VERIFY STATE HASH INTEGRITY
// ============================================================================

function step6_VerifyStateHashIntegrity(state: ReviewWorkflowState): boolean {
  console.log("[FT_PHASE3_PROOF] Step 6: Verify State Hash Integrity");

  const storedHash = state.stateHash;

  // Recompute hash
  const stateWithoutHash = { ...state };
  delete (stateWithoutHash as any).stateHash;
  const recomputedHash = computeStateHash(stateWithoutHash);

  console.log(`  storedHash: ${storedHash.substring(0, 12)}...`);
  console.log(`  recomputedHash: ${recomputedHash.substring(0, 12)}...`);
  console.log(`  match: ${storedHash === recomputedHash}`);

  if (storedHash === recomputedHash) {
    console.log(`[FT_REVIEW_STATE_VERIFIED] State hash integrity confirmed`);
    return true;
  } else {
    console.error(`[FT_REVIEW_STATE_CORRUPTED] State hash mismatch!`);
    return false;
  }
}

// ============================================================================
// MAIN PROOF FLOW
// ============================================================================

async function runProof(): Promise<void> {
  console.log("\n" + "=".repeat(80));
  console.log(
    `[${testName}] INTEGRATION PROOF HARNESS`
  );
  console.log("=".repeat(80));

  try {
    // Step 1: Open Review
    let state = step1_OpenReview();
    console.log("");

    // Step 2: Add Decision
    state = step2_AddDecision(state);
    console.log("");

    // Step 3: Add Exception
    state = step3_AddException(state);
    console.log("");

    // Step 4: Export Pack (first time)
    const { pack: pack1, packHash: packHash1 } = step4_ExportPack(state);
    console.log("");

    // Step 5: Export Pak again & verify reproducibility
    const { reproducible } = step5_ExportAgain(state, pack1, packHash1);
    console.log("");

    // Step 6: Verify state hash
    const stateValid = step6_VerifyStateHashIntegrity(state);
    console.log("");

    // FINAL RESULT
    console.log("=".repeat(80));
    if (reproducible && stateValid) {
      console.log("[FT_PHASE3_PROOF_PASS] INTEGRATION PROOF SUCCESSFUL");
      console.log("  ✓ Open review");
      console.log("  ✓ Record decision");
      console.log("  ✓ Add exception");
      console.log("  ✓ Export deterministic pack");
      console.log("  ✓ Export reproducible (byte-identical)");
      console.log("  ✓ State hash verified");
      console.log("=".repeat(80) + "\n");
      process.exit(0);
    } else {
      console.error("[FT_PHASE3_PROOF_FAIL] PROOF FAILED");
      if (!reproducible) console.error("  ✗ Export not reproducible");
      if (!stateValid) console.error("  ✗ State hash mismatch");
      console.error("=".repeat(80) + "\n");
      process.exit(1);
    }
  } catch (err) {
    console.error(`[FT_PHASE3_PROOF_FAIL] Error: ${err}`);
    console.error("=".repeat(80) + "\n");
    process.exit(1);
  }
}

// ============================================================================
// EXECUTION
// ============================================================================

runProof().catch((err) => {
  console.error(`[FT_PHASE3_PROOF_FATAL] Uncaught error: ${err}`);
  process.exit(1);
});
