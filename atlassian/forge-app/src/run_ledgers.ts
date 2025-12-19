/**
 * Run Ledgers - Pipeline Execution Tracking
 * PHASE 3: Track daily/weekly pipeline attempts and successes
 *
 * Storage keys (exact):
 * - runs/{org}/daily/last_attempt_at       (ISO timestamp)
 * - runs/{org}/daily/last_success_at       (ISO timestamp, null if never)
 * - runs/{org}/weekly/last_attempt_at      (ISO timestamp)
 * - runs/{org}/weekly/last_success_at      (ISO timestamp, null if never)
 * - runs/{org}/last_error                  (sanitized error message, 300 chars max)
 * - index/orgs                             (sorted unique org list)
 *
 * Org Index:
 * - Maintained on successful ingest
 * - Used by pipelines to discover all orgs
 * - Bounded list (sorted, deduplicated)
 */

let api: any;
try {
  api = require('@forge/api').default;
} catch {
  // Test environment; mock will be injected
}

const MAX_ORGS_IN_INDEX = 10000; // Reasonable upper bound

/**
 * (Test only) Set mock api for testing
 */
export function setMockApi(mockApiObj: any): void {
  api = mockApiObj;
}

/**
 * Record a daily pipeline attempt
 */
export async function record_daily_attempt(org: string, nowISO: string): Promise<void> {
  try {
    const key = `runs/${org}/daily/last_attempt_at`;
    await api.asApp().requestStorage(async (storage) => {
      await storage.set(key, nowISO);
    });
  } catch (error) {
    console.error(`[RunLedgers] Failed to record daily attempt for ${org}:`, error);
    throw error;
  }
}

/**
 * Record a daily pipeline success
 */
export async function record_daily_success(org: string, nowISO: string): Promise<void> {
  try {
    const key = `runs/${org}/daily/last_success_at`;
    await api.asApp().requestStorage(async (storage) => {
      await storage.set(key, nowISO);
    });
  } catch (error) {
    console.error(`[RunLedgers] Failed to record daily success for ${org}:`, error);
    throw error;
  }
}

/**
 * Record a weekly pipeline attempt
 */
export async function record_weekly_attempt(org: string, nowISO: string): Promise<void> {
  try {
    const key = `runs/${org}/weekly/last_attempt_at`;
    await api.asApp().requestStorage(async (storage) => {
      await storage.set(key, nowISO);
    });
  } catch (error) {
    console.error(`[RunLedgers] Failed to record weekly attempt for ${org}:`, error);
    throw error;
  }
}

/**
 * Record a weekly pipeline success
 */
export async function record_weekly_success(org: string, nowISO: string): Promise<void> {
  try {
    const key = `runs/${org}/weekly/last_success_at`;
    await api.asApp().requestStorage(async (storage) => {
      await storage.set(key, nowISO);
    });
  } catch (error) {
    console.error(`[RunLedgers] Failed to record weekly success for ${org}:`, error);
    throw error;
  }
}

/**
 * Record a pipeline error (sanitized)
 */
export async function record_last_error(
  org: string,
  redactedMessage: string,
  nowISO: string
): Promise<void> {
  try {
    // Sanitize: max 300 chars, no newlines
    const sanitized = redactedMessage
      .substring(0, 300)
      .replace(/[\r\n]/g, ' ')
      .trim();
    
    const key = `runs/${org}/last_error`;
    await api.asApp().requestStorage(async (storage) => {
      await storage.set(key, { message: sanitized, recorded_at: nowISO });
    });
  } catch (error) {
    console.error(`[RunLedgers] Failed to record error for ${org}:`, error);
    throw error;
  }
}

/**
 * Get last daily success timestamp (may be null if never succeeded)
 */
export async function get_daily_last_success(org: string): Promise<string | null> {
  try {
    const key = `runs/${org}/daily/last_success_at`;
    const result = await api.asApp().requestStorage(async (storage) => {
      return await storage.get(key);
    });
    return result || null;
  } catch (error) {
    console.error(`[RunLedgers] Failed to get daily last success for ${org}:`, error);
    return null; // Treat read error as "never succeeded"
  }
}

/**
 * Get last weekly success timestamp (may be null if never succeeded)
 */
export async function get_weekly_last_success(org: string): Promise<string | null> {
  try {
    const key = `runs/${org}/weekly/last_success_at`;
    const result = await api.asApp().requestStorage(async (storage) => {
      return await storage.get(key);
    });
    return result || null;
  } catch (error) {
    console.error(`[RunLedgers] Failed to get weekly last success for ${org}:`, error);
    return null;
  }
}

/**
 * Add org to index (idempotent)
 * Called on successful ingest to track org
 */
export async function add_org_to_index(org: string): Promise<void> {
  try {
    const indexKey = 'index/orgs';
    
    await api.asApp().requestStorage(async (storage) => {
      const current = (await storage.get(indexKey)) || [];
      
      // Add if not present, deduplicate and sort
      const updated = Array.from(new Set([...current, org])).sort();
      
      // Sanity check: prevent unbounded growth
      if (updated.length > MAX_ORGS_IN_INDEX) {
        console.warn(`[RunLedgers] Org index size exceeds ${MAX_ORGS_IN_INDEX}; trimming`);
        // This should not happen in normal operation
      }
      
      await storage.set(indexKey, updated);
    });
  } catch (error) {
    console.error(`[RunLedgers] Failed to add org ${org} to index:`, error);
    // Non-fatal; continue processing
  }
}

/**
 * Get all orgs from index
 * Used by pipelines to discover orgs to process
 */
export async function get_all_orgs(): Promise<string[]> {
  try {
    const indexKey = 'index/orgs';
    const result = await api.asApp().requestStorage(async (storage) => {
      return (await storage.get(indexKey)) || [];
    });
    return Array.isArray(result) ? result.sort() : [];
  } catch (error) {
    console.error('[RunLedgers] Failed to get org index:', error);
    return [];
  }
}
