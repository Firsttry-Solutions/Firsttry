/**
 * PHASE P7.3: SAFE DEGRADATION
 *
 * Export enforcement layer.
 * 
 * Called at every export point:
 * - Before exporting evidence packs
 * - Before exporting outputs
 * - Before exporting procurement bundles
 * - Before storing extended retention data
 * 
 * RULES:
 * - Block only EXPORT operations, never truth/evidence/regeneration
 * - Always include correlationId
 * - Always emit audit event on block
 * - Always emit metric event on block
 * - Never silent degradation
 */

import { CorrelationId } from '../ops/trace';
import {
  EntitlementContext,
  ExportBlockedError,
  enforceExportAllowance,
  getBlockedExportMessage,
  getEntitlements,
} from './entitlement_engine';
import { recordUsage, getTodayCount, resetUsageIfNewDay } from './usage_meter';
import { ExportKind } from './plan_types';

/**
 * Enforce export operation
 * 
 * Called before ANY export operation (evidence pack, output, procurement bundle).
 * 
 * CRITICAL RULES:
 * - Never blocks truth generation
 * - Never blocks evidence persistence
 * - Never blocks regeneration verification
 * - Only blocks EXPORT operations
 * - Always fails closed with explicit error
 * - Always includes correlationId
 * 
 * If allowed:
 * - Records usage immediately
 * - Returns success indicator
 * 
 * If blocked:
 * - Throws ExportBlockedError
 * - Error includes correlationId
 * - Caller must emit audit + metric events
 * 
 * @param ctx Entitlement context
 * @param kind Type of export (EVIDENCE_PACK_EXPORT, OUTPUT_EXPORT, etc.)
 * @param correlationId For tracking in support
 * @throws ExportBlockedError if limit exceeded
 * @returns Result with remaining count
 */
export function enforceExport(
  ctx: EntitlementContext,
  kind: ExportKind,
  correlationId: CorrelationId
): {
  allowed: true;
  remainingToday: number;
} {
  // Reset usage counter if new day
  resetUsageIfNewDay(ctx.tenantKey);
  
  // Get current usage
  const todayCount = getTodayCount(ctx.tenantKey, kind);
  
  // Enforce limit (throws if exceeded)
  const result = enforceExportAllowance(ctx, kind, todayCount, correlationId);
  
  // Record this export
  recordUsage(ctx.tenantKey, kind, 1);
  
  return {
    allowed: true,
    remainingToday: result.remainingToday || 0,
  };
}

/**
 * Get user-safe message for blocked export
 * 
 * Called when export is blocked due to plan limits.
 * RULES:
 * - Must include correlationId
 * - Must mention that outputs remain in-product
 * - Must NOT expose internal plan details
 * 
 * @param error The ExportBlockedError
 * @returns User-safe message
 */
export function getExportBlockedMessage(error: ExportBlockedError): string {
  return getBlockedExportMessage(error);
}

/**
 * Handle export blocked error
 * 
 * This is what the caller should do when enforceExport throws.
 * RULES:
 * - Always emit audit event (ENTITLEMENT_ENFORCED)
 * - Always emit metric event (outcome=BLOCKED, flags=[PLAN_LIMIT])
 * - Always log with correlationId
 * - Return error to caller with user-safe message
 * 
 * This function handles the "glue" between entitlements and existing
 * audit/metrics infrastructure.
 * 
 * @param error The ExportBlockedError
 * @param ctx The context
 * @returns Object with message and event data for caller to emit
 */
export function handleExportBlocked(
  error: ExportBlockedError,
  ctx: EntitlementContext
): {
  userMessage: string;
  auditEventData: {
    eventType: string;
    outcome: string;
    limitType: string;
    planId: string;
    correlationId: string;
  };
  metricEventData: {
    outcome: string;
    flags: string[];
    correlationId: string;
    limitType: string;
  };
} {
  return {
    userMessage: getExportBlockedMessage(error),
    auditEventData: {
      eventType: 'ENTITLEMENT_ENFORCED',
      outcome: 'BLOCKED',
      limitType: error.limitType,
      planId: error.planId,
      correlationId: error.correlationId,
    },
    metricEventData: {
      outcome: 'BLOCKED',
      flags: ['PLAN_LIMIT'],
      correlationId: error.correlationId,
      limitType: error.limitType,
    },
  };
}

/**
 * Enforce retention extension
 * 
 * When a tenant tries to extend data retention beyond baseline,
 * check if their plan allows it.
 * 
 * RULES:
 * - Baseline always gets 90 days minimum
 * - Extended plans can extend beyond 90
 * - Limits are enforced per PlanEntitlements.retentionDaysMax
 * - Never shrink baseline retention
 * 
 * @param ctx Entitlement context
 * @param requestedRetentionDays How long the tenant wants to keep data
 * @returns Object with allowed days and any truncation info
 */
export function enforceRetentionExtension(
  ctx: EntitlementContext,
  requestedRetentionDays: number
): {
  allowedDays: number;
  isTruncated: boolean;
  reason?: string;
} {
  const entitlements = getEntitlements(ctx);
  
  const maxAllowed = entitlements.retentionDaysMax;
  const isExtendedRequest = requestedRetentionDays > 90;  // 90 is baseline
  
  if (isExtendedRequest && requestedRetentionDays > maxAllowed) {
    // Request exceeds plan limit; truncate to max
    return {
      allowedDays: maxAllowed,
      isTruncated: true,
      reason: `Plan limit (${entitlements.planId})`,
    };
  }
  
  // Within limit (or is baseline)
  return {
    allowedDays: requestedRetentionDays,
    isTruncated: false,
  };
}
