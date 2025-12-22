/**
 * PHASE P7: ENTITLEMENTS & USAGE METERING
 *
 * Plan Model - Defines pricing tiers and their limits.
 *
 * CRITICAL RULES:
 * - NO user-facing UI for plan selection
 * - Plans affect ONLY cost drivers: retention, exports, evidence pack history, shadow storage
 * - Plans NEVER affect correctness: truth computation, evidence persistence, regeneration, verification
 * - All limits are enforced silently at enforcement points (export operations)
 * - Baseline plan is always safe and truthful
 */

/**
 * Plan identifier
 */
export type PlanId = 'baseline' | 'pro' | 'enterprise';

/**
 * Entitlements for a given plan
 * 
 * These limits apply to cost drivers ONLY.
 * Correctness surface (truth, evidence, verification) is NEVER gated.
 */
export interface PlanEntitlements {
  // Plan identification
  planId: PlanId;
  
  // Retention: how long to keep data beyond baseline
  // baseline uses P1.2 default (90 days)
  // pro/enterprise extend this
  retentionDaysMax: number;
  
  // Evidence pack history: how far back evidence packs can include history
  // Limited to reduce export size and processing
  evidencePackHistoryDays: number;
  
  // Export formats: which serialization formats are available
  // Only formats that actually exist should be listed
  exportFormats: ('json' | 'zip' | 'csv')[];
  
  // Export rate limits (per day)
  // Limits are per operation, not per bytes
  maxEvidencePackExportsPerDay: number;
  maxOutputExportsPerDay: number;
  maxProcurementBundleExportsPerDay: number;
  
  // Shadow evaluation: how long to retain internal shadow evaluations
  // Limited to baseline; extended plans keep longer for diagnostics
  shadowEvalRetentionDays: number;
}

/**
 * Baseline entitlements (safe, truthful, always available)
 * 
 * Even "free" tenants get:
 * - Full truth computation and evidence generation
 * - Full evidence persistence
 * - Full regeneration verification
 * - At least one export format
 * - Some reasonable export frequency
 * - Policy drift detection
 */
export const BASELINE_ENTITLEMENTS: PlanEntitlements = {
  planId: 'baseline',
  // P1.2 default is 90 days; baseline extends this
  retentionDaysMax: 90,
  // Evidence packs include up to 30 days of history by default
  evidencePackHistoryDays: 30,
  // JSON is essential; baseline includes it
  exportFormats: ['json'],
  // Reasonable rate: 10 packs per day
  maxEvidencePackExportsPerDay: 10,
  maxOutputExportsPerDay: 20,
  maxProcurementBundleExportsPerDay: 5,
  // Shadow evaluation retention: 7 days (internal-only)
  shadowEvalRetentionDays: 7,
};

/**
 * Pro entitlements (extended limits, more formats)
 * Suitable for mid-market customers who export more frequently
 */
export const PRO_ENTITLEMENTS: PlanEntitlements = {
  planId: 'pro',
  // Extend retention to 180 days (6 months)
  retentionDaysMax: 180,
  // Include 90 days of evidence history
  evidencePackHistoryDays: 90,
  // Add ZIP for bulk export
  exportFormats: ['json', 'zip'],
  // Higher export frequency
  maxEvidencePackExportsPerDay: 50,
  maxOutputExportsPerDay: 100,
  maxProcurementBundleExportsPerDay: 20,
  // Longer shadow retention for diagnostics
  shadowEvalRetentionDays: 30,
};

/**
 * Enterprise entitlements (maximum limits, all formats)
 * Suitable for large organizations with compliance requirements
 */
export const ENTERPRISE_ENTITLEMENTS: PlanEntitlements = {
  planId: 'enterprise',
  // Maximum retention: 365 days (1 year)
  retentionDaysMax: 365,
  // Full evidence history (limited by baseline 90 days, but extended for exports)
  evidencePackHistoryDays: 365,
  // All available formats
  exportFormats: ['json', 'zip', 'csv'],
  // Very high export frequency
  maxEvidencePackExportsPerDay: 500,
  maxOutputExportsPerDay: 1000,
  maxProcurementBundleExportsPerDay: 200,
  // Long shadow retention for internal diagnostics
  shadowEvalRetentionDays: 90,
};

/**
 * All available plans
 */
export const ALL_PLANS: Record<PlanId, PlanEntitlements> = {
  baseline: BASELINE_ENTITLEMENTS,
  pro: PRO_ENTITLEMENTS,
  enterprise: ENTERPRISE_ENTITLEMENTS,
};

/**
 * Validates that entitlements are well-formed
 * (all limits are sane, no zero values, etc.)
 */
export function validatePlanEntitlements(plan: PlanEntitlements): boolean {
  if (!plan.planId || !ALL_PLANS[plan.planId]) {
    return false;
  }
  
  // Retention must be positive
  if (plan.retentionDaysMax < 1) {
    return false;
  }
  
  // Evidence history must be at least 1 day
  if (plan.evidencePackHistoryDays < 1) {
    return false;
  }
  
  // Must have at least one export format
  if (plan.exportFormats.length === 0) {
    return false;
  }
  
  // Must have at least baseline export frequency
  if (plan.maxEvidencePackExportsPerDay < 1) {
    return false;
  }
  if (plan.maxOutputExportsPerDay < 1) {
    return false;
  }
  if (plan.maxProcurementBundleExportsPerDay < 1) {
    return false;
  }
  
  // Shadow eval retention must be positive
  if (plan.shadowEvalRetentionDays < 1) {
    return false;
  }
  
  return true;
}

/**
 * Type for export operation kinds
 */
export type ExportKind =
  | 'EVIDENCE_PACK_EXPORT'
  | 'OUTPUT_EXPORT'
  | 'PROCUREMENT_BUNDLE_EXPORT';

/**
 * Get the max exports per day for a given export kind
 */
export function getMaxExportsPerDay(
  entitlements: PlanEntitlements,
  kind: ExportKind
): number {
  switch (kind) {
    case 'EVIDENCE_PACK_EXPORT':
      return entitlements.maxEvidencePackExportsPerDay;
    case 'OUTPUT_EXPORT':
      return entitlements.maxOutputExportsPerDay;
    case 'PROCUREMENT_BUNDLE_EXPORT':
      return entitlements.maxProcurementBundleExportsPerDay;
  }
}
