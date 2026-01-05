/**
 * CONFIG RISK COMPUTATION
 * 
 * Pure deterministic function: (metrics, nowISO) -> ConfigRiskSnapshot
 * No I/O, no storage, no time fetch except injected.
 * 
 * Risk band computation:
 * - EMPTY: all metrics null -> LOW (neutral default)
 * - PARTIAL/COMPLETE: max severity among non-null metrics (HIGH > MEDIUM > LOW)
 * 
 * Completeness rules:
 * - EMPTY: all metrics null
 * - PARTIAL: at least 1 null AND at least 1 non-null
 * - COMPLETE: all metrics non-null
 */

import { ConfigMetrics, RiskBand, ConfigRiskSnapshot, MetricIssue } from './types';
import { THRESHOLDS } from './thresholds';

/**
 * Map a metric value to its risk band (internal helper)
 */
function metricToBand(metricName: keyof ConfigMetrics, value: number | null): RiskBand | null {
  if (value === null) {
    return null;
  }

  const threshold = THRESHOLDS[metricName];
  if (!threshold) {
    return null;
  }

  if (value <= threshold.LOW) {
    return 'LOW';
  } else if (value <= threshold.HIGH_START - 1) {
    return 'MEDIUM';
  } else {
    return 'HIGH';
  }
}

/**
 * Compute overall risk band: max severity among all non-null metrics
 */
function computeOverallBand(metrics: ConfigMetrics): RiskBand {
  const bands: RiskBand[] = [];

  const metricKeys: (keyof ConfigMetrics)[] = [
    'customFieldCount',
    'workflowCount',
    'workflowSchemeCount',
    'screenCount',
    'permissionSchemeCount',
    'maxWorkflowsPerScheme',
    'maxProjectsPerPermissionScheme',
  ];

  for (const key of metricKeys) {
    const value = metrics[key];
    const band = metricToBand(key, value);
    if (band) {
      bands.push(band);
    }
  }

  if (bands.length === 0) {
    return 'LOW'; // neutral default for EMPTY
  }

  // HIGH > MEDIUM > LOW
  if (bands.includes('HIGH')) {
    return 'HIGH';
  } else if (bands.includes('MEDIUM')) {
    return 'MEDIUM';
  } else {
    return 'LOW';
  }
}

/**
 * Determine completeness of metrics
 */
function computeCompleteness(metrics: ConfigMetrics): 'COMPLETE' | 'PARTIAL' | 'EMPTY' {
  const metricKeys: (keyof ConfigMetrics)[] = [
    'customFieldCount',
    'workflowCount',
    'workflowSchemeCount',
    'screenCount',
    'permissionSchemeCount',
    'maxWorkflowsPerScheme',
    'maxProjectsPerPermissionScheme',
  ];

  const nullCount = metricKeys.filter((k) => metrics[k] === null).length;
  const nonNullCount = metricKeys.length - nullCount;

  if (nullCount === metricKeys.length) {
    return 'EMPTY';
  } else if (nonNullCount === metricKeys.length) {
    return 'COMPLETE';
  } else {
    return 'PARTIAL';
  }
}

/**
 * Pure function: compute snapshot from metrics and timestamp
 * No I/O, deterministic.
 */
export function computeConfigRisk(metrics: ConfigMetrics, nowISO: string, issues: MetricIssue[] = []): ConfigRiskSnapshot {
  const completeness = computeCompleteness(metrics);
  const riskBand = computeOverallBand(metrics);

  return {
    metrics,
    riskBand,
    evaluatedAtISO: nowISO,
    completeness,
    issues,
    mode: 'scheduled-read-only',
    boundaries: {
      noJiraWrites: true,
      noConfigChanges: true,
      noEnforcement: true,
    },
  };
}
