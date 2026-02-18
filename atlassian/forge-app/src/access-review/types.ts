/**
 * PHASE 3 SOR v1.1 - Access Review Data Models
 * Strict, versioned, deterministic data model
 * Schema: ar.v1 / Phase3.v1
 */

// ============================================================================
// SCHEMA & RULE SET VERSIONS (CANONICAL)
// ============================================================================

export const SCHEMA_VERSION = "ar.v1";
export const RULE_SET_VERSION = "phase3.v1";

// ============================================================================
// REVIEWED STATUS ENUM (DETERMINISTIC)
// ============================================================================

export type ReviewStatus = 
  | "OPEN"
  | "IN_REVIEW"
  | "COMPLETED"
  | "ESCALATED"
  | "EXPIRED"
  | "FAILED";

export type DecisionType = "APPROVED" | "DENIED" | "ABSTAIN";

export type ExceptionRisk = "LOW" | "MEDIUM" | "HIGH";

// ============================================================================
// PRIVILEGE CONTEXT (REQUIRED FOR ALL OPERATIONS)
// ============================================================================

export interface PrivilegeContext {
  accountId: string;
  displayName: string;
  isJiraSiteAdmin: boolean;
  isGlobalAdmin: boolean;
  isDenied: boolean;
  denialReason?: string;
}

// ============================================================================
// REVIEW SNAPSHOT (BASELINE CAPTURE)
// ============================================================================

export interface ReviewSnapshotRef {
  snapshotId: string;
  snapshotsUtc: string;
  itemCount: number;
  baselineSha: string;
}

// ============================================================================
// REVIEWER & DECISION
// ============================================================================

export interface ReviewReviewer {
  accountId: string;
  displayName: string;
  role: "PRIMARY" | "SECONDARY";
  assignedUtc: string;
}

export interface ReviewDecision {
  reviewerId: string;
  decision: DecisionType;
  recordedUtc: string;
  justification?: string;
  decisionHash: string;
}

// ============================================================================
// EXCEPTION (BOUNDED, DETERMINISTIC EXPIRY)
// ============================================================================

export interface ReviewException {
  exceptionId: string;
  itemId: string;
  risk: ExceptionRisk;
  expiresUtc: string;
  createdUtc: string;
  justification: string;
  justificationHash: string;
}

// ============================================================================
// COMPLIANCE SCORE
// ============================================================================

export interface ReviewComplianceScore {
  value: number;  // 0-100
  basis: string;  // "decisions_recorded" | "items_reviewed" etc
  computedUtc: string;
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

export interface ReviewProgress {
  totalItems: number;
  reviewedItems: number;
  percent: number;  // floor((reviewedItems/totalItems)*100)
}

// ============================================================================
// WORKFLOW STATE (CORE DATA STRUCTURE)
// ============================================================================

export interface ReviewWorkflowState {
  // Identity
  reviewId: string;                    // sha256(canonical(reviewKey))
  siteId: string;                      // Jira site ID
  quarter: string;                     // e.g., "2025-Q1"

  // Versioning
  schemaVersion: string;               // "ar.v1"
  ruleSetVersion: string;              // "phase3.v1"

  // Timing
  createdUtc: string;                  // NOT part of identity
  lastUpdatedUtc: string;

  // Status & Privilege
  status: ReviewStatus;
  privilegeContext: PrivilegeContext;

  // Data
  snapshotRef: ReviewSnapshotRef;
  reviewers: ReviewReviewer[];
  decisions: ReviewDecision[];
  exceptions: ReviewException[];
  progress: ReviewProgress;
  complianceScore: ReviewComplianceScore;

  // Integrity
  stateHash: string;                   // sha256(canonical(stateWithoutHash))

  // FT_ECL_PHASE: ECL-4 REVIEW_SEAL_FIELDS
  sealed?: boolean;                    // Whether this review has been sealed
  sealedTimestampUtc?: string;         // UTC timestamp when sealed
  sealedByRole?: string;               // Role of the sealing actor
  sealHash?: string;                   // sha256(canonical(sealObject))

  // Failure tracking
  failure?: {
    code: string;
    message: string;
    occurredUtc: string;
  };
}

// ============================================================================
// LEDGER ENTRY (SHARDED, APPEND-ONLY)
// ============================================================================

export interface ReviewLedgerEntry {
  reviewId: string;
  quarter: string;
  createdUtc: string;
  workflowStateHash: string;
  exportHashes: string[];
}

// ============================================================================
// AUDIT LOG ENTRY (MAX 500 PER SHARD, APPEND-ONLY)
// ============================================================================

export type AuditAction =
  | "OPEN"
  | "DECISION_RECORDED"
  | "EXCEPTION_ADDED"
  | "EXCEPTION_EXPIRED"
  | "EXPORTED"
  | "FAILED";

export interface AuditLogEntry {
  eventId: string;                     // sha256(reviewId + actorAccountId + action + occurredUtc + payloadHash)
  occurredUtc: string;
  actorAccountId: string;
  action: AuditAction;
  payloadHash: string;
}

// ============================================================================
// LOCK STATE (TRANSIENT)
// ============================================================================

export interface LockState {
  lockKey: string;                     // ar.v1:lock:<siteId>:<quarter>
  acquiredUtc: string;
  expiresUtc: string;
  holderAccountId: string;
}

// ============================================================================
// STORAGE KEY PATTERNS (KEYS ONLY - SEE storageKeys.ts)
// ============================================================================

export interface StorageKeyPatterns {
  reviewKey: (siteId: string, reviewId: string) => string;
  reviewLedgerKey: (siteId: string, reviewId: string) => string;
  auditLogKey: (siteId: string, reviewId: string, shard: number) => string;
  indexKey: (siteId: string, year: number, shard: number) => string;
  lockKey: (siteId: string, quarter: string) => string;
}

// ============================================================================
// ERROR TYPES (FAIL-CLOSED)
// ============================================================================

export type ErrorCode =
  | "LOCK_UNAVAILABLE"
  | "LOCK_TIMEOUT"
  | "STATE_HASH_MISMATCH"
  | "PRIVILEGE_DENIED"
  | "INVALID_REVIEWER"
  | "SHARD_OVERFLOW"
  | "STORAGE_ERROR"
  | "INVALID_INPUT"
  | "EXPIRY_PARSE_FAILED"
  | "CANONICAL_JSON_FAILED";

export class ReviewError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ReviewError";
  }
}

// ============================================================================
// EXPORT PACK STRUCTURES (DETERMINISTIC)
// ============================================================================

export interface ExportManifest {
  buildShaShort: string;
  buildUtc: string;
  schemaVersion: string;
  siteId: string;
  privilegeContext: PrivilegeContext;
  ruleSetVersion: string;
  fileHashes: Record<string, string>;
}

export interface ExportPackMeta {
  manifest: ExportManifest;
  reviewId: string;
  exportedUtc: string;
}
