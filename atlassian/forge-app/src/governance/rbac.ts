/**
 * Enterprise RBAC Model for ECL-2
 * 
 * Provides role-based access control with hardcoded permission matrices.
 * No runtime editing: all role definitions and permissions are immutable.
 * 
 * FT_ECL_PHASE: ECL-2 RBAC_MODEL
 */

/**
 * Enterprise Roles (hardcoded)
 */
export enum EclRole {
  Viewer = "viewer",
  Operator = "operator",
  Approver = "approver",
  Auditor = "auditor",
  Owner = "owner"
}

/**
 * Enterprise Actions (hardcoded)
 */
export enum EclAction {
  VIEW_DASHBOARD = "view_dashboard",
  ACCEPT_DRIFT = "accept_drift",
  CLOSE_REVIEW = "close_review",
  GENERATE_EXPORT = "generate_export",
  APPROVE_EXEMPTION = "approve_exemption",
  MODIFY_POLICY = "modify_policy"
}

/**
 * Role-to-Permissions mapping (deterministic order as declared)
 * 
 * Semantics:
 * - Viewer: Read-only access to all dashboards and reports
 * - Operator: Can accept drift and close reviews
 * - Approver: Can approve exemptions
 * - Auditor: Can view audit logs and generate exports
 * - Owner: Can perform all actions including policy modifications
 */
export const ROLE_PERMISSIONS: Record<EclRole, readonly EclAction[]> = {
  [EclRole.Viewer]: [
    EclAction.VIEW_DASHBOARD
  ],
  [EclRole.Operator]: [
    EclAction.VIEW_DASHBOARD,
    EclAction.ACCEPT_DRIFT,
    EclAction.CLOSE_REVIEW
  ],
  [EclRole.Approver]: [
    EclAction.VIEW_DASHBOARD,
    EclAction.ACCEPT_DRIFT,
    EclAction.CLOSE_REVIEW,
    EclAction.APPROVE_EXEMPTION
  ],
  [EclRole.Auditor]: [
    EclAction.VIEW_DASHBOARD,
    EclAction.GENERATE_EXPORT
  ],
  [EclRole.Owner]: [
    EclAction.VIEW_DASHBOARD,
    EclAction.ACCEPT_DRIFT,
    EclAction.CLOSE_REVIEW,
    EclAction.APPROVE_EXEMPTION,
    EclAction.GENERATE_EXPORT,
    EclAction.MODIFY_POLICY
  ]
};

/**
 * Check if a role has permission for an action
 * @param role The user's role
 * @param action The action to check
 * @returns true if the role may perform the action
 */
export function hasPermission(role: EclRole, action: EclAction): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) {
    return false; // Unknown role: fail closed
  }
  return permissions.includes(action);
}

/**
 * Get display name for a role
 */
export function getRoleDisplayName(role: EclRole): string {
  switch (role) {
    case EclRole.Viewer: return "Viewer";
    case EclRole.Operator: return "Operator";
    case EclRole.Approver: return "Approver";
    case EclRole.Auditor: return "Auditor";
    case EclRole.Owner: return "Owner";
    default: return "Unknown";
  }
}

/**
 * Get display name for an action
 */
export function getActionDisplayName(action: EclAction): string {
  switch (action) {
    case EclAction.VIEW_DASHBOARD: return "View Dashboard";
    case EclAction.ACCEPT_DRIFT: return "Accept Drift";
    case EclAction.CLOSE_REVIEW: return "Close Review";
    case EclAction.GENERATE_EXPORT: return "Generate Export";
    case EclAction.APPROVE_EXEMPTION: return "Approve Exemption";
    case EclAction.MODIFY_POLICY: return "Modify Policy";
    default: return action;
  }
}

/**
 * Get all roles (for UI iteration)
 */
export function getAllRoles(): readonly EclRole[] {
  return Object.values(EclRole);
}

/**
 * Get all actions (for UI iteration)
 */
export function getAllActions(): readonly EclAction[] {
  return Object.values(EclAction);
}
