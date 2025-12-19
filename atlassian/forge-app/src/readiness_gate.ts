/**
 * Readiness Gate - First Report Eligibility
 * PHASE 3: Determine if org is ready for first report generation
 *
 * Status enum:
 * - WAITING_FOR_DATA_WINDOW: Not yet eligible (time + event checks failed)
 * - READY_BY_TIME_WINDOW: Eligible via time window (12h since install)
 * - READY_BY_MIN_EVENTS: Eligible via event count (>=10)
 * - READY_BY_MANUAL_OVERRIDE: Eligible via manual flag (Phase 6)
 * - BLOCKED_MISSING_INSTALL_AT: Cannot determine time window (no install_at)
 *
 * Eligibility rules (ANY true = eligible):
 * a) install_at exists AND (now - install_at) >= 12 hours
 * b) event_count >= 10
 * c) manual override flag is set
 *
 * Storage keys:
 * - report/{org}/first_ready_status
 * - report/{org}/first_ready_reason
 * - report/{org}/first_ready_checked_at
 */

import { REPORT_FIRST_DELAY_HOURS, MIN_EVENTS_FOR_FIRST_REPORT } from './config/constants';

let api: any;
try {
  api = require('@forge/api').default;
} catch {
  // Test environment
}

/**
 * (Test only) Set mock api for testing
 */
export function setMockApi(mockApiObj: any): void {
  api = mockApiObj;
}

export enum ReadinessStatus {
  WAITING_FOR_DATA_WINDOW = 'WAITING_FOR_DATA_WINDOW',
  READY_BY_TIME_WINDOW = 'READY_BY_TIME_WINDOW',
  READY_BY_MIN_EVENTS = 'READY_BY_MIN_EVENTS',
  READY_BY_MANUAL_OVERRIDE = 'READY_BY_MANUAL_OVERRIDE',
  BLOCKED_MISSING_INSTALL_AT = 'BLOCKED_MISSING_INSTALL_AT',
}

/**
 * Check if org is ready for first report generation
 * Returns status and human-readable reason
 */
export async function evaluate_readiness(
  org: string,
  nowISO: string
): Promise<{ status: ReadinessStatus; reason: string }> {
  try {
    const now = new Date(nowISO);

    // Check 1: Manual override (Phase 6; key may not exist yet)
    const manualOverride = await get_manual_override_flag(org);
    if (manualOverride) {
      return {
        status: ReadinessStatus.READY_BY_MANUAL_OVERRIDE,
        reason: 'Manual override flag is set',
      };
    }

    // Check 2: Event count (from latest daily aggregate)
    const eventCount = await get_event_count_for_org(org);
    if (eventCount >= MIN_EVENTS_FOR_FIRST_REPORT) {
      return {
        status: ReadinessStatus.READY_BY_MIN_EVENTS,
        reason: `Event count (${eventCount}) meets minimum (${MIN_EVENTS_FOR_FIRST_REPORT})`,
      };
    }

    // Check 3: Time window (install_at + 12 hours)
    const installAt = await get_install_at(org);
    if (!installAt) {
      return {
        status: ReadinessStatus.BLOCKED_MISSING_INSTALL_AT,
        reason: 'Cannot determine install timestamp; missing install_at (Phase 6 responsibility)',
      };
    }

    const installDate = new Date(installAt);
    const elapsedMS = now.getTime() - installDate.getTime();
    const elapsedHours = elapsedMS / (1000 * 60 * 60);

    if (elapsedHours >= REPORT_FIRST_DELAY_HOURS) {
      return {
        status: ReadinessStatus.READY_BY_TIME_WINDOW,
        reason: `${REPORT_FIRST_DELAY_HOURS} hours have elapsed since install`,
      };
    }

    return {
      status: ReadinessStatus.WAITING_FOR_DATA_WINDOW,
      reason: `Waiting for data window: ${Math.round(elapsedHours)} hours elapsed (need ${REPORT_FIRST_DELAY_HOURS}), events=${eventCount} (need ${MIN_EVENTS_FOR_FIRST_REPORT})`,
    };
  } catch (error) {
    console.error(`[ReadinessGate] Error evaluating readiness for ${org}:`, error);
    return {
      status: ReadinessStatus.BLOCKED_MISSING_INSTALL_AT,
      reason: `Error evaluating readiness: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Write readiness status to storage
 */
export async function write_readiness_status(
  org: string,
  status: ReadinessStatus,
  reason: string,
  nowISO: string
): Promise<void> {
  try {
    await api.asApp().requestStorage(async (storage) => {
      await storage.set(`report/${org}/first_ready_status`, status);
      await storage.set(`report/${org}/first_ready_reason`, reason);
      await storage.set(`report/${org}/first_ready_checked_at`, nowISO);
    });
  } catch (error) {
    console.error(`[ReadinessGate] Failed to write readiness status for ${org}:`, error);
    throw error;
  }
}

/**
 * Get install_at timestamp (may be missing in Phase 3)
 */
async function get_install_at(org: string): Promise<string | null> {
  try {
    const result = await api.asApp().requestStorage(async (storage) => {
      return await storage.get(`coverage/${org}/install_at`);
    });
    return result || null;
  } catch {
    return null;
  }
}

/**
 * Get event count for org (from latest daily aggregate)
 */
async function get_event_count_for_org(org: string): Promise<number> {
  try {
    // Get the latest daily aggregate (most recent date)
    // For now, return 0 if we can't determine it
    // In a real system, we'd scan aggregation keys or maintain a counter

    // Fallback: try to get from a summary key if it exists
    const countKey = `coverage/${org}/total_events_counted`;
    const result = await api.asApp().requestStorage(async (storage) => {
      return await storage.get(countKey);
    });
    return typeof result === 'number' ? result : 0;
  } catch {
    return 0;
  }
}

/**
 * Get manual override flag (Phase 6 sets this)
 */
async function get_manual_override_flag(org: string): Promise<boolean> {
  try {
    const result = await api.asApp().requestStorage(async (storage) => {
      return await storage.get(`report/${org}/manual_override`);
    });
    return result === true;
  } catch {
    return false;
  }
}
