/**
 * PHASE 8 v2: METRICS PAGE UI
 *
 * Read-only display of governance metrics with:
 * - Metric cards (value, confidence, completeness)
 * - Definitions and disclosures
 * - Drill-down to contributing objects
 * - JSON export capability
 */

import { html, router } from '@forge/api';
import { listMetricsRuns, getMetricsRun } from '../phase8/metrics_storage';
import {
  exportMetricsRun,
  exportMetricsRunReport,
  exportMetricsRunJson,
} from '../phase8/metrics_export';
import {
  MetricsRun,
  MetricRecord,
  MetricAvailability,
  ConfidenceLabel,
} from '../phase8/metrics_model';

/**
 * Render metrics list page
 */
export async function renderMetricsListPage(tenantId: string, cloudId: string, page: number = 0) {
  const safePage = Math.max(0, parseInt(String(page), 10) || 0);

  let result;
  try {
    result = await listMetricsRuns(tenantId, cloudId, {
      page: safePage,
      limit: 20,
    });
  } catch (error: any) {
    return errorResponse(`Failed to load metrics runs: ${error.message}`);
  }

  const runRowsHtml = result.items
    .map(
      run => `
    <tr>
      <td>${htmlEscape(run.metrics_run_id.substring(0, 8))}...</td>
      <td>${run.time_window.from} to ${run.time_window.to}</td>
      <td>${new Date(run.computed_at).toLocaleString()}</td>
      <td>
        <span class="badge badge-${run.status}">
          ${run.status.toUpperCase()}
        </span>
      </td>
      <td>${run.completeness_percentage}%</td>
      <td>
        <a href="?action=metrics-detail&id=${htmlEscape(run.metrics_run_id)}">View</a>
      </td>
    </tr>
  `
    )
    .join('');

  return html`
    <html>
      <head>
        <title>Phase 8 - Governance Metrics</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f5f5f5;
            padding: 20px;
          }
          .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
          h1 { color: #0747a6; margin-bottom: 10px; }
          .description { color: #626262; margin-bottom: 20px; font-size: 14px; }
          
          .info-box {
            background: #f0f7ff;
            border-left: 4px solid #0747a6;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 4px;
          }
          
          table { width: 100%; border-collapse: collapse; }
          th { background: #f5f5f5; padding: 12px; text-align: left; font-weight: bold; }
          td { padding: 12px; border-bottom: 1px solid #eee; }
          
          .badge { 
            padding: 4px 8px; 
            border-radius: 3px; 
            font-size: 12px; 
            font-weight: bold; 
          }
          .badge-success { background: #dffcf0; color: #216e4e; }
          .badge-partial { background: #fff7d6; color: #974f0c; }
          .badge-failed { background: #fdeaea; color: #ae2a19; }
          
          a { color: #0747a6; text-decoration: none; }
          a:hover { text-decoration: underline; }
          
          .pagination { margin-top: 20px; text-align: center; }
          .pagination a, .pagination span { 
            padding: 8px 12px; 
            margin: 0 4px; 
            border: 1px solid #ddd;
            border-radius: 3px;
            display: inline-block;
          }
          .pagination a { background: #0747a6; color: white; cursor: pointer; }
          .pagination span { background: #ddd; color: #999; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📊 Phase 8 - Governance Metrics</h1>
          <p class="description">
            Formally defined governance metrics computed from snapshots and drift events.
          </p>
          
          <div class="info-box">
            <strong>ℹ️ About These Metrics:</strong><br>
            All metrics show explicit numerator, denominator, confidence score, and completeness percentage.
            NOT_AVAILABLE indicates missing required data (never zero).
          </div>
          
          ${result.items.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Metrics Run ID</th>
                  <th>Time Window</th>
                  <th>Computed At</th>
                  <th>Status</th>
                  <th>Completeness</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${runRowsHtml}
              </tbody>
            </table>
            
            <div class="pagination">
              ${safePage > 0 ? `<a href="?action=metrics-list&page=${safePage - 1}">&larr; Previous</a>` : '<span>&larr; Previous</span>'}
              <span>Page ${safePage + 1}</span>
              ${result.has_more ? `<a href="?action=metrics-list&page=${safePage + 1}">Next &rarr;</a>` : '<span>Next &rarr;</span>'}
            </div>
          ` : `
            <p style="color: #999; text-align: center; padding: 40px;">
              No metrics runs available yet.
            </p>
          `}
        </div>
      </body>
    </html>
  `;
}

/**
 * Render metrics detail page
 */
export async function renderMetricsDetailPage(
  tenantId: string,
  cloudId: string,
  metricsRunId: string
) {
  let metricsRun: MetricsRun | null;
  try {
    metricsRun = await getMetricsRun(tenantId, cloudId, metricsRunId);
  } catch (error: any) {
    return errorResponse(`Failed to load metrics: ${error.message}`);
  }

  if (!metricsRun) {
    return errorResponse('Metrics run not found', '?action=metrics-list');
  }

  // Render metric cards
  const metricCardsHtml = metricsRun.metrics
    .map(metric => renderMetricCard(metric))
    .join('');

  // Export buttons
  const exportJsonUrl = `?action=metrics-export&id=${htmlEscape(metricsRunId)}&format=json`;
  const exportReportUrl = `?action=metrics-export&id=${htmlEscape(metricsRunId)}&format=report`;

  return html`
    <html>
      <head>
        <title>Metrics Run ${metricsRunId.substring(0, 8)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f5f5f5;
            padding: 20px;
          }
          .container { max-width: 1400px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
          h1 { color: #0747a6; margin-bottom: 10px; }
          .breadcrumb { margin-bottom: 20px; }
          .breadcrumb a { color: #0747a6; }
          
          .run-info {
            background: #f0f7ff;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
            font-size: 13px;
          }
          .run-info-row { margin: 8px 0; }
          .run-info-label { font-weight: bold; display: inline-block; width: 150px; }
          
          .actions {
            margin-bottom: 20px;
            display: flex;
            gap: 10px;
          }
          .btn { 
            padding: 8px 16px; 
            background: #0747a6; 
            color: white; 
            border: none; 
            border-radius: 4px; 
            text-decoration: none; 
            cursor: pointer;
            font-size: 13px;
          }
          .btn:hover { background: #0747a6dd; }
          
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
          }
          
          .metric-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 16px;
            background: #fafafa;
          }
          .metric-card.not-available {
            background: #fff3cd;
            border-color: #ffc107;
          }
          
          .metric-title { font-weight: bold; margin-bottom: 12px; color: #333; }
          .metric-key { font-size: 11px; color: #999; margin-bottom: 8px; }
          
          .metric-value {
            font-size: 28px;
            font-weight: bold;
            color: #0747a6;
            margin: 12px 0;
          }
          .metric-value.not-available { color: #999; font-size: 18px; }
          
          .metric-row { margin: 8px 0; font-size: 12px; }
          .metric-row-label { font-weight: 500; color: #626262; }
          
          .confidence {
            padding: 8px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
            display: inline-block;
            margin-top: 10px;
          }
          .confidence.HIGH { background: #dffcf0; color: #216e4e; }
          .confidence.MEDIUM { background: #dfe9f3; color: #0747a6; }
          .confidence.LOW { background: #f5f0ff; color: #5e4db2; }
          .confidence.NONE { background: #f5f5f5; color: #626262; }
          
          .disclosures { font-size: 12px; color: #666; margin-top: 12px; }
          .disclosures li { margin-left: 20px; margin-top: 4px; }
          
          a { color: #0747a6; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📊 Metrics Run Detail</h1>
          <p class="breadcrumb">
            <a href="?action=metrics-list">&larr; Back to Metrics List</a>
          </p>
          
          <div class="run-info">
            <div class="run-info-row">
              <span class="run-info-label">Metrics Run ID:</span>
              <code>${htmlEscape(metricsRun.metrics_run_id)}</code>
            </div>
            <div class="run-info-row">
              <span class="run-info-label">Time Window:</span>
              ${metricsRun.time_window.from} to ${metricsRun.time_window.to}
            </div>
            <div class="run-info-row">
              <span class="run-info-label">Computed At:</span>
              ${new Date(metricsRun.computed_at).toLocaleString()}
            </div>
            <div class="run-info-row">
              <span class="run-info-label">Status:</span>
              <strong>${metricsRun.status.toUpperCase()}</strong>
            </div>
            <div class="run-info-row">
              <span class="run-info-label">Completeness:</span>
              ${metricsRun.completeness_percentage}%
            </div>
            ${metricsRun.missing_inputs.length > 0 ? `
              <div class="run-info-row">
                <span class="run-info-label">Missing Inputs:</span>
                ${metricsRun.missing_inputs.join(', ')}
              </div>
            ` : ''}
            <div class="run-info-row">
              <span class="run-info-label">Canonical Hash:</span>
              <code style="font-size: 11px;">${metricsRun.canonical_hash.substring(0, 16)}...</code>
            </div>
          </div>
          
          <div class="actions">
            <a href="${exportJsonUrl}" class="btn" download>💾 Export JSON</a>
            <a href="${exportReportUrl}" class="btn" download>📄 Export Report</a>
            <a href="?action=metrics-definitions" class="btn">📖 View Definitions</a>
          </div>
          
          <div class="metrics-grid">
            ${metricCardsHtml}
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Render single metric card
 */
function renderMetricCard(metric: MetricRecord): string {
  const isNotAvailable = metric.availability === MetricAvailability.NOT_AVAILABLE;

  return `
    <div class="metric-card ${isNotAvailable ? 'not-available' : ''}">
      <div class="metric-key">${metric.metric_key}</div>
      <div class="metric-title">${htmlEscape(metric.title)}</div>
      
      ${isNotAvailable
        ? `
        <div class="metric-value not-available">NOT AVAILABLE</div>
        <div class="metric-row">
          <span class="metric-row-label">Reason:</span>
          ${metric.not_available_reason}
        </div>
      `
        : `
        <div class="metric-value">${metric.value !== null ? metric.value.toFixed(3) : 'N/A'}</div>
        <div class="metric-row">
          <span class="metric-row-label">Numerator / Denominator:</span>
          ${metric.numerator} / ${metric.denominator}
        </div>
      `}
      
      <div class="metric-row">
        <span class="metric-row-label">Confidence:</span>
        <span class="confidence ${metric.confidence_label}">
          ${metric.confidence_label} (${(metric.confidence_score * 100).toFixed(0)}%)
        </span>
      </div>
      
      <div class="metric-row">
        <span class="metric-row-label">Completeness:</span>
        ${metric.completeness_percentage}%
      </div>
      
      ${metric.dependencies.length > 0
        ? `
        <div class="metric-row">
          <span class="metric-row-label">Dependencies:</span>
          ${metric.dependencies.join(', ')}
        </div>
      `
        : ''}
      
      ${metric.disclosures.length > 0
        ? `
        <div class="disclosures">
          <strong>Disclosures:</strong>
          <ul>
            ${metric.disclosures.map(d => `<li>${htmlEscape(d)}</li>`).join('')}
          </ul>
        </div>
      `
        : ''}
    </div>
  `;
}

/**
 * Render definitions page
 */
export async function renderDefinitionsPage() {
  return html`
    <html>
      <head>
        <title>Metrics Definitions</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f5f5f5;
            padding: 20px;
          }
          .container { max-width: 1000px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
          h1 { color: #0747a6; margin-bottom: 30px; }
          
          .metric-def {
            margin-bottom: 30px;
            border-left: 4px solid #0747a6;
            padding-left: 16px;
          }
          
          .metric-def-title { font-weight: bold; font-size: 16px; margin-bottom: 10px; }
          .metric-def-key { font-size: 12px; color: #999; margin-bottom: 8px; }
          .metric-def-formula { 
            background: #f5f5f5; 
            padding: 12px; 
            border-radius: 4px; 
            font-family: monospace; 
            font-size: 12px;
            margin: 10px 0;
            white-space: pre-wrap;
            word-wrap: break-word;
          }
          
          .back-link { margin-top: 20px; }
          .back-link a { color: #0747a6; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📖 Governance Metrics Definitions</h1>
          
          <div class="metric-def">
            <div class="metric-def-key">M1</div>
            <div class="metric-def-title">Required Fields Never Used</div>
            <div class="metric-def-formula">
numerator = count(required fields with zero usage)
denominator = count(required fields)
value = numerator / denominator

Dependencies: fields_metadata, usage_logs
            </div>
            <p>Measures the proportion of required fields that show no usage in submissions during the time window.</p>
          </div>
          
          <div class="metric-def">
            <div class="metric-def-key">M2</div>
            <div class="metric-def-title">Inconsistent Field Usage Across Projects</div>
            <div class="metric-def-formula">
For each field:
  variance_ratio = variance(usage_by_project) / (mean * (1 - mean))
  if variance_ratio > 0.35: field is INCONSISTENT

numerator = count(inconsistent fields)
denominator = count(all fields)
value = numerator / denominator

Threshold: 0.35 (fixed, not configurable)
            </div>
            <p>Identifies fields with highly variable usage patterns across projects.</p>
          </div>
          
          <div class="metric-def">
            <div class="metric-def-key">M3</div>
            <div class="metric-def-title">Automation Rules Present but Never Executed</div>
            <div class="metric-def-formula">
numerator = count(enabled automation rules with zero executions)
denominator = count(enabled automation rules)
value = numerator / denominator

Dependencies: automation_rules, execution_logs
            </div>
            <p>Measures the proportion of enabled automation rules that have not been executed.</p>
          </div>
          
          <div class="metric-def">
            <div class="metric-def-key">M4</div>
            <div class="metric-def-title">Configuration Change Events Per Tracked Object</div>
            <div class="metric-def-formula">
numerator = count(drift events in time window)
denominator = count(distinct tracked objects)
         = count(fields) + count(workflows) + count(automation_rules) + count(projects) + count(scopes)
value = numerator / denominator (unbounded, can exceed 1.0)

Dependencies: tracked_objects, drift_events
            </div>
            <p>Measures the density of detected changes relative to number of tracked objects. Can exceed 1.0 if objects change multiple times.</p>
          </div>
          
          <div class="metric-def">
            <div class="metric-def-key">M5</div>
            <div class="metric-def-title">Datasets Missing Due to Permission or API Errors</div>
            <div class="metric-def-formula">
numerator = count(datasets missing during capture)
denominator = count(expected datasets)
value = numerator / denominator

Always AVAILABLE (does not depend on data availability)
            </div>
            <p>Tracks datasets that were expected but unavailable due to permission restrictions or API failures.</p>
          </div>
          
          <div class="back-link">
            <a href="?action=metrics-list">&larr; Back to Metrics List</a>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Helper: HTML escape
 */
function htmlEscape(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Helper: Error response
 */
function errorResponse(message: string, backLink: string = '?action=metrics-list'): any {
  return html`
    <html>
      <head>
        <title>Error</title>
        <style>
          body { font-family: sans-serif; padding: 20px; background: #f5f5f5; }
          .error { background: #fdeaea; color: #ae2a19; padding: 20px; border-radius: 4px; }
          a { color: #0747a6; }
        </style>
      </head>
      <body>
        <div class="error">
          <strong>Error:</strong> ${htmlEscape(message)}
        </div>
        <p style="margin-top: 20px;">
          <a href="${backLink}">&larr; Go Back</a>
        </p>
      </body>
    </html>
  `;
}
