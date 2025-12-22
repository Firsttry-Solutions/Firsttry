/**
 * P7 STEP 5: Audit & Metrics Integration
 *
 * Emits ENTITLEMENT_ENFORCED audit events and metric events when:
 * - Export is blocked (limit exceeded)
 * - Export is allowed but near limit
 * - Retention is truncated (plan limit)
 *
 * All events use PII-free tenant tokens (sha256 hash).
 * CorrelationId enables support tracking and debugging.
 */

import { emitAuditEvent } from './audit_events';
import { recordMetric } from './metrics';

/**
 * Audit Event: ENTITLEMENT_ENFORCED
 * Emitted when entitlement decision is made.
 */
export interface EntitlementAuditEvent {
  eventType: 'ENTITLEMENT_ENFORCED';
  outcome: 'BLOCKED' | 'ALLOWED' | 'TRUNCATED';
  planId: 'baseline' | 'pro' | 'enterprise';
  limitType: 'EVIDENCE_PACK_EXPORT' | 'OUTPUT_EXPORT' | 'PROCUREMENT_BUNDLE_EXPORT' | 'RETENTION_EXTENSION';
  tenantToken: string; // sha256 hash, no PII
  usageToday: number;
  limit: number;
  correlationId: string;
  remainingToday?: number;
  requestedValue?: number;
  allowedValue?: number;
}

/**
 * Metric Event: Entitlement enforcement outcome
 * Tracks aggregate metrics for dashboards/alerts.
 */
export interface EntitlementMetricEvent {
  outcome: 'BLOCKED' | 'ALLOWED' | 'TRUNCATED';
  limitType: 'EVIDENCE_PACK_EXPORT' | 'OUTPUT_EXPORT' | 'PROCUREMENT_BUNDLE_EXPORT' | 'RETENTION_EXTENSION';
  planId: 'baseline' | 'pro' | 'enterprise';
  flags: string[]; // 'PLAN_LIMIT', 'NEAR_LIMIT', 'CUSTOM_LIMIT'
  correlationId: string;
  tenantToken: string; // PII-free hashed token
}

/**
 * Internal storage for audit event data during blocking decision.
 * Allows caller to emit events after confirming the operation should be blocked.
 */
export interface ExportBlockAuditData {
  auditEvent: EntitlementAuditEvent;
  metricEvent: EntitlementMetricEvent;
}

/**
 * Emit ENTITLEMENT_ENFORCED audit event when export is blocked.
 *
 * @param event - Audit event to emit
 * @returns true if emitted successfully (for chaining)
 */
export function emitEntitlementAuditEvent(event: EntitlementAuditEvent): boolean {
  try {
    // P2 integration: emit to audit events log
    emitAuditEvent({
      eventType: event.eventType,
      outcome: event.outcome,
      data: {
        planId: event.planId,
        limitType: event.limitType,
        tenantToken: event.tenantToken,
        usageToday: event.usageToday,
        limit: event.limit,
        remainingToday: event.remainingToday,
        requestedValue: event.requestedValue,
        allowedValue: event.allowedValue,
        correlationId: event.correlationId,
      },
    });
    return true;
  } catch (error) {
    // Fail-open: audit failure should not prevent business operation
    // Log but don't throw
    console.error('[P7 Audit] Failed to emit entitlement event:', error);
    return false;
  }
}

/**
 * Record metric event for entitlement enforcement.
 * Aggregated metrics for monitoring and alerts.
 *
 * @param event - Metric event to record
 * @returns true if recorded successfully
 */
export function recordEntitlementMetricEvent(event: EntitlementMetricEvent): boolean {
  try {
    // P3 integration: record to metrics system
    recordMetric({
      eventType: 'ENTITLEMENT_ENFORCED',
      outcome: event.outcome,
      dimensions: {
        limitType: event.limitType,
        planId: event.planId,
      },
      flags: event.flags,
      metadata: {
        correlationId: event.correlationId,
        tenantToken: event.tenantToken,
      },
    });
    return true;
  } catch (error) {
    // Fail-open: metric failure should not prevent business operation
    console.error('[P7 Metrics] Failed to record entitlement metric:', error);
    return false;
  }
}

/**
 * Emit both audit and metric events for an export block.
 * Called when export is blocked due to plan limit.
 *
 * @param tenantToken - PII-free hashed tenant token
 * @param planId - Tenant's plan
 * @param limitType - What limit was exceeded
 * @param usageToday - How many used today
 * @param limit - What the limit is
 * @param correlationId - Support ticket reference
 * @returns true if both events emitted successfully
 */
export function emitExportBlockedEvents(
  tenantToken: string,
  planId: 'baseline' | 'pro' | 'enterprise',
  limitType: 'EVIDENCE_PACK_EXPORT' | 'OUTPUT_EXPORT' | 'PROCUREMENT_BUNDLE_EXPORT',
  usageToday: number,
  limit: number,
  correlationId: string,
): boolean {
  const auditEvent: EntitlementAuditEvent = {
    eventType: 'ENTITLEMENT_ENFORCED',
    outcome: 'BLOCKED',
    planId,
    limitType,
    tenantToken,
    usageToday,
    limit,
    correlationId,
    remainingToday: 0,
  };

  const metricEvent: EntitlementMetricEvent = {
    outcome: 'BLOCKED',
    limitType,
    planId,
    flags: ['PLAN_LIMIT'],
    correlationId,
    tenantToken,
  };

  const auditOk = emitEntitlementAuditEvent(auditEvent);
  const metricOk = recordEntitlementMetricEvent(metricEvent);

  // Both should succeed, but fail-open if one fails
  return auditOk || metricOk;
}

/**
 * Emit events when export is allowed (near limit).
 * Used for alerting when tenant is close to their daily cap.
 *
 * @param tenantToken - PII-free hashed tenant token
 * @param planId - Tenant's plan
 * @param limitType - What type of export
 * @param usageToday - How many used today
 * @param limit - What the limit is
 * @param correlationId - Request ID
 * @returns true if events emitted successfully
 */
export function emitExportAllowedEvents(
  tenantToken: string,
  planId: 'baseline' | 'pro' | 'enterprise',
  limitType: 'EVIDENCE_PACK_EXPORT' | 'OUTPUT_EXPORT' | 'PROCUREMENT_BUNDLE_EXPORT',
  usageToday: number,
  limit: number,
  correlationId: string,
): boolean {
  const auditEvent: EntitlementAuditEvent = {
    eventType: 'ENTITLEMENT_ENFORCED',
    outcome: 'ALLOWED',
    planId,
    limitType,
    tenantToken,
    usageToday,
    limit,
    correlationId,
    remainingToday: Math.max(0, limit - usageToday),
  };

  // Only emit metric if approaching limit (>80%)
  const nearLimit = usageToday / limit > 0.8;
  if (nearLimit) {
    const metricEvent: EntitlementMetricEvent = {
      outcome: 'ALLOWED',
      limitType,
      planId,
      flags: ['NEAR_LIMIT'],
      correlationId,
      tenantToken,
    };

    recordEntitlementMetricEvent(metricEvent);
  }

  // Audit always, metric only if near limit
  return emitEntitlementAuditEvent(auditEvent);
}

/**
 * Emit event when retention is truncated due to plan limit.
 * Caller includes truncation disclosure in exported evidence pack.
 *
 * @param tenantToken - PII-free hashed tenant token
 * @param planId - Tenant's plan
 * @param requestedDays - What retention was requested
 * @param allowedDays - What we can give within plan limit
 * @param correlationId - Request ID
 * @returns true if events emitted successfully
 */
export function emitRetentionTruncatedEvents(
  tenantToken: string,
  planId: 'baseline' | 'pro' | 'enterprise',
  requestedDays: number,
  allowedDays: number,
  correlationId: string,
): boolean {
  const auditEvent: EntitlementAuditEvent = {
    eventType: 'ENTITLEMENT_ENFORCED',
    outcome: 'TRUNCATED',
    planId,
    limitType: 'RETENTION_EXTENSION',
    tenantToken,
    usageToday: 0, // Not applicable for retention
    limit: allowedDays,
    correlationId,
    requestedValue: requestedDays,
    allowedValue: allowedDays,
  };

  const metricEvent: EntitlementMetricEvent = {
    outcome: 'TRUNCATED',
    limitType: 'RETENTION_EXTENSION',
    planId,
    flags: ['PLAN_LIMIT'],
    correlationId,
    tenantToken,
  };

  const auditOk = emitEntitlementAuditEvent(auditEvent);
  const metricOk = recordEntitlementMetricEvent(metricEvent);

  return auditOk || metricOk;
}

/**
 * Get audit event data for an export block (for caller to emit themselves).
 * Useful when caller wants to emit audit after all validation is complete.
 *
 * @param tenantToken - PII-free hashed tenant token
 * @param planId - Tenant's plan
 * @param limitType - What limit was exceeded
 * @param usageToday - How many used today
 * @param limit - What the limit is
 * @param correlationId - Support ticket reference
 * @returns Audit and metric event data
 */
export function getExportBlockAuditData(
  tenantToken: string,
  planId: 'baseline' | 'pro' | 'enterprise',
  limitType: 'EVIDENCE_PACK_EXPORT' | 'OUTPUT_EXPORT' | 'PROCUREMENT_BUNDLE_EXPORT',
  usageToday: number,
  limit: number,
  correlationId: string,
): ExportBlockAuditData {
  return {
    auditEvent: {
      eventType: 'ENTITLEMENT_ENFORCED',
      outcome: 'BLOCKED',
      planId,
      limitType,
      tenantToken,
      usageToday,
      limit,
      correlationId,
      remainingToday: 0,
    },
    metricEvent: {
      outcome: 'BLOCKED',
      limitType,
      planId,
      flags: ['PLAN_LIMIT'],
      correlationId,
      tenantToken,
    },
  };
}

/**
 * Emit both audit and metric events with data.
 * Convenience for emitting pre-generated event data.
 *
 * @param data - Audit and metric event data
 * @returns true if both events emitted successfully
 */
export function emitAuditDataEvents(data: ExportBlockAuditData): boolean {
  const auditOk = emitEntitlementAuditEvent(data.auditEvent);
  const metricOk = recordEntitlementMetricEvent(data.metricEvent);
  return auditOk || metricOk;
}
