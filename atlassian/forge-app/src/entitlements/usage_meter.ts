/**
 * PHASE P7: USAGE METERING
 *
 * Silent, non-PII usage tracking for export operations.
 * 
 * RULES:
 * - No user action required
 * - No PII stored (only tenantToken hash)
 * - Retention-scoped (deleted per P1 policy)
 * - Tenant-scoped (no cross-tenant access)
 * - Events: EVIDENCE_PACK_EXPORT, OUTPUT_EXPORT, PROCUREMENT_BUNDLE_EXPORT
 */

import crypto from 'crypto';

/**
 * Usage event type
 */
export type UsageEventType =
  | 'EVIDENCE_PACK_EXPORT'
  | 'OUTPUT_EXPORT'
  | 'PROCUREMENT_BUNDLE_EXPORT';

/**
 * Usage event (minimal, no PII)
 */
export interface UsageEvent {
  // Temporal
  tsISO: string;  // ISO timestamp
  
  // Tenant (irreversible hash)
  tenantToken: string;  // sha256(tenantKey) for metrics, PII-free
  
  // Event
  eventType: UsageEventType;
  
  // Count (always 1 for individual export, but batches could be >1)
  count: number;
  
  // Expiry (for retention policy)
  expiresAtISO: string;
}

/**
 * Daily usage window (aggregated by day)
 */
export interface UsageWindow {
  // Day identifier
  dayISO: string;  // YYYY-MM-DD in UTC
  
  // Tenant (hashed)
  tenantToken: string;
  
  // Counts by event type
  eventCounts: {
    EVIDENCE_PACK_EXPORT: number;
    OUTPUT_EXPORT: number;
    PROCUREMENT_BUNDLE_EXPORT: number;
  };
  
  // TTL
  expiresAtISO: string;
}

/**
 * In-memory usage store (for testing)
 * In production, this would be in Forge storage.
 * 
 * Structure: usageMap[tenantToken][dayISO] = UsageWindow
 */
const usageMap = new Map<string, Map<string, UsageWindow>>();

/**
 * Hash tenant key to irreversible token
 * Replicates P3 metrics hashing
 */
function hashTenantKey(tenantKey: string): string {
  return crypto.createHash('sha256').update(tenantKey).digest('hex').substring(0, 16);
}

/**
 * Get ISO day string (YYYY-MM-DD UTC)
 */
function getISODay(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Calculate expiry date (baseline + retention days from P1.2)
 * Default is 90 days from creation
 */
function getExpiryISO(baselineRetentionDays: number = 90): string {
  const expiry = new Date();
  expiry.setUTCDate(expiry.getUTCDate() + baselineRetentionDays);
  return expiry.toISOString();
}

/**
 * Record a usage event
 * 
 * Called whenever an export operation happens.
 * RULES:
 * - No user action required
 * - Non-PII (only hashed tenantToken)
 * - Retention-scoped (auto-deleted per P1)
 * - Aggregated daily
 * 
 * @param tenantKey The tenant key
 * @param eventType The type of export
 * @param count How many (default 1)
 */
export function recordUsage(
  tenantKey: string,
  eventType: UsageEventType,
  count: number = 1
): void {
  const tenantToken = hashTenantKey(tenantKey);
  const dayISO = getISODay(new Date());
  
  // Get or create tenant's usage map
  if (!usageMap.has(tenantToken)) {
    usageMap.set(tenantToken, new Map());
  }
  
  const tenantUsage = usageMap.get(tenantToken)!;
  
  // Get or create day's window
  let window = tenantUsage.get(dayISO);
  if (!window) {
    window = {
      dayISO,
      tenantToken,
      eventCounts: {
        EVIDENCE_PACK_EXPORT: 0,
        OUTPUT_EXPORT: 0,
        PROCUREMENT_BUNDLE_EXPORT: 0,
      },
      expiresAtISO: getExpiryISO(),
    };
    tenantUsage.set(dayISO, window);
  }
  
  // Increment count
  window.eventCounts[eventType] += count;
  
  // TODO: In production, also persist to Forge storage
  // const key = `p7:usage:${tenantToken}:${dayISO}`;
  // await storage.set(key, window, { ttl: 90 days });
}

/**
 * Get usage window for a tenant on a specific day
 * 
 * Used to check current usage before allowing an export.
 * 
 * @param tenantKey The tenant key
 * @param dayISO The day (YYYY-MM-DD format)
 * @returns Usage window, or undefined if no usage recorded
 */
export function getUsageWindow(
  tenantKey: string,
  dayISO: string
): UsageWindow | undefined {
  const tenantToken = hashTenantKey(tenantKey);
  const tenantUsage = usageMap.get(tenantToken);
  
  if (!tenantUsage) {
    return undefined;
  }
  
  return tenantUsage.get(dayISO);
}

/**
 * Get today's usage for a tenant
 * 
 * Convenience method for current day.
 * 
 * @param tenantKey The tenant key
 * @returns Today's usage window, or undefined if no usage
 */
export function getTodayUsage(tenantKey: string): UsageWindow | undefined {
  const dayISO = getISODay(new Date());
  return getUsageWindow(tenantKey, dayISO);
}

/**
 * Get count of a specific event type for today
 * 
 * @param tenantKey The tenant key
 * @param eventType The event type to check
 * @returns Count of that event type today
 */
export function getTodayCount(tenantKey: string, eventType: UsageEventType): number {
  const window = getTodayUsage(tenantKey);
  if (!window) {
    return 0;
  }
  return window.eventCounts[eventType];
}

/**
 * Reset usage if new day (called at start of operations)
 * 
 * INTERNAL: This is called automatically by the enforcement layer.
 * RULES:
 * - Called once per day (idempotent)
 * - Creates new window for new day
 * - Old windows are deleted per P1 retention policy
 * 
 * @param tenantKey The tenant key
 */
export function resetUsageIfNewDay(tenantKey: string): void {
  const tenantToken = hashTenantKey(tenantKey);
  const dayISO = getISODay(new Date());
  
  if (!usageMap.has(tenantToken)) {
    return;  // No usage yet for this tenant
  }
  
  const tenantUsage = usageMap.get(tenantToken)!;
  
  // If we already have today's window, nothing to do
  if (tenantUsage.has(dayISO)) {
    return;
  }
  
  // Otherwise create a fresh window (old ones deleted by retention policy)
  const newWindow: UsageWindow = {
    dayISO,
    tenantToken,
    eventCounts: {
      EVIDENCE_PACK_EXPORT: 0,
      OUTPUT_EXPORT: 0,
      PROCUREMENT_BUNDLE_EXPORT: 0,
    },
    expiresAtISO: getExpiryISO(),
  };
  
  tenantUsage.set(dayISO, newWindow);
}

/**
 * Clear all usage (for test cleanup)
 */
export function clearAllUsage(): void {
  usageMap.clear();
}

/**
 * Get all usage for a tenant (for diagnostics, internal only)
 * 
 * INTERNAL ONLY: Never expose to users.
 * 
 * @param tenantKey The tenant key
 * @returns Map of day → UsageWindow
 */
export function getAllTenantUsage(
  tenantKey: string
): Map<string, UsageWindow> {
  const tenantToken = hashTenantKey(tenantKey);
  return usageMap.get(tenantToken) || new Map();
}
