/**
 * PHASE 5 ADMIN PAGE DATA LOADER
 * 
 * Strict data loading for Admin Page.
 * 
 * Design principles:
 * 1. Load ONLY from Storage (no Jira API calls from UI render path)
 * 2. Return report + scheduler state if exists, or null states
 * 3. Validate report structure before returning
 * 4. Do NOT compute any derived metrics from report contents
 * 5. Do NOT mutate Jira state (read-only)
 */

// @ts-expect-error: @forge/api available via Forge CLI only
import api from '@forge/api';
import {
  Phase5Report,
  validatePhase5ReportStructure,
} from '../phase5_report_contract';
import {
  rejectPhase5Signals,
} from '../disclosure_hardening_gaps_a_f';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Scheduler state summary for UI display (read-only).
 * 
 * Only includes what's necessary for the "Scheduler Status" panel.
 * Does NOT include attempt counts or detailed error state (internal only).
 */
export interface SchedulerStateSummary {
  readonly last_run_at?: string; // ISO 8601
  readonly auto_12h_done?: string; // ISO 8601 when completed
  readonly auto_24h_done?: string; // ISO 8601 when completed
  readonly last_error?: {
    readonly code: string;
    readonly message: string;
    readonly at: string; // ISO 8601
  } | null;
}

/**
 * Admin page state (what the UI receives).
 */
export interface AdminPageState {
  readonly latestReport: Phase5Report | null;
  readonly scheduler: SchedulerStateSummary;
  readonly loadError?: string; // Non-scary error message for UI display
}

// ============================================================================
// STORAGE KEY CONSTANTS
// ============================================================================

/**
 * Storage keys for Phase-5 data.
 * 
 * These match scheduler_state.ts key patterns.
 */
function getPhase5ReportStorageKey(cloudId: string): string {
  return `phase5:report:latest:${cloudId}`;
}

function getSchedulerStateStorageKey(cloudId: string): string {
  return `phase5:scheduler:state:${cloudId}`;
}

// ============================================================================
// DATA LOADING FUNCTIONS
// ============================================================================

/**
 * Load the latest Phase-5 report from Storage.
 * 
 * @param cloudId - Tenant identifier
 * @returns Report if found and valid, null if not found or invalid
 */
async function loadLatestReport(cloudId: string): Promise<Phase5Report | null> {
  try {
    const key = getPhase5ReportStorageKey(cloudId);
    
    const reportData = await api.asApp().requestStorage(async (storage) => {
      return await storage.get(key);
    });

    if (!reportData) {
      return null;
    }

    // Parse from storage (if stored as JSON string)
    const report = typeof reportData === 'string' ? JSON.parse(reportData) : reportData;

    // Validate structure before returning
    try {
      validatePhase5ReportStructure(report);
    } catch (e) {
      console.error('[AdminPageLoader] Report validation failed:', e);
      return null;
    }

    // Reject Phase-5 signals (safety check)
    try {
      rejectPhase5Signals(report, 'Admin page report load');
    } catch (e) {
      console.error('[AdminPageLoader] Phase-5 signal rejection:', e);
      return null;
    }

    return report;
  } catch (error) {
    console.error('[AdminPageLoader] Error loading latest report:', error);
    return null;
  }
}

/**
 * Load scheduler state summary.
 * 
 * @param cloudId - Tenant identifier
 * @returns Scheduler state (partial object with only UI-relevant fields)
 */
async function loadSchedulerStateSummary(cloudId: string): Promise<SchedulerStateSummary> {
  try {
    const key = getSchedulerStateStorageKey(cloudId);
    
    const stateData = await api.asApp().requestStorage(async (storage) => {
      return await storage.get(key);
    });

    if (!stateData) {
      return {};
    }

    // Parse from storage (if stored as JSON string)
    const state = typeof stateData === 'string' ? JSON.parse(stateData) : stateData;

    // Extract only UI-relevant fields
    const summaryObj: Record<string, any> = {};

    if (state.last_run_at) {
      summaryObj.last_run_at = state.last_run_at;
    }

    if (state.auto_12h_generated_at) {
      summaryObj.auto_12h_done = state.auto_12h_generated_at;
    }

    if (state.auto_24h_generated_at) {
      summaryObj.auto_24h_done = state.auto_24h_generated_at;
    }

    if (state.last_error && typeof state.last_error === 'object') {
      // Extract error summary (avoid exposing internal state)
      summaryObj.last_error = {
        code: state.last_error.code || 'UNKNOWN_ERROR',
        message: state.last_error.message || 'An error occurred',
        at: state.last_error.timestamp || new Date().toISOString(),
      };
    }

    return summaryObj as SchedulerStateSummary;
  } catch (error) {
    console.error('[AdminPageLoader] Error loading scheduler state:', error);
    return {};
  }
}

// ============================================================================
// MAIN LOADER FUNCTION
// ============================================================================

/**
 * Load admin page state.
 * 
 * This is the ONLY data loading function for the admin page.
 * It returns:
 * - Latest report (if exists and valid)
 * - Scheduler state summary (always present, may be empty)
 * - Load error (if applicable, non-scary message)
 * 
 * @param cloudId - Tenant identifier (from Forge context)
 * @returns AdminPageState
 */
export async function loadAdminPageState(cloudId: string): Promise<AdminPageState> {
  // Validate cloudId
  if (!cloudId || typeof cloudId !== 'string' || cloudId.trim() === '') {
    return {
      latestReport: null,
      scheduler: {},
      loadError: 'Tenant context unavailable. Please try again.',
    };
  }

  try {
    // Load report and scheduler state in parallel
    const [report, scheduler] = await Promise.all([
      loadLatestReport(cloudId),
      loadSchedulerStateSummary(cloudId),
    ]);

    return {
      latestReport: report,
      scheduler,
    };
  } catch (error) {
    console.error('[AdminPageLoader] Unexpected error loading admin page state:', error);
    return {
      latestReport: null,
      scheduler: {},
      loadError: 'Unable to load data. Please refresh or contact support.',
    };
  }
}

/**
 * Save a Phase-5 report to Storage.
 * 
 * This is called ONLY after successful generation.
 * 
 * @param cloudId - Tenant identifier
 * @param report - Generated Phase-5 report (already validated)
 */
export async function saveLatestReport(cloudId: string, report: Phase5Report): Promise<void> {
  try {
    const key = getPhase5ReportStorageKey(cloudId);
    
    await api.asApp().requestStorage(async (storage) => {
      // Store as JSON string with 90-day TTL
      await storage.set(key, JSON.stringify(report), { ttl: 7776000 });
    });
  } catch (error) {
    console.error('[AdminPageLoader] Error saving report:', error);
    throw error;
  }
}
