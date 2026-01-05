/**
 * Generate Trust Snapshot from Phase 1-4 Stored Data
 * 
 * Rules:
 * - NO Jira API calls (read only from stored snapshots)
 * - Phase 1-4 data aggregation only
 * - Completeness determined by which phases have stored snapshots
 * - Versions and environment from app constants
 */

import { storage } from '@forge/api';
import { TrustSnapshot } from './types';
import { APP_VERSION, APP_ENVIRONMENT } from '../constants';
import { getTimeline } from '../phase4/timeline';

interface Phase1Snapshot {
  lastSuccessAt?: string;
  lastAttemptAt?: string;
  [key: string]: any;
}

interface Phase2Snapshot {
  snapshotAtISO?: string;
  [key: string]: any;
}

interface Phase3Snapshot {
  snapshotAtISO?: string;
  [key: string]: any;
}

export async function generateTrustSnapshot(cloudId: string): Promise<TrustSnapshot> {
  const issues: { source: string; reason: string; errorCode: string }[] = [];
  
  try {
    // Load Phase 1 snapshot
    const phase1Key = `governance:status:snapshot:${cloudId}`;
    const phase1Snapshot = (await storage.get(phase1Key)) as Phase1Snapshot | null;

    // Load Phase 2 snapshot (config visibility)
    const phase2Key = `config_visibility:snapshot:${cloudId}`;
    const phase2Snapshot = (await storage.get(phase2Key)) as Phase2Snapshot | null;

    // Load Phase 3 snapshot (perf signals)
    const phase3Key = `perf_signals:snapshot:${cloudId}`;
    const phase3Snapshot = (await storage.get(phase3Key)) as Phase3Snapshot | null;

    // Load Phase 4 timeline (append-only)
    let phase4Timeline: any = null;
    try {
      phase4Timeline = await getTimeline(cloudId);
    } catch {
      // Phase 4 may not be available yet
    }

    // Track which phases are present
    const phasesPresent: string[] = [];
    if (phase1Snapshot) phasesPresent.push('phase1');
    if (phase2Snapshot) phasesPresent.push('phase2');
    if (phase3Snapshot) phasesPresent.push('phase3');
    if (phase4Timeline) phasesPresent.push('phase4');

    // Add issues for missing phases
    if (!phase1Snapshot) {
      issues.push({
        source: 'phase1',
        reason: 'Latest snapshot not available.',
        errorCode: 'MISSING_PHASE_SNAPSHOT',
      });
    }
    if (!phase2Snapshot) {
      issues.push({
        source: 'phase2',
        reason: 'Latest snapshot not available.',
        errorCode: 'MISSING_PHASE_SNAPSHOT',
      });
    }
    if (!phase3Snapshot) {
      issues.push({
        source: 'phase3',
        reason: 'Latest snapshot not available.',
        errorCode: 'MISSING_PHASE_SNAPSHOT',
      });
    }
    if (!phase4Timeline) {
      issues.push({
        source: 'phase4',
        reason: 'Latest snapshot not available.',
        errorCode: 'MISSING_PHASE_SNAPSHOT',
      });
    }

    // Determine completeness
    const completeness = phasesPresent.length === 4 ? 'COMPLETE' : phasesPresent.length > 0 ? 'PARTIAL' : 'EMPTY';

    // Derive operational state from Phase 1
    let operationalStatus: 'RUNNING' | 'DEGRADED' | 'NOT_RUNNING' = 'NOT_RUNNING';
    let lastSuccessfulRunAtISO: string | null = null;
    let consecutiveDaysOperational: number | null = null;

    if (phase1Snapshot?.lastSuccessAt) {
      operationalStatus = 'RUNNING';
      lastSuccessfulRunAtISO = phase1Snapshot.lastSuccessAt;
      // Calculate consecutive days (simple heuristic: assume running if not degraded)
      const successDate = new Date(phase1Snapshot.lastSuccessAt);
      const nowDate = new Date();
      const daysDiff = Math.floor((nowDate.getTime() - successDate.getTime()) / (1000 * 60 * 60 * 24));
      consecutiveDaysOperational = Math.max(0, daysDiff);
    }

    // Monitoring continuity from Phase 1
    const lastCheckAt = phase1Snapshot?.lastAttemptAt || null;

    // Configuration risk from Phase 2
    const metricsIncluded = phase2Snapshot ? Object.keys(phase2Snapshot).filter(k => k !== 'snapshotAtISO') : [];
    const riskBand = metricsIncluded.length > 0 ? 'MEDIUM' : 'HIGH';

    // Change summary from Phase 4
    let eventCount = 0;
    let categoriesPresent: string[] = [];
    let lastChangeAtISO: string | null = null;

    if (phase4Timeline && Array.isArray(phase4Timeline.events)) {
      eventCount = phase4Timeline.events.length;
      categoriesPresent = Array.from(new Set(phase4Timeline.events.map((e: any) => e.category)));
      if (phase4Timeline.events.length > 0) {
        lastChangeAtISO = phase4Timeline.events[0].timestamp;
      }
    }

    // Build snapshot
    const now = new Date();
    const snapshot: TrustSnapshot = {
      generatedAtISO: now.toISOString(),
      window: 'point-in-time',

      operationalState: {
        status: operationalStatus,
        lastSuccessfulRunAtISO,
        consecutiveDaysOperational,
      },

      monitoringContinuity: {
        schedulerActive: true,
        lastRunAtISO: lastCheckAt,
        dataCompleteness: completeness,
      },

      configurationRiskSummary: {
        riskBand,
        metricsIncluded,
        evaluatedAtISO: phase2Snapshot?.snapshotAtISO || null,
      },

      changeSummary: {
        window: 'last-30d',
        eventCount,
        categoriesPresent,
        lastChangeAtISO,
      },

      appBehaviorGuarantees: {
        readOnly: true,
        noJiraWrites: true,
        noConfigChanges: true,
        noEnforcement: true,
      },

      versioning: {
        appVersion: APP_VERSION,
        environment: (APP_ENVIRONMENT as 'production' | 'staging' | 'development') || 'production',
        deployedAtISO: null,
      },

      completeness,
      issues,
    };

    return snapshot;
  } catch (error) {
    // If any error in generation, return EMPTY snapshot with issue
    const now = new Date();
    return {
      generatedAtISO: now.toISOString(),
      window: 'point-in-time',
      operationalState: {
        status: 'NOT_RUNNING',
        lastSuccessfulRunAtISO: null,
        consecutiveDaysOperational: null,
      },
      monitoringContinuity: {
        schedulerActive: false,
        lastRunAtISO: null,
        dataCompleteness: 'EMPTY',
      },
      configurationRiskSummary: {
        riskBand: 'HIGH',
        metricsIncluded: [],
        evaluatedAtISO: null,
      },
      changeSummary: {
        window: 'last-30d',
        eventCount: 0,
        categoriesPresent: [],
        lastChangeAtISO: null,
      },
      appBehaviorGuarantees: {
        readOnly: true,
        noJiraWrites: true,
        noConfigChanges: true,
        noEnforcement: true,
      },
      versioning: {
        appVersion: APP_VERSION,
        environment: (APP_ENVIRONMENT as 'production' | 'staging' | 'development') || 'production',
        deployedAtISO: null,
      },
      completeness: 'EMPTY',
      issues: [
        {
          source: 'snapshot_generation',
          reason: `Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          errorCode: 'GENERATION_ERROR',
        },
      ],
    };
  }
}
