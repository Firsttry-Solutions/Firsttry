/**
 * PHASE 8 v2: METRICS EXPORT
 *
 * Export metrics runs in canonical JSON format with:
 * - Formal definitions
 * - Disclosure statements
 * - Confidence computation details
 * - Missing input tracking
 */

import { MetricsRun, MetricKey, ConfidenceLabel } from './metrics_model';

/**
 * Formal metric definitions (static)
 */
const METRIC_DEFINITIONS: Record<MetricKey, {
  title: string;
  formula: string;
  interpretation: string;
}> = {
  [MetricKey.M1_UNUSED_REQUIRED_FIELDS]: {
    title: 'Required Fields Never Used',
    formula: `
numerator = count(required fields with zero usage in window)
denominator = count(required fields in scope)
value = numerator / denominator
    `.trim(),
    interpretation: 'Proportion of required fields that appear to have no usage. Does not infer usage.',
  },
  [MetricKey.M2_INCONSISTENT_FIELD_USAGE]: {
    title: 'Inconsistent Field Usage Across Projects',
    formula: `
For each field:
  usage_by_project = [0 or 1 per project]
  variance = VARIANCE(usage_by_project)
  mean_usage = MEAN(usage_by_project)
  variance_ratio = variance / (mean * (1 - mean))
  
  if variance_ratio > 0.35:
    field is INCONSISTENT

numerator = count(inconsistent fields)
denominator = count(all active fields)
value = numerator / denominator
    `.trim(),
    interpretation: 'Proportion of fields with high usage variance across projects (threshold: 0.35). Does not prescribe standardization.',
  },
  [MetricKey.M3_AUTOMATION_EXECUTION_GAP]: {
    title: 'Automation Rules Present but Never Executed',
    formula: `
numerator = count(enabled automation rules with zero executions in window)
denominator = count(enabled automation rules)
value = numerator / denominator
    `.trim(),
    interpretation: 'Proportion of enabled automation rules with no recorded executions. Does not infer execution from indirect signals.',
  },
  [MetricKey.M4_CONFIGURATION_CHURN_DENSITY]: {
    title: 'Configuration Change Events Per Tracked Object',
    formula: `
numerator = count(drift events in time window)
denominator = count(distinct tracked objects (fields + workflows + automation rules + projects + scopes))
value = numerator / denominator
    `.trim(),
    interpretation: 'Density of detected configuration changes relative to number of tracked objects. Unbounded (can exceed 1.0).',
  },
  [MetricKey.M5_VISIBILITY_GAP_OVER_TIME]: {
    title: 'Datasets Missing Due to Permission or API Errors',
    formula: `
numerator = count(datasets missing during snapshot capture)
denominator = count(expected datasets
value = numerator / denominator
    `.trim(),
    interpretation: 'Proportion of expected datasets that were unavailable due to permission restrictions or API failures.',
  },
};

/**
 * Confidence scoring formula (static)
 */
const CONFIDENCE_FORMULA = `
base_completeness = completeness_percentage / 100
penalty_per_missing_dataset = 0.2
confidence_score = max(0, base_completeness - (penalty_per_missing_dataset * missing_critical_datasets_count))

Labels:
  >= 0.85 => HIGH
  >= 0.65 => MEDIUM
  >= 0.40 => LOW
  < 0.40 => NONE

No smoothing. No heuristics.
`;

/**
 * Export a metrics run as canonical JSON
 */
export interface MetricsExport {
  metrics_run: MetricsRun;
  definitions: typeof METRIC_DEFINITIONS;
  confidence_scoring_formula: string;
  prohibited_terms: string[];
  export_timestamp: string;
}

export function exportMetricsRun(metricsRun: MetricsRun): MetricsExport {
  return {
    metrics_run: metricsRun,
    definitions: METRIC_DEFINITIONS,
    confidence_scoring_formula: CONFIDENCE_FORMULA,
    prohibited_terms: [
      'recommend',
      'fix',
      'root cause',
      'impact',
      'improve',
      'combined score',
      'health',
    ],
    export_timestamp: new Date().toISOString(),
  };
}

/**
 * Export as JSON string (for file download)
 */
export function exportMetricsRunJson(metricsRun: MetricsRun): string {
  const exported = exportMetricsRun(metricsRun);
  return JSON.stringify(exported, null, 2);
}

/**
 * Generate human-readable report
 */
export function exportMetricsRunReport(metricsRun: MetricsRun): string {
  const lines: string[] = [];

  lines.push('# PHASE 8 v2 - GOVERNANCE METRICS REPORT');
  lines.push('');
  lines.push(`**Generated:** ${metricsRun.computed_at}`);
  lines.push(`**Metrics Run ID:** ${metricsRun.metrics_run_id}`);
  lines.push(`**Time Window:** ${metricsRun.time_window.from} to ${metricsRun.time_window.to}`);
  lines.push(`**Status:** ${metricsRun.status}`);
  lines.push(`**Overall Completeness:** ${metricsRun.completeness_percentage}%`);
  lines.push(`**Canonical Hash:** ${metricsRun.canonical_hash}`);
  lines.push('');

  if (metricsRun.missing_inputs.length > 0) {
    lines.push('## Missing Inputs');
    metricsRun.missing_inputs.forEach(input => {
      lines.push(`- ${input}`);
    });
    lines.push('');
  }

  lines.push('## Metrics Summary');
  lines.push('');

  metricsRun.metrics.forEach(metric => {
    lines.push(`### ${metric.metric_key}: ${metric.title}`);
    lines.push('');

    if (metric.availability === 'AVAILABLE') {
      lines.push(`**Value:** ${metric.value !== null ? metric.value.toFixed(4) : 'N/A'}`);
      lines.push(`**Numerator:** ${metric.numerator}`);
      lines.push(`**Denominator:** ${metric.denominator}`);
    } else {
      lines.push(`**Status:** NOT AVAILABLE`);
      lines.push(`**Reason:** ${metric.not_available_reason}`);
    }

    lines.push(`**Confidence:** ${metric.confidence_label} (${(metric.confidence_score * 100).toFixed(1)}%)`);
    lines.push(`**Completeness:** ${metric.completeness_percentage}%`);
    lines.push('');

    if (metric.dependencies.length > 0) {
      lines.push(`**Dependencies:** ${metric.dependencies.join(', ')}`);
    }

    if (metric.disclosures.length > 0) {
      lines.push('**Disclosures:**');
      metric.disclosures.forEach(d => {
        lines.push(`- ${d}`);
      });
    }

    lines.push('');
  });

  lines.push('## Definitions');
  lines.push('');

  Object.entries(METRIC_DEFINITIONS).forEach(([key, def]) => {
    lines.push(`### ${key}: ${def.title}`);
    lines.push('');
    lines.push(`**Formula:**`);
    lines.push('```');
    lines.push(def.formula);
    lines.push('```');
    lines.push('');
    lines.push(`**Interpretation:** ${def.interpretation}`);
    lines.push('');
  });

  lines.push('## Confidence Scoring');
  lines.push('');
  lines.push('```');
  lines.push(CONFIDENCE_FORMULA);
  lines.push('```');
  lines.push('');

  lines.push('## Prohibited Terms');
  lines.push('');
  lines.push('The following terms are not used in metrics:');
  const prohibited = ['recommend', 'fix', 'root cause', 'impact', 'improve', 'combined score', 'health'];
  prohibited.forEach(term => {
    lines.push(`- ${term}`);
  });

  return lines.join('\n');
}
