/**
 * PHASE 3 SOR v1.1 - Privilege Enforcement
 * Strict privilege validation for all operations
 * Requires: Jira site admin OR global admin
 * Logs: [FT_PROOF_AR_PRIV_OK] or [FT_PROOF_AR_PRIV_DENY]
 */

import { PrivilegeContext, ReviewError } from "./types";

// ============================================================================
// PRIVILEGE CONTEXT RESOLVER (STUB FOR REAL FORGE/API)
// ============================================================================

/**
 * Resolve privilege context from request
 * In real Forge app, would call Jira API to verify admin status
 */
export async function resolvePrivilegeContext(
  accountId: string
): Promise<PrivilegeContext> {
  // Stub: In production, verify against Jira API
  // For now, assume any non-null accountId is valid
  return {
    accountId,
    displayName: `User ${accountId.substring(0, 8)}`,
    isJiraSiteAdmin: false,
    isGlobalAdmin: false,
    isDenied: false,
  };
}

// ============================================================================
// PRIVILEGE VALIDATION (STRICT, FAIL-CLOSED)
// ============================================================================

/**
 * Enforce privilege requirement: Jira site admin OR global admin
 * Throws if privilege insufficient or ambiguous
 * Logs outcome to console
 */
export function enforcePrivilege(privilegeContext: PrivilegeContext): void {
  // Check for explicit denial
  if (privilegeContext.isDenied) {
    const msg = privilegeContext.denialReason || "Access denied";
    console.error(`[FT_PROOF_AR_PRIV_DENY] ${msg}`);
    throw new ReviewError(
      "PRIVILEGE_DENIED",
      `Privilege denied: ${msg}`,
      { accountId: privilegeContext.accountId, reason: msg }
    );
  }

  // Require admin privilege
  const hasAdmin = privilegeContext.isJiraSiteAdmin || privilegeContext.isGlobalAdmin;

  if (!hasAdmin) {
    console.error(
      `[FT_PROOF_AR_PRIV_DENY] ${privilegeContext.accountId} lacks admin privilege`
    );
    throw new ReviewError(
      "PRIVILEGE_DENIED",
      `User ${privilegeContext.accountId} requires Jira site admin or global admin privilege`,
      {
        accountId: privilegeContext.accountId,
        isJiraSiteAdmin: privilegeContext.isJiraSiteAdmin,
        isGlobalAdmin: privilegeContext.isGlobalAdmin,
      }
    );
  }

  // Privilege sufficient
  console.log(
    `[FT_PROOF_AR_PRIV_OK] ${privilegeContext.accountId} verified as administrator`
  );
}

/**
 * Validate privilege context is well-formed (fail-closed)
 */
export function validatePrivilegeContext(privilegeContext: PrivilegeContext): void {
  if (!privilegeContext) {
    throw new ReviewError(
      "INVALID_INPUT",
      "Privilege context required",
      { value: privilegeContext }
    );
  }

  if (!privilegeContext.accountId || typeof privilegeContext.accountId !== "string") {
    throw new ReviewError(
      "INVALID_INPUT",
      "Privilege context.accountId must be non-empty string",
      { accountId: privilegeContext.accountId }
    );
  }

  if (typeof privilegeContext.isJiraSiteAdmin !== "boolean") {
    throw new ReviewError(
      "INVALID_INPUT",
      "Privilege context.isJiraSiteAdmin must be boolean",
      { value: privilegeContext.isJiraSiteAdmin }
    );
  }

  if (typeof privilegeContext.isGlobalAdmin !== "boolean") {
    throw new ReviewError(
      "INVALID_INPUT",
      "Privilege context.isGlobalAdmin must be boolean",
      { value: privilegeContext.isGlobalAdmin }
    );
  }

  if (typeof privilegeContext.isDenied !== "boolean") {
    throw new ReviewError(
      "INVALID_INPUT",
      "Privilege context.isDenied must be boolean",
      { value: privilegeContext.isDenied }
    );
  }
}

// ============================================================================
// PRIVILEGE-GUARDED OPERATION WRAPPER
// ============================================================================

/**
 * Execute callback with privilege enforcement
 * - Validates privilege context
 * - Enforces admin requirement
 * - Logs [FT_PROOF_AR_PRIV_OK] or [FT_PROOF_AR_PRIV_DENY]
 * - Propagates callback result or throws
 */
export async function withPrivilegeCheck<T>(
  privilegeContext: PrivilegeContext,
  callback: (ctx: PrivilegeContext) => Promise<T>
): Promise<T> {
  // Validate context format
  validatePrivilegeContext(privilegeContext);

  // Enforce privilege requirement
  enforcePrivilege(privilegeContext);

  // Execute callback
  try {
    const result = await callback(privilegeContext);
    return result;
  } catch (err) {
    // Log error but don't modify privilege failure case
    if (err instanceof ReviewError) throw err;
    throw new ReviewError(
      "STORAGE_ERROR",
      `Callback failed: ${String(err)}`,
      { originalError: String(err) }
    );
  }
}

// ============================================================================
// PRIVILEGE CONTEXT BUILDER (TEST/DEMO)
// ============================================================================

/**
 * Build privilege context for testing
 */
export function buildPrivilegeContextForTest(
  override: Partial<PrivilegeContext> = {}
): PrivilegeContext {
  return {
    accountId: "test-account-123",
    displayName: "Test Admin",
    isJiraSiteAdmin: true,
    isGlobalAdmin: false,
    isDenied: false,
    ...override,
  };
}
