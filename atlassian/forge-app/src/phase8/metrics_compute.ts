/**
 * PHASE 8 v2: METRICS COMPUTATION ENGINE
 *
 * Formal implementation of 5 governance metrics:
 * M1 - Required fields never used
 * M2 - Inconsistent field usage
 * M3 - Automation present vs executed
 * M4 - Configuration churn density
 * M5 - Visibility gap over time
 *
 * All metrics are deterministic, READ-ONLY, and truth-safe.
 */

import * as crypto from 'crypto';
import {
  MetricsRun,
  MetricRecord,
  MetricKey,
  MetricAvailability,
  NotAvailableReason,
  TimeWindow,
  computeConfidenceScore,
  createNotAvailableMetric,
  createAvailableMetric,
  canonicalMetricsRunJson,
} from './metrics_model';

/**
 * Interface for snapshot data (Phase-6)
 */
export interface SnapshotData {
  fields?: Array<{ id: string; name: string; required: boolean; active: boolean }>;
  projects?: Array<{ id: string; key: string }>;
  automationRules?: Array<{ id: string; name: string; enabled: boolean }>;
  missingData?: {
    dataset_keys: string[];
    reason_codes: string[];
  };
}

/**
 * Interface for usage data
 */
export interface UsageData {
  [projectId: string]: {
    usedFieldIds: Set<string>;
    automationRuleExecutions: { [ruleId: string]: number };
  };
}

/**
 * Interface for drift event data (Phase-7)
 */
export interface DriftEventData {
  object_type: string;
  object_id: string;
  change_type: string;
  timestamp: string;
}

/**
 * M1: Required fields never used
 *
 * Definition:
 * - denom = count(required fields visible in scope)
 * - num = count(required fields with zero observed usage in window)
 * - If usage dataset missing → NOT_AVAILABLE
 *
 * Dependencies: fields metadata, usage logs
 */
export function computeM1_UnusedRequiredFields(
  snapshot: SnapshotData | null,
  usage: UsageData | null,
  missingInputs: string[]
): MetricRecord {
  const metricKey = MetricKey.M1_UNUSED_REQUIRED_FIELDS;
  const title = 'Required Fields Never Used';
  const dependencies = ['fields_metadata', 'usage_logs'];
  const disclosures = [
    'Counts required fields across all projects in scope.',
    'Measures usage by checking if field appeared in any form submissions.',
    'Missing usage data causes NOT_AVAILABLE status.',
    'Does not infer usage from other sources.',
  ];

  // Check required datasets
  if (!snapshot || !snapshot.fields || !usage) {
    const reason = !usage
      ? NotAvailableReason.MISSING_USAGE_DATA
      : NotAvailableReason.MISSING_SNAPSHOT_DATA;
    return createNotAvailableMetric(metricKey, title, reason, dependencies, disclosures);
  }

  // Extract required fields
  const requiredFields = snapshot.fields.filter(f => f.required && f.active);

  if (requiredFields.length === 0) {
    return createAvailableMetric(
      metricKey,
      title,
      0,
      0,
      1.0,
      'HIGH' as any,
      100,
      dependencies,
      [...disclosures, 'No required fields present in scope.'],
      true,
      []
    );
  }

  // Collect all used field IDs across all projects
  const allUsedFieldIds = new Set<string>();
  Object.values(usage).forEach(projectUsage => {
    projectUsage.usedFieldIds.forEach(id => allUsedFieldIds.add(id));
  });

  // Count required fields with zero usage
  const unusedRequiredFields = requiredFields.filter(
    f => !allUsedFieldIds.has(f.id)
  );

  const numerator = unusedRequiredFields.length;
  const denominator = requiredFields.length;

  // Confidence: high if usage data is complete
  const missingCriticalDatasets = missingInputs.includes('usage_logs') ? 1 : 0;
  const { score, label } = computeConfidenceScore({
    base_completeness: 100 - (missingCriticalDatasets * 20),
    missing_critical_datasets: missingCriticalDatasets,
  });

  return createAvailableMetric(
    metricKey,
    title,
    numerator,
    denominator,
    score,
    label,
    100 - (missingCriticalDatasets * 20),
    dependencies,
    [
      ...disclosures,
      `Evaluated ${denominator} required fields.`,
      `Found ${numerator} with zero usage.`,
    ],
    true,
    unusedRequiredFields.map(f => ({
      field_id: f.id,
      field_name: f.name,
      usage_count: 0,
    }))
  );
}

/**
 * M2: Inconsistent field usage
 *
 * Definition:
 * - For each field: usage_variance = VARIANCE(usage_by_project)
 * - INCONSISTENCY_THRESHOLD = 0.35
 * - num = count(fields where usage_variance > threshold)
 * - denom = count(fields evaluated)
 * - If project-level usage missing → NOT_AVAILABLE
 */
export function computeM2_InconsistentFieldUsage(
  snapshot: SnapshotData | null,
  usage: UsageData | null,
  missingInputs: string[]
): MetricRecord {
  const metricKey = MetricKey.M2_INCONSISTENT_FIELD_USAGE;
  const title = 'Inconsistent Field Usage Across Projects';
  const dependencies = ['fields_metadata', 'project_usage_logs'];
  const disclosures = [
    'Measures variance of field usage across projects.',
    'Threshold for inconsistency: 0.35 (variance as proportion of mean).',
    'Does not identify root causes or prescribe changes.',
    'Missing project-level usage data causes NOT_AVAILABLE status.',
  ];

  const INCONSISTENCY_THRESHOLD = 0.35;

  // Check required datasets
  if (!snapshot || !snapshot.fields || !usage) {
    const reason = !usage
      ? NotAvailableReason.MISSING_PROJECT_USAGE_DATA
      : NotAvailableReason.MISSING_SNAPSHOT_DATA;
    return createNotAvailableMetric(metricKey, title, reason, dependencies, disclosures);
  }

  if (Object.keys(usage).length === 0) {
    return createNotAvailableMetric(
      metricKey,
      title,
      NotAvailableReason.MISSING_PROJECT_USAGE_DATA,
      dependencies,
      [...disclosures, 'No project usage data available.']
    );
  }

  const activeFields = snapshot.fields.filter(f => f.active);
  if (activeFields.length === 0) {
    return createAvailableMetric(
      metricKey,
      title,
      0,
      0,
      1.0,
      'HIGH' as any,
      100,
      dependencies,
      [...disclosures, 'No active fields in scope.'],
      true,
      []
    );
  }

  // Calculate per-field usage variance across projects
  const inconsistentFields: any[] = [];
  let inconsistentCount = 0;

  for (const field of activeFields) {
    const usagePerProject: number[] = [];

    for (const projectUsage of Object.values(usage)) {
      const used = projectUsage.usedFieldIds.has(field.id) ? 1 : 0;
      usagePerProject.push(used);
    }

    // Calculate variance as proportion of mean
    const mean = usagePerProject.reduce((a, b) => a + b, 0) / usagePerProject.length;
    if (mean === 0 || mean === 1) {
      // No variance if all projects use or all don't use
      continue;
    }

    const variance =
      usagePerProject.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      usagePerProject.length;
    const varianceRatio = variance / (mean * (1 - mean));

    if (varianceRatio > INCONSISTENCY_THRESHOLD) {
      inconsistentCount++;
      inconsistentFields.push({
        field_id: field.id,
        field_name: field.name,
        variance_ratio: varianceRatio.toFixed(4),
        threshold: INCONSISTENCY_THRESHOLD,
      });
    }
  }

  const numerator = inconsistentCount;
  const denominator = activeFields.length;

  const missingCriticalDatasets = missingInputs.includes('project_usage_logs') ? 1 : 0;
  const { score, label } = computeConfidenceScore({
    base_completeness: 100 - (missingCriticalDatasets * 20),
    missing_critical_datasets: missingCriticalDatasets,
  });

  return createAvailableMetric(
    metricKey,
    title,
    numerator,
    denominator,
    score,
    label,
    100 - (missingCriticalDatasets * 20),
    dependencies,
    [
      ...disclosures,
      `Evaluated ${denominator} fields across ${Object.keys(usage).length} projects.`,
      `Found ${numerator} fields with usage variance > ${INCONSISTENCY_THRESHOLD}.`,
    ],
    true,
    inconsistentFields
  );
}

/**
 * M3: Automation execution gap
 *
 * Definition:
 * - denom = count(automation rules present)
 * - num = count(automation rules with zero executions)
 * - If execution logs unavailable → NOT_AVAILABLE
 *
 * Dependencies: automation rules + execution logs
 */
export function computeM3_AutomationExecutionGap(
  snapshot: SnapshotData | null,
  usage: UsageData | null,
  missingInputs: string[]
): MetricRecord {
  const metricKey = MetricKey.M3_AUTOMATION_EXECUTION_GAP;
  const title = 'Automation Rules Present but Never Executed';
  const dependencies = ['automation_rules', 'execution_logs'];
  const disclosures = [
    'Counts automation rules in scope.',
    'Measures rules with zero executions in time window.',
    'Missing execution logs causes NOT_AVAILABLE status.',
    'Does not infer execution from indirect signals.',
  ];

  // Check required datasets
  if (!snapshot || !snapshot.automationRules || !usage) {
    const reason = !usage
      ? NotAvailableReason.MISSING_EXECUTION_LOGS
      : NotAvailableReason.MISSING_SNAPSHOT_DATA;
    return createNotAvailableMetric(metricKey, title, reason, dependencies, disclosures);
  }

  const enabledRules = snapshot.automationRules.filter(r => r.enabled);

  if (enabledRules.length === 0) {
    return createAvailableMetric(
      metricKey,
      title,
      0,
      0,
      1.0,
      'HIGH' as any,
      100,
      dependencies,
      [...disclosures, 'No enabled automation rules in scope.'],
      true,
      []
    );
  }

  // Aggregate executions across all projects
  const totalExecutions: { [ruleId: string]: number } = {};
  Object.values(usage).forEach(projectUsage => {
    Object.entries(projectUsage.automationRuleExecutions).forEach(([ruleId, count]) => {
      totalExecutions[ruleId] = (totalExecutions[ruleId] || 0) + count;
    });
  });

  // Count rules with zero executions
  const unexecutedRules = enabledRules.filter(r => !totalExecutions[r.id] || totalExecutions[r.id] === 0);

  const numerator = unexecutedRules.length;
  const denominator = enabledRules.length;

  const missingCriticalDatasets = missingInputs.includes('execution_logs') ? 1 : 0;
  const { score, label } = computeConfidenceScore({
    base_completeness: 100 - (missingCriticalDatasets * 20),
    missing_critical_datasets: missingCriticalDatasets,
  });

  return createAvailableMetric(
    metricKey,
    title,
    numerator,
    denominator,
    score,
    label,
    100 - (missingCriticalDatasets * 20),
    dependencies,
    [
      ...disclosures,
      `Evaluated ${denominator} enabled automation rules.`,
      `Found ${numerator} with zero executions.`,
    ],
    true,
    unexecutedRules.map(r => ({
      rule_id: r.id,
      rule_name: r.name,
      execution_count: 0,
    }))
  );
}

/**
 * M4: Configuration churn density
 *
 * Definition:
 * - denom = number of tracked objects in scope
 * - num = number of drift events in window
 * - value = num / denom
 * - If drift data missing → NOT_AVAILABLE
 *
 * Dependencies: Phase-7 drift events
 */
export function computeM4_ConfigurationChurnDensity(
  snapshot: SnapshotData | null,
  driftEvents: DriftEventData[],
  missingInputs: string[]
): MetricRecord {
  const metricKey = MetricKey.M4_CONFIGURATION_CHURN_DENSITY;
  const title = 'Configuration Change Events Per Tracked Object';
  const dependencies = ['tracked_objects', 'drift_events'];
  const disclosures = [
    'Counts distinct tracked objects (fields, workflows, automation rules, projects, scopes).',
    'Measures drift events (detected changes) in time window.',
    'Value = churn events / tracked objects.',
    'Missing drift data causes NOT_AVAILABLE status.',
  ];

  // Check required datasets
  if (!snapshot) {
    return createNotAvailableMetric(
      metricKey,
      title,
      NotAvailableReason.MISSING_SNAPSHOT_DATA,
      dependencies,
      disclosures
    );
  }

  if (!driftEvents || driftEvents.length === 0) {
    // No drift data available
    if (missingInputs.includes('drift_events')) {
      return createNotAvailableMetric(
        metricKey,
        title,
        NotAvailableReason.MISSING_DRIFT_DATA,
        dependencies,
        disclosures
      );
    }
  }

  // Count distinct tracked objects
  const trackedObjectCount =
    (snapshot.fields?.length || 0) +
    (snapshot.automationRules?.length || 0) +
    (snapshot.projects?.length || 0);

  if (trackedObjectCount === 0) {
    return createAvailableMetric(
      metricKey,
      title,
      0,
      0,
      1.0,
      'HIGH' as any,
      100,
      dependencies,
      [...disclosures, 'No tracked objects in scope.'],
      true,
      []
    );
  }

  // Count drift events
  const churnEventCount = driftEvents.length;
  const numerator = churnEventCount;
  const denominator = trackedObjectCount;
  const value = denominator > 0 ? numerator / denominator : 0;

  const missingCriticalDatasets = missingInputs.includes('drift_events') ? 1 : 0;
  const { score, label } = computeConfidenceScore({
    base_completeness: 100 - (missingCriticalDatasets * 20),
    missing_critical_datasets: missingCriticalDatasets,
  });

  return createAvailableMetric(
    metricKey,
    title,
    numerator,
    denominator,
    score,
    label,
    100 - (missingCriticalDatasets * 20),
    dependencies,
    [
      ...disclosures,
      `Tracked ${denominator} objects.`,
      `Recorded ${numerator} drift events.`,
      `Churn density: ${value.toFixed(3)} events/object.`,
    ],
    false,
    driftEvents.map(e => ({
      object_type: e.object_type,
      object_id: e.object_id,
      change_type: e.change_type,
      timestamp: e.timestamp,
    }))
  );
}

/**
 * M5: Visibility gap over time
 *
 * Definition:
 * - denom = expected dataset count
 * - num = datasets missing due to permission/API errors
 * - Always AVAILABLE if missing_data exists
 *
 * Dependencies: snapshot missing_data field
 */
export function computeM5_VisibilityGapOverTime(
  snapshot: SnapshotData | null,
  expectedDatasets: string[]
): MetricRecord {
  const metricKey = MetricKey.M5_VISIBILITY_GAP_OVER_TIME;
  const title = 'Datasets Missing Due to Permission or API Errors';
  const dependencies = ['snapshot_missing_data', 'expected_datasets'];
  const disclosures = [
    'Identifies datasets that were expected but unavailable during capture.',
    'Missing data indicates permission restrictions or API failures.',
    'Does not attempt to infer missing content.',
    'Always available if snapshot exists (even if no missing data recorded).',
  ];

  const missingDatasets = snapshot?.missingData?.dataset_keys || [];
  const denominatorValue = expectedDatasets.length || 1;
  const numeratorValue = missingDatasets.length;

  // Always available (even if no missing data)
  const { score, label } = computeConfidenceScore({
    base_completeness: 100,
    missing_critical_datasets: 0,
  });

  return createAvailableMetric(
    metricKey,
    title,
    numeratorValue,
    denominatorValue,
    score,
    label,
    100,
    dependencies,
    [
      ...disclosures,
      `Expected ${denominatorValue} datasets.`,
      `Found ${numeratorValue} missing due to access/API issues.`,
      missingDatasets.length > 0
        ? `Missing datasets: ${missingDatasets.join(', ')}`
        : 'All expected datasets were accessible.',
    ],
    true,
    missingDatasets.map(ds => ({
      dataset_key: ds,
      reason: snapshot?.missingData?.reason_codes[missingDatasets.indexOf(ds)] || 'UNKNOWN',
    }))
  );
}

/**
 * Compute all metrics for a given time window
 */
export async function computeAllMetrics(
  tenantId: string,
  cloudId: string,
  snapshot: SnapshotData,
  usage: UsageData,
  driftEvents: DriftEventData[],
  timeWindow: TimeWindow,
  missingInputs: string[] = []
): Promise<Omit<MetricsRun, 'canonical_hash'>> {
  const metricsRunId = require('crypto').randomUUID();
  const computedAt = new Date().toISOString();

  // Compute all metrics
  const metrics = [
    computeM1_UnusedRequiredFields(snapshot, usage, missingInputs),
    computeM2_InconsistentFieldUsage(snapshot, usage, missingInputs),
    computeM3_AutomationExecutionGap(snapshot, usage, missingInputs),
    computeM4_ConfigurationChurnDensity(snapshot, driftEvents, missingInputs),
    computeM5_VisibilityGapOverTime(snapshot, ['fields', 'projects', 'workflows', 'automation_rules']),
  ];

  // Calculate overall completeness
  const availableMetrics = metrics.filter(m => m.availability === MetricAvailability.AVAILABLE);
  const completenessPercentage =
    availableMetrics.length > 0 ? (availableMetrics.length / metrics.length) * 100 : 0;

  const status =
    metrics.length === metrics.filter(m => m.availability === MetricAvailability.AVAILABLE).length
      ? 'success'
      : 'partial';

  return {
    tenant_id: tenantId,
    cloud_id: cloudId,
    metrics_run_id: metricsRunId,
    time_window: timeWindow,
    computed_at: computedAt,
    status,
    completeness_percentage: completenessPercentage,
    missing_inputs: missingInputs,
    schema_version: '8.0',
    metrics,
    hash_algorithm: 'sha256',
  };
}

/**
 * Generate canonical hash of metrics run
 */
export function generateCanonicalHash(metricsRun: Omit<MetricsRun, 'canonical_hash'>): string {
  const canonical = canonicalMetricsRunJson(metricsRun);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}
