/**
 * PHASE 3 v1.2 - RBAC Delegation with Reviewer Group Freeze
 * Role-based access control with immutable reviewer group snapshots
 *
 * Requirements:
 * - Reviewer group freeze at openQuarterlyReview time
 * - No re-query of groups (snapshot-based, deterministic)
 * - Privilege escalation prevention
 * - Delegation permission model
 * - Group membership audit trail
 * - Marker: [FT_RBAC_DELEGATION_FREEZE_COMPLETE]
 */

import { ReviewError, ReviewErrorCode } from "./types";
import * as crypto from "crypto";

// ============================================================================
// Error Handling
// ============================================================================

export class RBACError extends ReviewError {
  constructor(message: string, public reason: string) {
    super(message);
    this.name = "RBACError";
    this.code = "RBAC_ERROR" as ReviewErrorCode;
  }
}

export class PrivilegeEscalationError extends RBACError {
  constructor(message: string) {
    super(message, "PRIVILEGE_ESCALATION_ATTEMPT");
    this.name = "PrivilegeEscalationError";
  }
}

export class GroupModificationError extends RBACError {
  constructor(message: string) {
    super(message, "GROUP_FROZEN_MODIFICATION_ATTEMPT");
    this.name = "GroupModificationError";
  }
}

// ============================================================================
// Data Models
// ============================================================================

export type Role = "ADMIN" | "REVIEWER" | "AUDIT_LOG" | "OBSERVER";
export type DelegationScope =
  | "REVIEW_DECISION"
  | "EXCEPTION_APPROVAL"
  | "EXPORT_PACK"
  | "AUDIT_VIEW";

export interface ReviewerGroupSnapshot {
  snapshotId: string;
  reviewId: string;
  timestamp: number;
  frozenAt: number;
  reviewers: ReviewerEntry[];
  checksum: string;
  isFrozen: boolean;
}

export interface ReviewerEntry {
  accountId: string;
  displayName: string;
  email: string;
  role: Role;
  joinedAt: number;
  isActive: boolean;
}

export interface DelegationPermission {
  id: string;
  from: string; // delegating accountId
  to: string; // recipient accountId
  scope: DelegationScope;
  expiresAt: number;
  isRevoked: boolean;
  revokedAt?: number;
  auditLog: DelegationAuditEntry[];
}

export interface DelegationAuditEntry {
  timestamp: number;
  action: "GRANTED" | "USED" | "REVOKED" | "EXPIRED";
  actorId: string;
  details: string;
}

export interface RBACContext {
  accountId: string;
  role: Role;
  groups: string[];
  isReviewerInSnapshot: boolean;
  delegatedScopes: DelegationScope[];
  timestamp: number;
}

// ============================================================================
// Group Snapshot & Freeze
// ============================================================================

export interface GroupSnapshot {
  id: string;
  reviewId: string;
  members: {
    accountId: string;
    role: Role;
    displayName: string;
  }[];
  frozenAt: number;
  hash: string;
}

export function createGroupSnapshot(
  reviewId: string,
  reviewers: ReviewerEntry[]
): ReviewerGroupSnapshot {
  const now = Date.now();
  const snapshotData = {
    reviewId,
    frozenAt: now,
    reviewers: reviewers.map((r) => ({
      accountId: r.accountId,
      role: r.role,
      email: r.email,
    })),
  };

  const checksum = crypto
    .createHash("sha256")
    .update(JSON.stringify(snapshotData))
    .digest("hex");

  return {
    snapshotId: `snapshot_${reviewId}_${now}`,
    reviewId,
    timestamp: now,
    frozenAt: now,
    reviewers,
    checksum,
    isFrozen: true,
  };
}

export function verifyGroupSnapshotIntegrity(
  snapshot: ReviewerGroupSnapshot
): boolean {
  const snapshotData = {
    reviewId: snapshot.reviewId,
    frozenAt: snapshot.frozenAt,
    reviewers: snapshot.reviewers.map((r) => ({
      accountId: r.accountId,
      role: r.role,
      email: r.email,
    })),
  };

  const computedChecksum = crypto
    .createHash("sha256")
    .update(JSON.stringify(snapshotData))
    .digest("hex");

  return computedChecksum === snapshot.checksum;
}

export function assertGroupNotModified(
  originalSnapshot: ReviewerGroupSnapshot,
  currentSnapshot: ReviewerGroupSnapshot
): void {
  if (originalSnapshot.checksum !== currentSnapshot.checksum) {
    throw new GroupModificationError(
      `Reviewer group was modified. Original checksum: ${originalSnapshot.checksum}, Current: ${currentSnapshot.checksum}`
    );
  }

  if (!originalSnapshot.isFrozen || !currentSnapshot.isFrozen) {
    throw new GroupModificationError(
      "Reviewer group is not frozen (should be immutable)"
    );
  }
}

// ============================================================================
// Group Membership Verification
// ============================================================================

export function isReviewerInSnapshot(
  accountId: string,
  snapshot: ReviewerGroupSnapshot
): boolean {
  return snapshot.reviewers.some(
    (r) => r.accountId === accountId && r.isActive
  );
}

export function getReviewerRoleInSnapshot(
  accountId: string,
  snapshot: ReviewerGroupSnapshot
): Role | null {
  const reviewer = snapshot.reviewers.find(
    (r) => r.accountId === accountId && r.isActive
  );
  return reviewer?.role || null;
}

export function getReviewerMembershipDuration(
  accountId: string,
  snapshot: ReviewerGroupSnapshot
): number {
  const reviewer = snapshot.reviewers.find((r) => r.accountId === accountId);
  if (!reviewer) return 0;

  return snapshot.frozenAt - reviewer.joinedAt;
}

// ============================================================================
// Delegation Management
// ============================================================================

export function createDelegationPermission(
  from: string,
  to: string,
  scope: DelegationScope,
  durationMs: number
): DelegationPermission {
  const now = Date.now();
  return {
    id: `del_${from}_${to}_${now}`,
    from,
    to,
    scope,
    expiresAt: now + durationMs,
    isRevoked: false,
    auditLog: [
      {
        timestamp: now,
        action: "GRANTED",
        actorId: from,
        details: `Delegated ${scope} to ${to}`,
      },
    ],
  };
}

export function verifyDelegationValid(delegation: DelegationPermission): void {
  if (delegation.isRevoked) {
    throw new PrivilegeEscalationError(
      `Delegation ${delegation.id} has been revoked`
    );
  }

  if (delegation.expiresAt < Date.now()) {
    throw new PrivilegeEscalationError(
      `Delegation ${delegation.id} has expired`
    );
  }
}

export function useDelegation(
  delegation: DelegationPermission,
  accountId: string
): void {
  verifyDelegationValid(delegation);

  if (delegation.to !== accountId) {
    throw new PrivilegeEscalationError(
      `Delegation is not valid for account ${accountId}`
    );
  }

  delegation.auditLog.push({
    timestamp: Date.now(),
    action: "USED",
    actorId: accountId,
    details: `Used delegation for ${delegation.scope}`,
  });

  console.log(
    `[FT_RBAC_DELEGATION_USED] Delegation ${delegation.id} used by ${accountId}`
  );
}

export function revokeDelegation(
  delegation: DelegationPermission,
  revokerId: string
): void {
  if (delegation.isRevoked) {
    throw new RBACError("Delegation already revoked", "ALREADY_REVOKED");
  }

  delegation.isRevoked = true;
  delegation.revokedAt = Date.now();

  delegation.auditLog.push({
    timestamp: Date.now(),
    action: "REVOKED",
    actorId: revokerId,
    details: `Revoked by ${revokerId}`,
  });

  console.log(
    `[FT_RBAC_DELEGATION_REVOKED] Delegation ${delegation.id} revoked`
  );
}

// ============================================================================
// RBAC Context Building
// ============================================================================

export function buildRBACContext(
  accountId: string,
  snapshot: ReviewerGroupSnapshot,
  delegations: DelegationPermission[]
): RBACContext {
  const isInSnapshot = isReviewerInSnapshot(accountId, snapshot);
  const role = getReviewerRoleInSnapshot(accountId, snapshot) || "OBSERVER";

  const validDelegations = delegations.filter(
    (d) => d.to === accountId && !d.isRevoked && d.expiresAt > Date.now()
  );

  const delegatedScopes = validDelegations.map((d) => d.scope);

  return {
    accountId,
    role,
    groups: [role],
    isReviewerInSnapshot,
    delegatedScopes,
    timestamp: Date.now(),
  };
}

// ============================================================================
// Access Control Checks
// ============================================================================

export function assertCanRecordDecision(
  context: RBACContext,
  snapshot: ReviewerGroupSnapshot
): void {
  if (!context.isReviewerInSnapshot) {
    throw new PrivilegeEscalationError(
      `Account ${context.accountId} is not in the frozen reviewer group`
    );
  }

  const allowedRoles: Role[] = ["ADMIN", "REVIEWER"];
  if (!allowedRoles.includes(context.role)) {
    throw new PrivilegeEscalationError(
      `Role ${context.role} cannot record decisions`
    );
  }
}

export function assertCanApproveException(
  context: RBACContext,
  snapshot: ReviewerGroupSnapshot
): void {
  if (!context.isReviewerInSnapshot) {
    throw new PrivilegeEscalationError(
      `Account ${context.accountId} not in reviewer group`
    );
  }

  const isDelegated = context.delegatedScopes.includes("EXCEPTION_APPROVAL");
  if (context.role !== "ADMIN" && !isDelegated) {
    throw new PrivilegeEscalationError(
      `Role ${context.role} cannot approve exceptions without delegation`
    );
  }
}

export function assertCanExport(context: RBACContext): void {
  const isDelegated = context.delegatedScopes.includes("EXPORT_PACK");
  if (context.role !== "ADMIN" && !isDelegated) {
    throw new PrivilegeEscalationError(
      `Role ${context.role} cannot export without delegation`
    );
  }
}

export function assertCanViewAudit(context: RBACContext): void {
  const isDelegated = context.delegatedScopes.includes("AUDIT_VIEW");
  if (
    !["ADMIN", "AUDIT_LOG"].includes(context.role) &&
    !isDelegated
  ) {
    throw new PrivilegeEscalationError(
      `Role ${context.role} cannot view audit log`
    );
  }
}

// ============================================================================
// Privilege Analysis
// ============================================================================

export interface RoleCapabilities {
  role: Role;
  capabilities: {
    recordDecision: boolean;
    approveException: boolean;
    exportPack: boolean;
    viewAudit: boolean;
  };
}

export function getRoleCapabilities(role: Role): RoleCapabilities {
  const capabilities: Record<Role, RoleCapabilities["capabilities"]> = {
    ADMIN: {
      recordDecision: true,
      approveException: true,
      exportPack: true,
      viewAudit: true,
    },
    REVIEWER: {
      recordDecision: true,
      approveException: false,
      exportPack: false,
      viewAudit: false,
    },
    AUDIT_LOG: {
      recordDecision: false,
      approveException: false,
      exportPack: false,
      viewAudit: true,
    },
    OBSERVER: {
      recordDecision: false,
      approveException: false,
      exportPack: false,
      viewAudit: false,
    },
  };

  return {
    role,
    capabilities: capabilities[role],
  };
}

// ============================================================================
// MARKER
// ============================================================================

console.log("[FT_RBAC_DELEGATION_FREEZE_COMPLETE] RBAC delegation engine loaded");
