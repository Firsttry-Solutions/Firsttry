/**
 * PHASE 3 SOR v1.1 - Workflow Engine
 * Deterministic, lock-based, audit-logged access review workflows
 */

import * as crypto from "crypto";
import {
  ReviewWorkflowState,
  ReviewStatus,
  ReviewReviewer,
  ReviewDecision,
  ReviewException,
  ReviewProgress,
  ReviewComplianceScore,
  ReviewSnapshotRef,
  ReviewError,
  PrivilegeContext,
  SCHEMA_VERSION,
  RULE_SET_VERSION,
  AuditLogEntry,
  AuditAction,
} from "./types";
import {
  buildReviewKey,
  buildReviewKeyForIdentity,
  buildLedgerKey,
  buildAuditLogKey,
  parseQuarter,
  getCurrentQuarter,
  calculateAuditShard,
  validateSiteId,
  validateQuarter,
} from "./storageKeys";
import { withLock } from "./locks";
import { enforcePrivilege, validatePrivilegeContext } from "./privileges";

// ============================================================================
// CANONICAL JSON UTILITIES (DETERMINISTIC)
// ============================================================================

/**
 * Canonical (stable) JSON serialization
 * - Keys sorted alphabetically
 * - No undefined values
 * - Whitespace controlled
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "string") return JSON.stringify(obj);
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);

  // For objects and arrays, sort keys and serialize
  if (typeof obj === "object") {
    if (Array.isArray(obj)) {
      const items = obj.map((item) => canonicalizeJson(item));
      return `[${items.join(",")}]`;
    } else {
      const keys = Object.keys(obj as Record<string, unknown>).sort();
      const pairs = keys.map((key) => {
        const val = (obj as Record<string, unknown>)[key];
        if (val === undefined) return null; // Skip undefined values
        return `"${key}":${canonicalizeJson(val)}`;
      });
      const filtered = pairs.filter((p) => p !== null);
      return `{${filtered.join(",")}}`;
    }
  }

  throw new ReviewError(
    "CANONICAL_JSON_FAILED",
    `Cannot canonicalize value: ${typeof obj}`,
    { value: obj }
  );
}

/**
 * Compute state hash (SHA-256 of canonical JSON without hash field)
 */
export function computeStateHash(stateWithoutHash: ReviewWorkflowState): string {
  const canonical = canonicalizeJson(stateWithoutHash);
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Compute event ID (deterministic from review + actor + action + time + payload)
 */
export function computeEventId(
  reviewId: string,
  actorAccountId: string,
  action: AuditAction,
  occurredUtc: string,
  payloadHash: string
): string {
  const composite = `${reviewId}:${actorAccountId}:${action}:${occurredUtc}:${payloadHash}`;
  return crypto.createHash("sha256").update(composite).digest("hex");
}

// ============================================================================
// REVIEW ID GENERATION (DETERMINISTIC)
// ============================================================================

/**
 * Generate review ID from siteId + quarter
 * reviewId = sha256(canonical(${siteId}:${quarter}:ar.v1:phase3.v1))
 */
export function generateReviewId(siteId: string, quarter: string): string {
  validateSiteId(siteId);
  validateQuarter(quarter);

  const reviewKey = buildReviewKeyForIdentity(siteId, quarter);
  const canonical = canonicalizeJson(reviewKey);
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

// ============================================================================
// OPEN QUARTERLY REVIEW (WORKFLOW: LOCK → SNAPSHOT → STATE → LEDGER → AUDIT)
// ============================================================================

/**
 * Open a quarterly access review
 * 
 * Flow:
 * 1. Acquire lock (fail if unavailable)
 * 2. Generate deterministic reviewId
 * 3. Check if review already exists (if yes, return)
 * 4. Generate baseline snapshot (placeholder)
 * 5. Create workflow state
 * 6. Compute stateHash
 * 7. Store state
 * 8. Write ledger entry
 * 9. Write audit event OPEN
 * 10. Release lock
 * 
 * Returns: reviewId, status (NEW or EXISTS)
 */
export async function openQuarterlyReview(
  siteId: string,
  quarter: string,
  reviewerAccountIds: string[],
  privilegeContext: PrivilegeContext,
  storage?: any  // Forge storage interface
): Promise<{ reviewId: string; status: "NEW" | "EXISTS"; state: ReviewWorkflowState }> {
  // Validation
  validateSiteId(siteId);
  validateQuarter(quarter);
  validatePrivilegeContext(privilegeContext);
  enforcePrivilege(privilegeContext);

  const reviewId = generateReviewId(siteId, quarter);
  const nowUtc = new Date().toISOString();

  console.log(`[FT_REVIEW_OPEN_START] siteId=${siteId} quarter=${quarter} reviewId=${reviewId}`);

  return withLock(siteId, quarter, privilegeContext.accountId, async () => {
    // Check if review already exists
    const reviewKey = buildReviewKey(siteId, reviewId);
    const existingState = storage?.get ? await storage.get(reviewKey) : null;

    if (existingState) {
      console.log(`[FT_REVIEW_OPEN_COMPLETE] Review already exists, returning`);
      return {
        reviewId,
        status: "EXISTS",
        state: existingState,
      };
    }

    // Generate baseline snapshot (reuse Phase 1 if available)
    const snapshotId = crypto
      .createHash("sha256")
      .update(canonicalizeJson({ siteId, quarter, timestamp: nowUtc }))
      .digest("hex")
      .substring(0, 12);

    console.log(`[FT_REVIEW_SNAPSHOT_LOCKED] snapshotId=${snapshotId}`);

    // Create workflow state
    const reviewers: ReviewReviewer[] = reviewerAccountIds.map((accountId, idx) => ({
      accountId,
      displayName: `Reviewer ${idx + 1}`,
      role: idx === 0 ? "PRIMARY" : "SECONDARY",
      assignedUtc: nowUtc,
    }));

    const progress: ReviewProgress = {
      totalItems: 0,  // Will be updated when items are added
      reviewedItems: 0,
      percent: 0,
    };

    const complianceScore: ReviewComplianceScore = {
      value: 100,
      basis: "initial_state",
      computedUtc: nowUtc,
    };

    const snapshotRef: ReviewSnapshotRef = {
      snapshotId,
      snapshotsUtc: nowUtc,
      itemCount: 0,
      baselineSha: "",
    };

    // Create state (without hash first)
    const stateWithoutHash: any = {
      reviewId,
      siteId,
      quarter,
      schemaVersion: SCHEMA_VERSION,
      ruleSetVersion: RULE_SET_VERSION,
      createdUtc: nowUtc,
      lastUpdatedUtc: nowUtc,
      status: "OPEN" as ReviewStatus,
      privilegeContext,
      snapshotRef,
      reviewers,
      decisions: [],
      exceptions: [],
      progress,
      complianceScore,
    };

    // Compute state hash
    const stateHash = computeStateHash(stateWithoutHash);

    // Add hash to state
    const state: ReviewWorkflowState = {
      ...stateWithoutHash,
      stateHash,
    };

    // Store state
    if (storage?.set) {
      await storage.set(reviewKey, state);
    }

    // Write ledger entry
    if (storage?.set) {
      const ledgerKey = buildLedgerKey(siteId, reviewId);
      const ledgerEntry = {
        reviewId,
        quarter,
        createdUtc: nowUtc,
        workflowStateHash: stateHash,
        exportHashes: [],
      };
      await storage.set(ledgerKey, ledgerEntry);
    }

    // Write audit event OPEN
    if (storage?.set) {
      const auditKey = buildAuditLogKey(siteId, reviewId, 0);
      const payloadHash = crypto
        .createHash("sha256")
        .update(canonicalizeJson({ reviewId, reviewers }))
        .digest("hex");
      const eventId = computeEventId(
        reviewId,
        privilegeContext.accountId,
        "OPEN",
        nowUtc,
        payloadHash
      );
      const auditEntry: AuditLogEntry = {
        eventId,
        occurredUtc: nowUtc,
        actorAccountId: privilegeContext.accountId,
        action: "OPEN",
        payloadHash,
      };
      // Store as array for shard
      const existingAudit = (await storage.get(auditKey)) || [];
      existingAudit.push(auditEntry);
      await storage.set(auditKey, existingAudit);
    }

    console.log(`[FT_REVIEW_OPEN_COMPLETE] reviewId=${reviewId}`);

    return {
      reviewId,
      status: "NEW",
      state,
    };
  });
}

// ============================================================================
// RECORD DECISION (LOCK → APPEND → STATEUPDATE → AUDIT)
// ============================================================================

/**
 * Record a reviewer decision
 */
export async function recordDecision(
  siteId: string,
  reviewId: string,
  reviewerId: string,
  decision: "APPROVED" | "DENIED" | "ABSTAIN",
  justification: string | undefined,
  privilegeContext: PrivilegeContext,
  storage?: any
): Promise<ReviewWorkflowState> {
  validateSiteId(siteId);
  validatePrivilegeContext(privilegeContext);
  enforcePrivilege(privilegeContext);

  const nowUtc = new Date().toISOString();

  return withLock(siteId, getCurrentQuarter(), privilegeContext.accountId, async () => {
    // Fetch current state
    const reviewKey = buildReviewKey(siteId, reviewId);
    const state = storage?.get ? await storage.get(reviewKey) : null;

    if (!state) {
      throw new ReviewError(
        "INVALID_INPUT",
        `Review ${reviewId} not found`,
        { reviewId }
      );
    }

    // Verify reviewer exists
    const reviewer = state.reviewers.find((r: ReviewReviewer) => r.accountId === reviewerId);
    if (!reviewer) {
      throw new ReviewError(
        "INVALID_REVIEWER",
        `Reviewer ${reviewerId} not in review`,
        { reviewId, reviewerId }
      );
    }

    // Append decision
    const decisionRecord: ReviewDecision = {
      reviewerId,
      decision,
      recordedUtc: nowUtc,
      justification,
      decisionHash: crypto
        .createHash("sha256")
        .update(canonicalizeJson({ reviewerId, decision, nowUtc, justification }))
        .digest("hex"),
    };

    state.decisions.push(decisionRecord);
    state.lastUpdatedUtc = nowUtc;

    // Recompute progress
    const totalItems = state.progress.totalItems;
    const reviewedItems = new Set(state.decisions.map((d: ReviewDecision) => d.reviewerId)).size;
    state.progress.percent = totalItems > 0 ? Math.floor((reviewedItems / totalItems) * 100) : 0;
    state.progress.reviewedItems = reviewedItems;

    // Recompute state hash
    const stateWithoutHash = { ...state };
    delete (stateWithoutHash as any).stateHash;
    state.stateHash = computeStateHash(stateWithoutHash);

    // Store updated state
    if (storage?.set) {
      await storage.set(reviewKey, state);
    }

    // Write audit entry
    if (storage?.set) {
      const payloadHash = crypto
        .createHash("sha256")
        .update(canonicalizeJson({ reviewerId, decision }))
        .digest("hex");
      const eventId = computeEventId(
        reviewId,
        privilegeContext.accountId,
        "DECISION_RECORDED",
        nowUtc,
        payloadHash
      );
      const auditEntry: AuditLogEntry = {
        eventId,
        occurredUtc: nowUtc,
        actorAccountId: privilegeContext.accountId,
        action: "DECISION_RECORDED",
        payloadHash,
      };
      const auditKey = buildAuditLogKey(siteId, reviewId, 0);
      const existingAudit = (await storage.get(auditKey)) || [];
      existingAudit.push(auditEntry);
      await storage.set(auditKey, existingAudit);
    }

    console.log(`[FT_REVIEW_DECISION_RECORDED] reviewId=${reviewId} reviewer=${reviewerId}`);

    return state;
  });
}

// ============================================================================
// ADD EXCEPTION (BOUNDED, DETERMINISTIC EXPIRY)
// ============================================================================

/**
 * Add exception to review
 * - expiresUtc must be > now
 * - justification <= 2000 chars (normalized whitespace)
 */
export async function addException(
  siteId: string,
  reviewId: string,
  itemId: string,
  risk: "LOW" | "MEDIUM" | "HIGH",
  expiresUtc: string,
  justification: string,
  privilegeContext: PrivilegeContext,
  storage?: any
): Promise<ReviewWorkflowState> {
  validateSiteId(siteId);
  validatePrivilegeContext(privilegeContext);
  enforcePrivilege(privilegeContext);

  const nowUtc = new Date().toISOString();

  // Validate expiry
  if (new Date(expiresUtc) <= new Date(nowUtc)) {
    throw new ReviewError(
      "INVALID_INPUT",
      "Exception expiry must be in future",
      { expiresUtc, nowUtc }
    );
  }

  // Normalize justification
  const normalized = justification.replace(/\s+/g, " ").trim();
  if (normalized.length > 2000) {
    throw new ReviewError(
      "INVALID_INPUT",
      "Justification exceeds 2000 characters",
      { length: normalized.length }
    );
  }

  return withLock(siteId, getCurrentQuarter(), privilegeContext.accountId, async () => {
    const reviewKey = buildReviewKey(siteId, reviewId);
    const state = storage?.get ? await storage.get(reviewKey) : null;

    if (!state) {
      throw new ReviewError("INVALID_INPUT", `Review ${reviewId} not found`, { reviewId });
    }

    // Create exception
    const exceptionId = crypto
      .createHash("sha256")
      .update(canonicalizeJson({ itemId, nowUtc }))
      .digest("hex")
      .substring(0, 12);

    const justificationHash = crypto
      .createHash("sha256")
      .update(normalized)
      .digest("hex");

    const exception: ReviewException = {
      exceptionId,
      itemId,
      risk,
      expiresUtc,
      createdUtc: nowUtc,
      justification: normalized,
      justificationHash,
    };

    state.exceptions.push(exception);
    state.lastUpdatedUtc = nowUtc;

    // Recompute state hash
    const stateWithoutHash = { ...state };
    delete (stateWithoutHash as any).stateHash;
    state.stateHash = computeStateHash(stateWithoutHash);

    // Store
    if (storage?.set) {
      await storage.set(reviewKey, state);
    }

    // Audit
    if (storage?.set) {
      const payloadHash = crypto
        .createHash("sha256")
        .update(canonicalizeJson({ itemId, risk }))
        .digest("hex");
      const eventId = computeEventId(
        reviewId,
        privilegeContext.accountId,
        "EXCEPTION_ADDED",
        nowUtc,
        payloadHash
      );
      const auditEntry: AuditLogEntry = {
        eventId,
        occurredUtc: nowUtc,
        actorAccountId: privilegeContext.accountId,
        action: "EXCEPTION_ADDED",
        payloadHash,
      };
      const auditKey = buildAuditLogKey(siteId, reviewId, 0);
      const existingAudit = (await storage.get(auditKey)) || [];
      existingAudit.push(auditEntry);
      await storage.set(auditKey, existingAudit);
    }

    console.log(`[FT_REVIEW_EXCEPTION_ADDED] itemId=${itemId} expiresUtc=${expiresUtc}`);

    return state;
  });
}

// ============================================================================
// EXPIRE EXCEPTIONS (DETERMINISTIC TRANSITION)
// ============================================================================

/**
 * Expire exceptions past their expiration time
 * - Deterministic: OPEN→EXPIRED transition
 * - No partial updates
 */
export async function expireExceptions(
  siteId: string,
  reviewId: string,
  privilegeContext: PrivilegeContext,
  storage?: any
): Promise<ReviewWorkflowState> {
  validateSiteId(siteId);
  validatePrivilegeContext(privilegeContext);
  enforcePrivilege(privilegeContext);

  const nowUtc = new Date().toISOString();

  return withLock(siteId, getCurrentQuarter(), privilegeContext.accountId, async () => {
    const reviewKey = buildReviewKey(siteId, reviewId);
    const state = storage?.get ? await storage.get(reviewKey) : null;

    if (!state) {
      throw new ReviewError("INVALID_INPUT", `Review ${reviewId} not found`, { reviewId });
    }

    // Filter expired exceptions
    const before = state.exceptions.length;
    state.exceptions = state.exceptions.filter(
      (e: ReviewException) => new Date(e.expiresUtc) > new Date(nowUtc)
    );
    const expired = before - state.exceptions.length;

    if (expired > 0) {
      state.lastUpdatedUtc = nowUtc;

      // Recompute state hash
      const stateWithoutHash = { ...state };
      delete (stateWithoutHash as any).stateHash;
      state.stateHash = computeStateHash(stateWithoutHash);

      // Store
      if (storage?.set) {
        await storage.set(reviewKey, state);
      }

      // Audit
      if (storage?.set) {
        const payloadHash = crypto
          .createHash("sha256")
          .update(canonicalizeJson({ expiredCount: expired }))
          .digest("hex");
        const eventId = computeEventId(
          reviewId,
          privilegeContext.accountId,
          "EXCEPTION_EXPIRED",
          nowUtc,
          payloadHash
        );
        const auditEntry: AuditLogEntry = {
          eventId,
          occurredUtc: nowUtc,
          actorAccountId: privilegeContext.accountId,
          action: "EXCEPTION_EXPIRED",
          payloadHash,
        };
        const auditKey = buildAuditLogKey(siteId, reviewId, 0);
        const existingAudit = (await storage.get(auditKey)) || [];
        existingAudit.push(auditEntry);
        await storage.set(auditKey, existingAudit);
      }

      console.log(`[FT_REVIEW_EXCEPTIONS_EXPIRED] count=${expired}`);
    }

    return state;
  });
}

// ============================================================================
// STATE VALIDATION & VERIFICATION (ON READ)
// ============================================================================

/**
 * Read and verify workflow state hash matches stored
 * Throws STATE_HASH_MISMATCH if mismatch
 */
export async function readAndVerifyState(
  siteId: string,
  reviewId: string,
  storage?: any
): Promise<ReviewWorkflowState> {
  validateSiteId(siteId);

  const reviewKey = buildReviewKey(siteId, reviewId);
  const state = storage?.get ? await storage.get(reviewKey) : null;

  if (!state) {
    throw new ReviewError("INVALID_INPUT", `Review ${reviewId} not found`, { reviewId });
  }

  // Verify state hash
  const storedHash = state.stateHash;
  const stateWithoutHash = { ...state };
  delete (stateWithoutHash as any).stateHash;
  const recomputedHash = computeStateHash(stateWithoutHash);

  if (storedHash !== recomputedHash) {
    throw new ReviewError(
      "STATE_HASH_MISMATCH",
      `State integrity check failed for ${reviewId}`,
      { stored: storedHash, recomputed: recomputedHash }
    );
  }

  return state;
}
