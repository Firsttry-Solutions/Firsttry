/**
 * FirstTry Phase 3 — Access Review System of Record v1
 * Data Model for Quarterly Access Review Workflows
 *
 * Non-negotiable properties:
 * - All timestamps are ISO 8601 UTC
 * - All IDs are deterministic (no UUIDs)
 * - All decisions are immutable once recorded
 * - All workflows are snapshot-locked
 * - All exports are auditor-replayable
 */

/**
 * ReviewItem: A privilege/access entry under review
 */
export interface ReviewItem {
  /** Unique entity identifier (user AccountId, project key, or role ID) */
  entityId: string;
  
  /** Entity type being reviewed */
  entityType: "user" | "project" | "role";
  
  /** Human-readable privilege summary (e.g., "Jira Administrator") */
  privilegeSummary: string;
  
  /** Risk level of this privilege */
  riskLevel: "low" | "medium" | "high";
  
  /** When this item was added to the review (ISO 8601 UTC) */
  addedAt: string;
  
  /** Optional context/justification for the privilege */
  context?: string;
}

/**
 * ReviewDecision: A reviewer's approval/rejection decision on a review item
 */
export interface ReviewDecision {
  /** Jira AccountId of the reviewer */
  reviewerAccountId: string;
  
  /** Decision outcome */
  decision: "approved" | "rejected";
  
  /** Optional comment from reviewer */
  comment?: string;
  
  /** When this decision was recorded (ISO 8601 UTC) */
  timestamp: string;
  
  /** Display name of reviewer (for evidence) */
  reviewerDisplayName?: string;
}

/**
 * ReviewException: A privilege granted as a temporary exception with expiration
 */
export interface ReviewException {
  /** Entity ID for which exception applies */
  entityId: string;
  
  /** Justification for the exception */
  reason: string;
  
  /** When this exception expires (ISO 8601 UTC) */
  expirationDate: string;
  
  /** When this exception was created (ISO 8601 UTC) */
  createdAt: string;
  
  /** Jira AccountId of who created it */
  creatorAccountId: string;
  
  /** Whether this exception has been reviewed/acknowledged */
  reviewed?: boolean;
}

/**
 * ReviewWorkflow: The complete quarterly access review state machine
 *
 * Immutable properties:
 * - snapshotHash (locked at workflow creation)
 * - createdAt (workflow start time)
 * - canonicalHash (computed once, never changes)
 */
export interface ReviewWorkflow {
  /** Unique review identifier (deterministic: YYYYQ#) */
  reviewId: string;
  
  /** SHA-256 hash of locked snapshot (immutable) */
  snapshotHash: string;
  
  /** When workflow was created (ISO 8601 UTC, immutable) */
  createdAt: string;
  
  /** Current workflow status */
  status: "open" | "closed" | "no_reviewers_configured";
  
  /** When workflow was closed (ISO 8601 UTC, null if still open) */
  closedAt?: string;
  
  /** List of reviewer AccountIds (site admins) */
  reviewers: string[];
  
  /** Review items keyed by entityId */
  items: Record<string, ReviewItem>;
  
  /** Decisions keyed by entityId, values are arrays (one per reviewer) */
  decisions: Record<string, ReviewDecision[]>;
  
  /** Active exceptions */
  exceptions: ReviewException[];
  
  /** Progress: 0-100 (decidedItems / totalItems * 100) */
  progress: number;
  
  /** Compliance score: 0-100 (100 - penalty for undecided high/medium risk) */
  complianceScore: number;
  
  /** SHA-256 of entire workflow (for determinism verification) */
  canonicalHash: string;
  
  /** Build version that created this workflow */
  buildVersion: string;
  
  /** Site ID (for evidence mapping) */
  siteId?: string;
}

/**
 * ReviewDecisionBatch: For bulk operations
 */
export interface ReviewDecisionBatch {
  reviewId: string;
  decisions: Array<ReviewDecision & { entityId: string }>;
  appliedAt: string;
  appliedByAccountId: string;
}

/**
 * ReviewExport: Metadata for exported review pack
 */
export interface ReviewExport {
  reviewId: string;
  exportedAt: string;
  exportedByAccountId: string;
  packSha256: string;
  schemaVersion: string;
  buildShaShort: string;
  siteId?: string;
}

/**
 * ReviewConfig: Configuration for reviewer assignment (stored in Forge Storage)
 *
 * Deterministic reviewer resolution:
 * 1. If reviewerAllowlist exists → use those accountIds ONLY
 * 2. Else fallback to jira-administrators group
 * 3. If both missing/empty → fail-closed with status="no_reviewers_configured"
 */
export interface ReviewConfig {
  /** Explicit list of accountIds allowed to review (highest priority) */
  reviewerAllowlist?: string[];
  
  /** Fallback group name if allowlist not configured (default: "jira-administrators") */
  fallbackGroup?: string;
  
  /** When this config was last updated */
  updatedAt?: string;
  
  /** Jira AccountId of who updated it */
  updatedByAccountId?: string;
}
