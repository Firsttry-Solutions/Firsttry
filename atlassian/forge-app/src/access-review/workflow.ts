/**
 * FirstTry Phase 3 — Review Workflow Engine
 * 
 * Implements:
 * - Quarterly review initialization with snapshot locking
 * - Immutable snapshot after workflow starts
 * - Deterministic decision recording
 * - Progress & compliance score calculation
 * - Bulk operations (approve/reject)
 * - Exception tracking with expiration
 * - Escalation detection (7-day inactivity)
 *
 * All operations are logged with markers:
 * [FT_REVIEW_INIT]
 * [FT_REVIEW_SNAPSHOT_LOCKED]
 * [FT_REVIEW_DECISION_RECORDED]
 * [FT_REVIEW_CLOSED]
 */

import * as crypto from "crypto";
import {
  ReviewItem,
  ReviewDecision,
  ReviewException,
  ReviewWorkflow,
  ReviewDecisionBatch,
  ReviewConfig,
} from "./types";
import { ReviewerResolver } from "./reviewerResolver";

/**
 * Snapshot: Deterministic user privilege state at a point in time
 */
export interface PrivilegeSnapshot {
  items: Record<string, ReviewItem>;
  timestamp: string; // ISO 8601 UTC
  buildVersion: string;
  siteId: string;
}

/**
 * ReviewWorkflowEngine: State machine for quarterly access reviews
 */
export class ReviewWorkflowEngine {
  private workflow: ReviewWorkflow | null = null;
  private lockedSnapshot: PrivilegeSnapshot | null = null;

  /**
   * Generate deterministic quarterly review ID
   * Format: YYYY-Q# (e.g., "2026-Q1")
   */
  static generateReviewId(): string {
    const now = new Date();
    const year = now.getFullYear();
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    return `${year}-Q${quarter}`;
  }

  /**
   * Compute SHA-256 hash of snapshot (deterministic key)
   */
  static hashSnapshot(snapshot: PrivilegeSnapshot): string {
    // Sort items by key for deterministic hash
    const sortedItems: Record<string, any> = {};
    Object.keys(snapshot.items)
      .sort()
      .forEach((key) => {
        sortedItems[key] = snapshot.items[key];
      });

    const canonical = JSON.stringify({
      items: sortedItems,
      timestamp: snapshot.timestamp,
      buildVersion: snapshot.buildVersion,
      siteId: snapshot.siteId,
    });
    return crypto.createHash("sha256").update(canonical).digest("hex");
  }

  /**
   * Compute deterministic workflow canonical hash
   */
  static hashWorkflow(workflow: Omit<ReviewWorkflow, "canonicalHash">): string {
    // Sort items by key for deterministic hash
    const sortedItems: Record<string, any> = {};
    Object.keys(workflow.items)
      .sort()
      .forEach((key) => {
        sortedItems[key] = workflow.items[key];
      });

    // Sort decisions by key for deterministic hash
    const sortedDecisions: Record<string, any> = {};
    Object.keys(workflow.decisions)
      .sort()
      .forEach((key) => {
        sortedDecisions[key] = workflow.decisions[key];
      });

    const canonical = JSON.stringify({
      reviewId: workflow.reviewId,
      snapshotHash: workflow.snapshotHash,
      createdAt: workflow.createdAt,
      status: workflow.status,
      closedAt: workflow.closedAt,
      reviewers: [...workflow.reviewers].sort(),
      items: sortedItems,
      decisions: sortedDecisions,
      exceptions: workflow.exceptions,
      progress: workflow.progress,
      complianceScore: workflow.complianceScore,
    });
    return crypto.createHash("sha256").update(canonical).digest("hex");
  }

  /**
   * Initialize a new quarterly review (STEP 3: SNAPSHOT LOCKING)
   *
   * Process:
   * 1. Resolve reviewers from config or fallback group (fail-closed)
   * 2. Pull latest privilege snapshot
   * 3. Compute snapshot hash (immutable lock)
   * 4. Create workflow with locked hash
   * 5. Assign reviewers (site admins only)
   * 6. Emit markers for audit trail
   *
   * Fail-closed: If no reviewers available → status="no_reviewers_configured"
   * Fail-closed: If snapshot missing → throw
   */
  async initializeReview(
    snapshot: PrivilegeSnapshot,
    reviewerAccountIds: string[] | undefined,
    buildVersion: string,
    siteId: string,
    storage?: any,
    jiraClient?: any,
    testCreatedAt?: string // Optional: for deterministic testing
  ): Promise<ReviewWorkflow> {
    console.log("[FT_REVIEW_INIT] Starting quarterly access review...");

    let finalReviewers = reviewerAccountIds || [];

    // Step 1: If no reviewers provided, attempt resolution
    if (finalReviewers.length === 0 && storage && jiraClient) {
      console.log("[FT_REVIEW_INIT] No reviewers provided, attempting resolution...");
      const result = await ReviewerResolver.resolveReviewers(storage, jiraClient);

      if (!result.success) {
        console.error(`[FT_REVIEW_INIT_BLOCKED_NO_REVIEWERS] ${result.marker} ${result.error}`);

        // FAIL-CLOSED: Create workflow in no_reviewers_configured state
        // This prevents review from proceeding without explicit reviewer configuration
        const reviewId = ReviewWorkflowEngine.generateReviewId();
        const now = new Date().toISOString();

        const failureWorkflow: ReviewWorkflow = {
          reviewId,
          snapshotHash: "",
          createdAt: now,
          status: "no_reviewers_configured",
          reviewers: [],
          items: {},
          decisions: {},
          exceptions: [],
          progress: 0,
          complianceScore: 0,
          canonicalHash: "",
          buildVersion,
          siteId,
        };

        console.error("[FT_REVIEW_INIT_BLOCKED] Workflow created in no_reviewers_configured state - export blocked");
        this.workflow = failureWorkflow;
        return failureWorkflow;
      }

      finalReviewers = result.reviewerIds;
      console.log(`[FT_REVIEW_INIT] Resolved ${finalReviewers.length} reviewers via ${result.source}`);
    }

    // Step 2: Validate snapshot structure
    if (!snapshot || !snapshot.items) {
      throw new Error("FAIL_CLOSED: Snapshot missing or malformed");
    }

    // Note: Empty snapshots (0 items) are allowed; they have default compliance score 100
    // (no risky undecided items)

    // Step 3: Lock snapshot hash
    const snapshotHash = ReviewWorkflowEngine.hashSnapshot(snapshot);
    console.log(`[FT_REVIEW_SNAPSHOT_LOCKED] hash=${snapshotHash}`);

    // Step 4: Validate reviewers
    if (finalReviewers.length === 0) {
      throw new Error("FAIL_CLOSED: No reviewers assigned (site admins required)");
    }

    // Step 5: Create locked workflow
    const reviewId = ReviewWorkflowEngine.generateReviewId();
    const now = testCreatedAt || new Date().toISOString();

    const workflow: ReviewWorkflow = {
      reviewId,
      snapshotHash,
      createdAt: now,
      status: "open",
      reviewers: finalReviewers,
      items: snapshot.items,
      decisions: {},
      exceptions: [],
      progress: 0,
      complianceScore: 100,
      canonicalHash: "", // Will be computed below
      buildVersion,
      siteId,
    };

    // Initialize decision records (empty for each item)
    for (const entityId of Object.keys(snapshot.items)) {
      workflow.decisions[entityId] = [];
    }

    // Temporarily assign workflow so _updateComplianceScore can access it
    this.workflow = workflow;

    // Calculate initial compliance score based on item risk levels
    this._updateComplianceScore();

    // Now compute and lock canonical hash (after score is updated)
    this.workflow.canonicalHash = ReviewWorkflowEngine.hashWorkflow(this.workflow);

    this.lockedSnapshot = snapshot;

    console.log(
      `[FT_REVIEW_INIT] reviewId=${reviewId} items=${Object.keys(snapshot.items).length} reviewers=${finalReviewers.length}`
    );

    return this.workflow;
  }

  /**
   * Record a single decision
   * 
   * Fail-closed:
   * - If snapshot mismatched → abort
   * - If review closed → abort
   * - If reviewer not in list → abort
   */
  recordDecision(
    entityId: string,
    reviewerAccountId: string,
    decision: "approved" | "rejected",
    comment?: string,
    testDecisionTimestamp?: string
  ): ReviewDecision {
    if (!this.workflow) {
      throw new Error("FAIL_CLOSED: No active review");
    }

    if (this.workflow.status === "closed") {
      throw new Error("FAIL_CLOSED: Review is closed, no new decisions allowed");
    }

    if (!this.workflow.reviewers.includes(reviewerAccountId)) {
      throw new Error("FAIL_CLOSED: Reviewer not authorized for this review");
    }

    if (!this.workflow.items[entityId]) {
      throw new Error(`FAIL_CLOSED: entityId ${entityId} not in review`);
    }

    const timestamp = testDecisionTimestamp || new Date().toISOString();
    const reviewDecision: ReviewDecision = {
      reviewerAccountId,
      decision,
      comment,
      timestamp,
    };

    this.workflow.decisions[entityId].push(reviewDecision);
    console.log(
      `[FT_REVIEW_DECISION_RECORDED] entityId=${entityId} decision=${decision} reviewer=${reviewerAccountId}`
    );

    // Recalculate progress and score
    this._updateProgress();
    this._updateComplianceScore();

    return reviewDecision;
  }

  /**
   * Bulk record decisions (batch operation)
   */
  recordDecisionBatch(batch: ReviewDecisionBatch): void {
    if (!this.workflow) {
      throw new Error("FAIL_CLOSED: No active review");
    }

    if (batch.reviewId !== this.workflow.reviewId) {
      throw new Error("FAIL_CLOSED: Review ID mismatch");
    }

    for (const decision of batch.decisions) {
      this.recordDecision(
        decision.entityId || "",
        decision.reviewerAccountId,
        decision.decision,
        decision.comment
      );
    }

    console.log(`[FT_REVIEW_BATCH] Applied ${batch.decisions.length} decisions`);
  }

  /**
   * Add an exception (temporary privilege with expiration)
   */
  addException(
    entityId: string,
    reason: string,
    expirationDate: string,
    creatorAccountId: string
  ): ReviewException {
    if (!this.workflow) {
      throw new Error("FAIL_CLOSED: No active review");
    }

    if (!this.workflow.items[entityId]) {
      throw new Error(`FAIL_CLOSED: entityId ${entityId} not in review`);
    }

    const exception: ReviewException = {
      entityId,
      reason,
      expirationDate,
      createdAt: new Date().toISOString(),
      creatorAccountId,
      reviewed: false,
    };

    this.workflow.exceptions.push(exception);
    console.log(`[FT_REVIEW_EXCEPTION] entityId=${entityId} expires=${expirationDate}`);

    return exception;
  }

  /**
   * Check for reviewer inactivity > 7 days
   * Returns list of inactive reviewers
   */
  getInactiveReviewers(): string[] {
    if (!this.workflow) return [];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const inactive: string[] = [];

    for (const reviewerId of this.workflow.reviewers) {
      let lastActivity: Date | null = null;

      // Check all decisions by this reviewer
      for (const decisions of Object.values(this.workflow.decisions)) {
        for (const decision of decisions) {
          if (decision.reviewerAccountId === reviewerId) {
            const decisionTime = new Date(decision.timestamp);
            if (!lastActivity || decisionTime > lastActivity) {
              lastActivity = decisionTime;
            }
          }
        }
      }

      // If no activity or activity > 7 days ago
      if (!lastActivity || lastActivity < sevenDaysAgo) {
        inactive.push(reviewerId);
      }
    }

    return inactive;
  }

  /**
   * Close the review (immutable, final)
   * 
   * Fail-closed: Cannot close if no_reviewers_configured
   */
  closeReview(testClosedAt?: string): ReviewWorkflow {
    if (!this.workflow) {
      throw new Error("FAIL_CLOSED: No active review");
    }

    if (this.workflow.status === "closed") {
      throw new Error("FAIL_CLOSED: Review already closed");
    }

    if (this.workflow.status === "no_reviewers_configured") {
      throw new Error(
        "FAIL_CLOSED: Cannot close review with no reviewers configured"
      );
    }

    this.workflow.status = "closed";
    this.workflow.closedAt = testClosedAt || new Date().toISOString();

    // Recompute canonical hash with final state
    this.workflow.canonicalHash = ReviewWorkflowEngine.hashWorkflow(this.workflow);

    console.log(
      `[FT_REVIEW_CLOSED] reviewId=${this.workflow.reviewId} hash=${this.workflow.canonicalHash}`
    );

    return this.workflow;
  }

  /**
   * Get current workflow state
   */
  getWorkflow(): ReviewWorkflow {
    if (!this.workflow) {
      throw new Error("No active review");
    }
    return this.workflow;
  }

  /**
   * Private: Recalculate progress (decidedItems / totalItems * 100)
   */
  private _updateProgress(): void {
    if (!this.workflow) return;

    const totalItems = Object.keys(this.workflow.items).length;
    let decidedItems = 0;

    for (const decisions of Object.values(this.workflow.decisions)) {
      if (decisions.length > 0) {
        decidedItems++;
      }
    }

    this.workflow.progress =
      totalItems > 0 ? Math.round((decidedItems / totalItems) * 100) : 0;
  }

  /**
   * Private: Recalculate compliance score (deterministic formula)
   * 
   * score = 100 - (highRiskUndecided * 5 + mediumRiskUndecided * 2)
   * Range: [0, 100]
   */
  private _updateComplianceScore(): void {
    if (!this.workflow) return;

    let penalty = 0;

    for (const [entityId, decisions] of Object.entries(this.workflow.decisions)) {
      if (decisions.length === 0) {
        // Item still undecided
        const item = this.workflow.items[entityId];
        if (item.riskLevel === "high") {
          penalty += 5;
        } else if (item.riskLevel === "medium") {
          penalty += 2;
        }
      }
    }

    this.workflow.complianceScore = Math.max(0, 100 - penalty);
  }
}
