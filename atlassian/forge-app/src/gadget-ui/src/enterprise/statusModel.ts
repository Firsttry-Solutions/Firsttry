/**
 * Normalized Status Model for Enterprise Dashboard
 *
 * All system states map to one of 5 severity levels:
 * OK | WARNING | DEGRADED | ERROR | UNKNOWN
 *
 * Each includes: label, icon, impact summary, and recommended action.
 */

export type Severity = 'OK' | 'WARNING' | 'DEGRADED' | 'ERROR' | 'UNKNOWN';

export interface NormalizedStatus {
  severity: Severity;
  label: string;
  reasonCode?: string;
  impact: string;
  action: string;
}

export const severityConfig: Record<Severity, { icon: string; bgColor: string; textColor: string }> = {
  OK: {
    icon: '✅',
    bgColor: '#216e4e',
    textColor: '#ffffff',
  },
  WARNING: {
    icon: '⚠️',
    bgColor: '#974f0c',
    textColor: '#ffffff',
  },
  DEGRADED: {
    icon: '⚡',
    bgColor: '#974f0c',
    textColor: '#ffffff',
  },
  ERROR: {
    icon: '⛔',
    bgColor: '#ae2a19',
    textColor: '#ffffff',
  },
  UNKNOWN: {
    icon: '⏳',
    bgColor: '#626f86',
    textColor: '#ffffff',
  },
};

export function normalizeStatus(raw: any, field: string): NormalizedStatus {
  if (!raw) {
    return {
      severity: 'UNKNOWN',
      label: 'Awaiting data',
      impact: 'Dashboard cannot assess system state',
      action: 'Enable phases to begin collecting data',
    };
  }

  // Overall system health
  if (field === 'overall') {
    if (raw.systemStatus === 'RUNNING') {
      return {
        severity: 'OK',
        label: 'Operational',
        reasonCode: 'RUNNING',
        impact: 'All governance processes are functioning',
        action: 'Monitor for any alerts',
      };
    }
    if (raw.systemStatus === 'DEGRADED') {
      return {
        severity: 'DEGRADED',
        label: 'Degraded',
        reasonCode: raw.degradedReason || 'DEGRADED',
        impact: 'Some processes may be delayed or incomplete',
        action: 'Review degraded phase and verify configuration',
      };
    }
    if (raw.systemStatus === 'ERROR') {
      return {
        severity: 'ERROR',
        label: 'Non-operational',
        reasonCode: 'ERROR',
        impact: 'Governance processes are not functioning',
        action: 'Check logs, verify platform access, and restart if needed',
      };
    }
  }

  // Data freshness
  if (field === 'freshness') {
    if (raw.freshnessStatus === 'FRESH') {
      return {
        severity: 'OK',
        label: 'Current',
        reasonCode: 'FRESH',
        impact: 'Data is recent and reliable',
        action: 'No action needed',
      };
    }
    if (raw.freshnessStatus === 'AGING') {
      return {
        severity: 'WARNING',
        label: 'Aging',
        reasonCode: 'AGING',
        impact: 'Data is becoming stale; export may reflect older state',
        action: 'Monitor next scheduled run',
      };
    }
    if (raw.freshnessStatus === 'STALE') {
      return {
        severity: 'DEGRADED',
        label: 'Stale',
        reasonCode: 'STALE',
        impact: 'Data is out of date; governance assessment may be inaccurate',
        action: 'Investigate why collection paused; restart if needed',
      };
    }
  }

  // Scheduler
  if (field === 'scheduler') {
    if (raw.lastCheckAt) {
      const ageMs = Date.now() - new Date(raw.lastCheckAt).getTime();
      const ageMinutes = ageMs / (1000 * 60);
      if (ageMinutes < 10) {
        return {
          severity: 'OK',
          label: 'Firing',
          reasonCode: 'SCHEDULER_FIRING',
          impact: 'Scheduler is actively running',
          action: 'Monitor for next cycle',
        };
      }
      if (ageMinutes < 30) {
        return {
          severity: 'WARNING',
          label: 'Scheduled (delayed)',
          reasonCode: 'SCHEDULER_DELAYED',
          impact: 'Scheduler appears delayed but still responsive',
          action: 'Check for infrastructure issues',
        };
      }
      return {
        severity: 'ERROR',
        label: 'Not firing',
        reasonCode: 'SCHEDULER_NOT_FIRING',
        impact: 'Scheduler has not run recently; data collection stopped',
        action: 'Investigate scheduler logs and restart if needed',
      };
    }
    return {
      severity: 'UNKNOWN',
      label: 'Never fired',
      reasonCode: 'SCHEDULER_NEVER_RUN',
      impact: 'Scheduler has not run since deployment',
      action: 'Verify scheduler configuration and wait for first run',
    };
  }

  // Read-Only Posture
  if (field === 'readOnly') {
    if (raw.systemStatus !== 'DEGRADED' && raw.systemStatus !== 'ERROR') {
      return {
        severity: 'OK',
        label: 'Enforced',
        reasonCode: 'READ_ONLY_OK',
        impact: 'Code-level guard prevents write operations',
        action: 'No action needed',
      };
    }
    return {
      severity: 'WARNING',
      label: 'Unverified',
      reasonCode: 'READ_ONLY_UNVERIFIED',
      impact: 'Cannot verify read-only posture (system not operational)',
      action: 'Restore system health to re-verify',
    };
  }

  // Snapshot/Export readiness
  if (field === 'export') {
    if (raw.exportReady === false || raw.systemStatus !== 'RUNNING') {
      return {
        severity: 'WARNING',
        label: 'Not ready',
        reasonCode: 'EXPORT_NOT_READY',
        impact: 'Export function is not available',
        action: 'Wait for first snapshot or verify system is operational',
      };
    }
    return {
      severity: 'OK',
      label: 'Ready',
      reasonCode: 'EXPORT_READY',
      impact: 'Governance snapshot is available for export',
      action: 'Use export button to download',
    };
  }

  // Generic fallback
  return {
    severity: 'UNKNOWN',
    label: 'Unknown state',
    impact: 'Status unclear',
    action: 'Refresh page or contact support',
  };
}
