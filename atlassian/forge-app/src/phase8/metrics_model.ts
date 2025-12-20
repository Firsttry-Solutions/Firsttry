/**
 * PHASE 8 v2: GOVERNANCE METRICS
 *
 * Formally defined metrics computed from Phase-6 snapshots and Phase-7 drift events.
 * 
 * Core Principles:
 * - Every metric includes numerator, denominator, confidence, completeness
 * - NOT_AVAILABLE is used when required inputs are missing (never coerced to zero)
 * - Deterministic: same inputs → same outputs → same canonical hash
 * - No recommendations, causality, or combined scores
 * - All outputs are mathematically explicit and reconstructable
 */

/**
 * Metric keys (stable identifiers)
 */
export enum MetricKey {
  M1_UNUSED_REQUIRED_FIELDS = 'M1_UNUSED_REQUIRED_FIELDS',
  M2_INCONSISTENT_FIELD_USAGE = 'M2_INCONSISTENT_FIELD_USAGE',
  M3_AUTOMATION_EXECUTION_GAP = 'M3_AUTOMATION_EXECUTION_GAP',
  M4_CONFIGURATION_CHURN_DENSITY = 'M4_CONFIGURATION_CHURN_DENSITY',
  M5_VISIBILITY_GAP_OVER_TIME = 'M5_VISIBILITY_GAP_OVER_TIME',
}

/**
 * Availability status for metrics
 */
export enum MetricAvailability {
  AVAILABLE = 'AVAILABLE',
  NOT_AVAILABLE = 'NOT_AVAILABLE',
}

/**
 * Explicit reasons metric is not available
 */
export enum NotAvailableReason {
  MISSING_USAGE_DATA = 'MISSING_USAGE_DATA',
  MISSING_PROJECT_USAGE_DATA = 'MISSING_PROJECT_USAGE_DATA',
  MISSING_EXECUTION_LOGS = 'MISSING_EXECUTION_LOGS',
  MISSING_DRIFT_DATA = 'MISSING_DRIFT_DATA',
  MISSING_SNAPSHOT_DATA = 'MISSING_SNAPSHOT_DATA',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
}

/**
 * Confidence label for human interpretation
 */
export enum ConfidenceLabel {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  NONE = 'NONE',
}

/**
 * Time window for metric computation
 */
export interface TimeWindow {
  from: string; // ISO-8601
  to: string;   // ISO-8601
}

/**
 * Single metric record (canonical format)
 */
export interface MetricRecord {
  metric_key: MetricKey;
  title: string;
  numerator: number | null;
  denominator: number | null;
  value: number | null;
  availability: MetricAvailability;
  not_available_reason?: NotAvailableReason;
  confidence_score: number; // 0.0 to 1.0
  confidence_label: ConfidenceLabel;
  completeness_percentage: number; // 0 to 100
  dependencies: string[]; // dataset keys required for this metric
  disclosures: string[]; // explicit statements about what metric measures/doesn't
  bounded: boolean; // whether result is bounded (e.g., percentage 0-100)
  deterministic_order?: any[]; // objects contributing to metric (for drill-down)
}

/**
 * Complete metrics run (immutable record)
 */
export interface MetricsRun {
  tenant_id: string;
  cloud_id: string;
  metrics_run_id: string; // UUID
  time_window: TimeWindow;
  computed_at: string; // ISO-8601
  status: 'success' | 'partial' | 'failed';
  completeness_percentage: number; // overall run completeness
  missing_inputs: string[]; // explicit list of missing datasets
  schema_version: string; // "8.0"
  metrics: MetricRecord[];
  canonical_hash: string; // SHA-256 of canonical JSON
  hash_algorithm: string; // "sha256"
}

/**
 * Confidence scoring computation (deterministic)
 */
export interface ConfidenceScoringInput {
  base_completeness: number; // 0-100
  missing_critical_datasets: number; // count of critical datasets absent
  data_freshness_hours?: number; // optional age of data
}

/**
 * Compute confidence score deterministically
 *
 * base = completeness_percentage / 100
 * penalty = 0.2 per missing critical dataset
 * confidence_score = max(0, base - penalty)
 *
 * No smoothing. No heuristics.
 */
export function computeConfidenceScore(
  input: ConfidenceScoringInput
): { score: number; label: ConfidenceLabel } {
  const base = input.base_completeness / 100;
  const penalty = 0.2 * input.missing_critical_datasets;
  const score = Math.max(0, base - penalty);

  let label: ConfidenceLabel;
  if (score >= 0.85) {
    label = ConfidenceLabel.HIGH;
  } else if (score >= 0.65) {
    label = ConfidenceLabel.MEDIUM;
  } else if (score >= 0.4) {
    label = ConfidenceLabel.LOW;
  } else {
    label = ConfidenceLabel.NONE;
  }

  return { score, label };
}

/**
 * Helper: Create NOT_AVAILABLE metric record
 */
export function createNotAvailableMetric(
  metricKey: MetricKey,
  title: string,
  reason: NotAvailableReason,
  dependencies: string[],
  disclosures: string[]
): MetricRecord {
  return {
    metric_key: metricKey,
    title,
    numerator: null,
    denominator: null,
    value: null,
    availability: MetricAvailability.NOT_AVAILABLE,
    not_available_reason: reason,
    confidence_score: 0,
    confidence_label: ConfidenceLabel.NONE,
    completeness_percentage: 0,
    dependencies,
    disclosures: [
      ...disclosures,
      `Metric is NOT_AVAILABLE due to: ${reason}`,
      'No value can be computed when required data is missing.',
    ],
    bounded: false,
  };
}

/**
 * Helper: Create available metric record
 */
export function createAvailableMetric(
  metricKey: MetricKey,
  title: string,
  numerator: number,
  denominator: number,
  confidenceScore: number,
  confidenceLabel: ConfidenceLabel,
  completeness: number,
  dependencies: string[],
  disclosures: string[],
  bounded: boolean = true,
  contributingObjects?: any[]
): MetricRecord {
  const value =
    denominator > 0 ? numerator / denominator : denominator === 0 ? 0 : null;

  return {
    metric_key: metricKey,
    title,
    numerator,
    denominator,
    value,
    availability: MetricAvailability.AVAILABLE,
    confidence_score: confidenceScore,
    confidence_label: confidenceLabel,
    completeness_percentage: completeness,
    dependencies,
    disclosures,
    bounded,
    deterministic_order: contributingObjects || [],
  };
}

/**
 * Canonical JSON serialization (for hashing)
 * Must be deterministic: sorted keys, stable ordering
 */
export function canonicalMetricsRunJson(metricsRun: Omit<MetricsRun, 'canonical_hash'>): string {
  const obj = {
    tenant_id: metricsRun.tenant_id,
    cloud_id: metricsRun.cloud_id,
    metrics_run_id: metricsRun.metrics_run_id,
    time_window: {
      from: metricsRun.time_window.from,
      to: metricsRun.time_window.to,
    },
    computed_at: metricsRun.computed_at,
    status: metricsRun.status,
    completeness_percentage: metricsRun.completeness_percentage,
    missing_inputs: metricsRun.missing_inputs.sort(), // stable order
    schema_version: metricsRun.schema_version,
    metrics: metricsRun.metrics
      .sort((a, b) => a.metric_key.localeCompare(b.metric_key)) // stable order
      .map(m => ({
        metric_key: m.metric_key,
        title: m.title,
        numerator: m.numerator,
        denominator: m.denominator,
        value: m.value,
        availability: m.availability,
        not_available_reason: m.not_available_reason || null,
        confidence_score: m.confidence_score,
        confidence_label: m.confidence_label,
        completeness_percentage: m.completeness_percentage,
        dependencies: m.dependencies.sort(), // stable order
        disclosures: m.disclosures.sort(), // stable order
        bounded: m.bounded,
      })),
    hash_algorithm: metricsRun.hash_algorithm,
  };

  return JSON.stringify(obj);
}
