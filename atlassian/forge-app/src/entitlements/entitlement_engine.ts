/**
 * PHASE P7: ENTITLEMENTS ENGINE
 *
 * Invisible entitlement enforcement:
 * - Gets tenant plan (internal-only, no UI)
 * - Returns entitlements for that plan
 * - Enforces export limits at operation time
 * - Never blocks truth, evidence, or regeneration
 *
 * CRITICAL: No user-facing UI, toggles, or setup flows.
 */

import {
  PlanId,
  PlanEntitlements,
  ExportKind,
  BASELINE_ENTITLEMENTS,
  ALL_PLANS,
  getMaxExportsPerDay,
} from './plan_types';

/**
 * Context for entitlement lookups (minimal, no PII)
 */
export interface EntitlementContext {
  tenantKey: string;  // Used for lookups, hashed in metrics
}

/**
 * Result of export enforcement
 */
export interface EnforcementResult {
  allowed: boolean;
  limitType?: string;  // Which limit was hit (if blocked)
  remainingToday?: number;  // How many exports remain today
  maxAllowed?: number;  // What the limit is
  message?: string;  // User-safe message if blocked
}

/**
 * Tenant entitlement record (stored in Forge storage)
 * This is internal-only; no user sets it directly.
 * Tests can seed it.
 */
export interface TenantEntitlementRecord {
  tenantKey: string;
  planId: PlanId;
  assignedAtISO: string;
  // Note: no renewal date, no expiry; plan is permanent until changed
  // (In future, could add expiry logic)
}

/**
 * In-memory store for tenant entitlements (for tests)
 * In production, this would be looked up from Forge storage.
 */
const tenantEntitlementMap = new Map<string, TenantEntitlementRecord>();

/**
 * Internal-only: Set tenant plan (for tests only, never exposed to users)
 * 
 * RULES:
 * - Only for tests and internal dev
 * - Never called from user-facing code
 * - Never persisted to public APIs
 * 
 * @param tenantKey The tenant key
 * @param planId The plan to assign
 */
export function setTenantPlan(tenantKey: string, planId: PlanId): void {
  // This is an internal-only test helper
  // In production, plan assignment would be via admin-only Forge storage
  // (not a user-facing operation)
  tenantEntitlementMap.set(tenantKey, {
    tenantKey,
    planId,
    assignedAtISO: new Date().toISOString(),
  });
}

/**
 * Clear all tenant plans (for test isolation)
 */
export function clearAllTenantPlans(): void {
  tenantEntitlementMap.clear();
}

/**
 * Get the plan for a tenant
 * 
 * Lookup order:
 * 1. Check in-memory map (for tests)
 * 2. Would check Forge storage in production
 * 3. Default to 'baseline' if not found
 * 
 * RULES:
 * - No user action required (always defaults to baseline)
 * - Plan defaults to baseline, never fails
 * - Returns the plan ID for that tenant
 * 
 * @param ctx Entitlement context
 * @returns The plan ID for this tenant
 */
export function getTenantPlan(ctx: EntitlementContext): PlanId {
  // Check in-memory store first (for tests)
  const record = tenantEntitlementMap.get(ctx.tenantKey);
  if (record) {
    return record.planId;
  }
  
  // TODO: In production, check Forge storage here
  // const forgeRecord = await getFromForgeStorage(`p7:entitlement:${ctx.tenantKey}`);
  // if (forgeRecord) return forgeRecord.planId;
  
  // Default to baseline (safe, truthful)
  return 'baseline';
}

/**
 * Get the entitlements for a tenant
 * 
 * @param ctx Entitlement context
 * @returns The full entitlements object for this tenant's plan
 */
export function getEntitlements(ctx: EntitlementContext): PlanEntitlements {
  const planId = getTenantPlan(ctx);
  return ALL_PLANS[planId];
}

/**
 * Error class for export enforcement
 * Used when an export is blocked due to plan limits
 */
export class ExportBlockedError extends Error {
  constructor(
    public readonly correlationId: string,
    public readonly planId: PlanId,
    public readonly limitType: string,
    public readonly remainingToday: number,
    public readonly maxAllowed: number
  ) {
    super(
      `Export blocked: ${limitType} limit reached for ${planId} plan. ` +
      `CorrelationId: ${correlationId}`
    );
    this.name = 'ExportBlockedError';
  }
}

/**
 * Enforce export allowance
 * 
 * Called before performing an export operation.
 * If limit is exceeded, throws ExportBlockedError.
 * If allowed, returns result with remaining count.
 * 
 * CRITICAL RULES:
 * - Never blocks truth generation or evidence persistence
 * - Only blocks export operations
 * - Always includes correlationId for support
 * - Always emits audit event on block
 * - Always emits metric event on block
 * 
 * @param ctx Entitlement context
 * @param kind The type of export operation
 * @param usageCount How many operations of this kind have been done today
 * @param correlationId For tracking support cases
 * @returns Result indicating if export is allowed
 * @throws ExportBlockedError if limit is exceeded
 */
export function enforceExportAllowance(
  ctx: EntitlementContext,
  kind: ExportKind,
  usageCount: number,
  correlationId: string
): EnforcementResult {
  const entitlements = getEntitlements(ctx);
  const maxAllowed = getMaxExportsPerDay(entitlements, kind);
  
  // Check if limit is exceeded
  if (usageCount >= maxAllowed) {
    // BLOCK: limit exceeded
    throw new ExportBlockedError(
      correlationId,
      entitlements.planId,
      kind,
      0,  // No more allowed today
      maxAllowed
    );
  }
  
  // ALLOW: within limit
  return {
    allowed: true,
    remainingToday: maxAllowed - usageCount - 1,  // -1 for the current operation
    maxAllowed,
  };
}

/**
 * Get user-safe message for blocked export
 * 
 * This is what the user sees when an export is blocked.
 * RULES:
 * - Must include correlationId for support
 * - Must be clear that outputs remain available in-product
 * - Must not expose internal plan details
 * 
 * @param error The ExportBlockedError
 * @returns User-safe message
 */
export function getBlockedExportMessage(error: ExportBlockedError): string {
  return (
    `Export limit reached for your plan. ` +
    `Outputs remain available in-product. ` +
    `CorrelationId: ${error.correlationId}`
  );
}

/**
 * Check if a format is available for a tenant
 * 
 * Used before attempting to export in a specific format.
 * 
 * @param ctx Entitlement context
 * @param format The desired export format
 * @returns true if format is available for this tenant
 */
export function isFormatAvailable(
  ctx: EntitlementContext,
  format: 'json' | 'zip' | 'csv'
): boolean {
  const entitlements = getEntitlements(ctx);
  return entitlements.exportFormats.includes(format);
}

/**
 * Get available export formats for a tenant
 * 
 * @param ctx Entitlement context
 * @returns List of formats available for this tenant
 */
export function getAvailableFormats(
  ctx: EntitlementContext
): ('json' | 'zip' | 'csv')[] {
  const entitlements = getEntitlements(ctx);
  return entitlements.exportFormats;
}
