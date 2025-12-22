/**
 * PHASE P7: ENTITLEMENTS & USAGE METERING
 * Public API
 */

export {
  type PlanId,
  type PlanEntitlements,
  type ExportKind,
  BASELINE_ENTITLEMENTS,
  PRO_ENTITLEMENTS,
  ENTERPRISE_ENTITLEMENTS,
  ALL_PLANS,
  validatePlanEntitlements,
  getMaxExportsPerDay,
} from './plan_types';

export {
  type EntitlementContext,
  type EnforcementResult,
  type TenantEntitlementRecord,
  ExportBlockedError,
  getTenantPlan,
  getEntitlements,
  enforceExportAllowance,
  getBlockedExportMessage,
  isFormatAvailable,
  getAvailableFormats,
  setTenantPlan,  // Internal-only (for tests)
  clearAllTenantPlans,  // Internal-only (for tests)
} from './entitlement_engine';

export {
  type UsageEventType,
  type UsageEvent,
  type UsageWindow,
  recordUsage,
  getUsageWindow,
  getTodayUsage,
  getTodayCount,
  resetUsageIfNewDay,
  clearAllUsage,  // Internal-only (for tests)
  getAllTenantUsage,  // Internal-only (for tests)
} from './usage_meter';

export {
  enforceExport,
  getExportBlockedMessage,
  handleExportBlocked,
  enforceRetentionExtension,
} from './safe_degradation';

export {
  type EntitlementAuditEvent,
  type EntitlementMetricEvent,
  type ExportBlockAuditData,
  emitEntitlementAuditEvent,
  recordEntitlementMetricEvent,
  emitExportBlockedEvents,
  emitExportAllowedEvents,
  emitRetentionTruncatedEvents,
  getExportBlockAuditData,
  emitAuditDataEvents,
} from './audit_integration';
