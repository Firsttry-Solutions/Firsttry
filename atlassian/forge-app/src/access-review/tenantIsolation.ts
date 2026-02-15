/**
 * PHASE 3 v1.2 - Tenant Isolation Enforcement
 * All resolvers MUST derive siteId from Forge context ONLY
 * Input siteId parameters are rejected (tenant spoofing protection)
 */

import { ReviewError } from "./types";

// ============================================================================
// TENANT SPOOF DETECTION
// ============================================================================

/**
 * Tenant spoofing attempt: input contains malicious siteId
 */
export class TenantSpoofError extends ReviewError {
  constructor(inputSiteId: string, contextSiteId: string) {
    super(
      "TENANT_SPOOF_ATTEMPT",
      `Input siteId '${inputSiteId}' does not match context siteId '${contextSiteId}'`,
      { inputSiteId, contextSiteId }
    );
    this.name = "TenantSpoofError";
  }
}

// ============================================================================
// CONTEXT EXTRACTION (STUB - WOULD USE @forge/api IN REAL APP)
// ============================================================================

export interface ForgeContext {
  siteId: string;
  accountId: string;
  tenantId?: string;
}

/**
 * Get tenant context from Forge runtime
 * In real implementation, would call Forge API
 */
export function getForgeContext(): ForgeContext {
  // Stub: would call @forge/api context
  return {
    siteId: "forge-site-context",
    accountId: "forge-account-context",
    tenantId: "forge-tenant-context",
  };
}

// ============================================================================
// TENANT ISOLATION ENFORCEMENT
// ============================================================================

/**
 * Enforce tenant isolation: input siteId MUST NOT override context.siteId
 * 
 * If input provides siteId:
 * - Compare with context.siteId
 * - If mismatch → throw TENANT_SPOOF_ATTEMPT
 * - This prevents cross-tenant access
 * 
 * Returns: context.siteId (the canonical, trusted value)
 */
export function deriveTenantSiteId(inputSiteId: string | undefined): string {
  const context = getForgeContext();
  const contextSiteId = context.siteId;

  // If input provided siteId, validate it matches context
  if (inputSiteId !== undefined && inputSiteId !== null) {
    if (inputSiteId !== contextSiteId) {
      console.error(
        `[FT_TENANT_SPOOF_DETECTED] Attempt to override siteId: input='${inputSiteId}' vs context='${contextSiteId}'`
      );
      throw new TenantSpoofError(inputSiteId, contextSiteId);
    }
  }

  // Always use context siteId
  console.log(`[FT_TENANT_ISOLATION_ENFORCED] Using context.siteId: ${contextSiteId}`);
  return contextSiteId;
}

/**
 * Derive account ID from context (cannot be overridden)
 */
export function deriveTenantAccountId(inputAccountId: string | undefined): string {
  const context = getForgeContext();

  if (inputAccountId !== undefined && inputAccountId !== context.accountId) {
    console.error(
      `[FT_TENANT_SPOOF_DETECTED] Attempt to override accountId`
    );
    throw new TenantSpoofError(inputAccountId, context.accountId);
  }

  return context.accountId;
}

/**
 * Validate input does not contain siteId (reject it explicitly)
 * Use this when siteId is NOT expected in input at all
 */
export function rejectInputSiteId(input: Record<string, unknown>): void {
  if (input && "siteId" in input && input.siteId !== undefined) {
    console.error(
      `[FT_TENANT_SPOOF_DETECTED] Unexpected siteId in input: ${String(input.siteId)}`
    );
    throw new TenantSpoofError(String(input.siteId), getForgeContext().siteId);
  }
}

/**
 * Validate input does not contain accountId (reject it explicitly)
 */
export function rejectInputAccountId(input: Record<string, unknown>): void {
  if (input && "accountId" in input && input.accountId !== undefined) {
    console.error(
      `[FT_TENANT_SPOOF_DETECTED] Unexpected accountId in input: ${String(input.accountId)}`
    );
    throw new ReviewError(
      "INVALID_INPUT",
      "accountId parameter not allowed (derived from context)",
      { provided: String(input.accountId) }
    );
  }
}

// ============================================================================
// RESOLVER CONTEXT WRAPPER
// ============================================================================

/**
 * Wrap resolver callbacks with automatic tenant enforcement
 * Ensures all operations are tenant-isolated
 */
export async function withTenantContext<T>(
  callback: (contextSiteId: string, contextAccountId: string) => Promise<T>
): Promise<T> {
  try {
    const context = getForgeContext();
    const result = await callback(context.siteId, context.accountId);
    return result;
  } catch (err) {
    if (err instanceof ReviewError) throw err;
    throw new ReviewError(
      "STORAGE_ERROR",
      `Tenant-isolated operation failed: ${String(err)}`,
      { originalError: String(err) }
    );
  }
}

// ============================================================================
// ASSERTION UTILITIES
// ============================================================================

/**
 * Assert siteId matches context (fail-closed)
 */
export function assertSiteIdMatch(siteId: string): void {
  const context = getForgeContext();
  if (siteId !== context.siteId) {
    throw new TenantSpoofError(siteId, context.siteId);
  }
}

/**
 * Assert accountId matches context (fail-closed)
 */
export function assertAccountIdMatch(accountId: string): void {
  const context = getForgeContext();
  if (accountId !== context.accountId) {
    throw new ReviewError(
      "INVALID_INPUT",
      "accountId does not match context",
      { provided: accountId, context: context.accountId }
    );
  }
}
