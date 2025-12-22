/**
 * Phase 9.5-F: Silence-as-Success Indicator
 *
 * Implements deterministic detection of "normal operation" state.
 * When FirstTry succeeds silently, absence of noise is meaningful.
 *
 * Silence Condition: All of:
 * - Snapshots are succeeding
 * - No failures pending
 * - No alerts triggered
 *
 * Output: "FirstTry operating normally" or "Issues detected"
 *
 * Key Invariants:
 * - Never implies Jira health
 * - Never suggests fixes
 * - Never recommends actions
 * - Pure functions (no side effects)
 * - Deterministic (same input → same output)
 */

/**
 * Indicator state - represents silence/operation status
 */
export type SilenceIndicatorState = 'operating_normally' | 'issues_detected';

/**
 * Silence condition assessment result
 */
export interface SilenceCondition {
  snapshots_succeeding: boolean;  // All recent snapshots passed
  no_failures_pending: boolean;   // No failed/pending operations
  no_alerts_triggered: boolean;   // No alerts currently active
  all_conditions_met: boolean;    // All three conditions true
}

/**
 * Silence indicator report - comprehensive assessment
 */
export interface SilenceIndicatorReport {
  timestamp: string;              // ISO 8601 UTC
  tenant_id: string;              // Tenant identifier
  indicator_state: SilenceIndicatorState;
  conditions: SilenceCondition;
  
  // Detailed breakdown
  recent_snapshot_count: number;
  recent_snapshot_success_count: number;
  snapshot_success_rate: number;  // 0-100
  pending_failures: number;
  active_alerts: number;
  
  // Descriptive message
  message: string;                // "FirstTry operating normally" or "Issues detected"
  
  // Transparency
  last_state_change?: string;     // ISO 8601 UTC when state last changed
  silence_duration_seconds?: number;  // How long operating normally
  
  // Integrity
  canonical_hash: string;         // SHA-256 for verification
  schema_version: string;         // "1.0" for compatibility
}

/**
 * Silence history entry - tracks state transitions
 */
export interface SilenceHistoryEntry {
  timestamp: string;              // ISO 8601 UTC
  state: SilenceIndicatorState;
  reason: string;                 // Why state changed
  duration_since_last_change_seconds: number;
}

/**
 * Silence timeline - all state transitions
 */
export interface SilenceTimeline {
  tenant_id: string;
  entries: SilenceHistoryEntry[];
  current_state: SilenceIndicatorState;
  current_state_duration_seconds: number;
  state_changes_in_period: number;
  canonical_hash: string;
}

/**
 * Create a silence condition assessment from operational metrics
 *
 * Pure function: no side effects, deterministic
 *
 * @param snapshotSuccessRate - Percentage of recent snapshots succeeding (0-100)
 * @param pendingFailures - Count of operations pending/failed
 * @param activeAlerts - Count of currently active alerts
 * @returns Assessment of whether silence conditions are met
 */
export function assessSilenceCondition(
  snapshotSuccessRate: number,
  pendingFailures: number,
  activeAlerts: number
): SilenceCondition {
  const snapshots_succeeding = snapshotSuccessRate >= 95;  // 95% threshold
  const no_failures_pending = pendingFailures === 0;       // Strictly zero
  const no_alerts_triggered = activeAlerts === 0;          // Strictly zero

  return {
    snapshots_succeeding,
    no_failures_pending,
    no_alerts_triggered,
    all_conditions_met: snapshots_succeeding && no_failures_pending && no_alerts_triggered,
  };
}

/**
 * Determine indicator state from silence conditions
 *
 * @param conditions - Silence condition assessment
 * @returns The indicator state
 */
export function determineSilenceIndicatorState(
  conditions: SilenceCondition
): SilenceIndicatorState {
  return conditions.all_conditions_met ? 'operating_normally' : 'issues_detected';
}

/**
 * Generate descriptive message for silence indicator
 *
 * @param state - Current indicator state
 * @param conditions - Silence conditions
 * @param snapshotSuccessRate - Snapshot success percentage
 * @param pendingFailures - Count of pending failures
 * @param activeAlerts - Count of active alerts
 * @returns Human-readable message (no recommendations, no causal claims)
 */
export function generateSilenceMessage(
  state: SilenceIndicatorState,
  conditions: SilenceCondition,
  snapshotSuccessRate: number,
  pendingFailures: number,
  activeAlerts: number
): string {
  if (state === 'operating_normally') {
    return 'FirstTry operating normally';
  }

  // Build explanation of why not operating normally
  const issues: string[] = [];

  if (!conditions.snapshots_succeeding) {
    issues.push(`snapshots at ${snapshotSuccessRate.toFixed(1)}% success`);
  }
  if (!conditions.no_failures_pending) {
    issues.push(`${pendingFailures} pending`);
  }
  if (!conditions.no_alerts_triggered) {
    issues.push(`${activeAlerts} alert${activeAlerts === 1 ? '' : 's'}`);
  }

  return `Issues detected: ${issues.join(', ')}`;
}

/**
 * Create a complete silence indicator report
 *
 * @param params - Report parameters
 * @returns Complete indicator report with hash
 */
export function createSilenceIndicatorReport(params: {
  tenant_id: string;
  recent_snapshot_count: number;
  recent_snapshot_success_count: number;
  pending_failures: number;
  active_alerts: number;
  last_state_change_timestamp?: string;
  last_silence_start_timestamp?: string;
}): SilenceIndicatorReport {
  const snapshotSuccessRate =
    params.recent_snapshot_count > 0
      ? (params.recent_snapshot_success_count / params.recent_snapshot_count) * 100
      : 0;

  const conditions = assessSilenceCondition(
    snapshotSuccessRate,
    params.pending_failures,
    params.active_alerts
  );

  const state = determineSilenceIndicatorState(conditions);

  const message = generateSilenceMessage(
    state,
    conditions,
    snapshotSuccessRate,
    params.pending_failures,
    params.active_alerts
  );

  const timestamp = new Date().toISOString();

  // Calculate silence duration if operating normally
  let silence_duration_seconds: number | undefined;
  if (state === 'operating_normally' && params.last_silence_start_timestamp) {
    const startTime = new Date(params.last_silence_start_timestamp).getTime();
    const now = new Date().getTime();
    silence_duration_seconds = Math.floor((now - startTime) / 1000);
  }

  const report: SilenceIndicatorReport = {
    timestamp,
    tenant_id: params.tenant_id,
    indicator_state: state,
    conditions,
    recent_snapshot_count: params.recent_snapshot_count,
    recent_snapshot_success_count: params.recent_snapshot_success_count,
    snapshot_success_rate: snapshotSuccessRate,
    pending_failures: params.pending_failures,
    active_alerts: params.active_alerts,
    message,
    last_state_change: params.last_state_change_timestamp,
    silence_duration_seconds,
    canonical_hash: '', // Will be computed
    schema_version: '1.0',
  };

  // Compute hash
  report.canonical_hash = computeSilenceIndicatorHash(report);

  return report;
}

/**
 * Compute SHA-256 hash of silence indicator report
 *
 * Deterministic: sorted keys ensure same input → same hash
 *
 * @param report - Silence indicator report
 * @returns SHA-256 hex string
 */
export function computeSilenceIndicatorHash(report: SilenceIndicatorReport): string {
  const crypto = require('crypto');

  // Create canonical JSON with sorted keys (excluding timestamp for determinism)
  const canonical = JSON.stringify(
    {
      tenant_id: report.tenant_id,
      indicator_state: report.indicator_state,
      conditions: report.conditions,
      recent_snapshot_count: report.recent_snapshot_count,
      recent_snapshot_success_count: report.recent_snapshot_success_count,
      snapshot_success_rate: report.snapshot_success_rate,
      pending_failures: report.pending_failures,
      active_alerts: report.active_alerts,
      message: report.message,
      last_state_change: report.last_state_change,
      silence_duration_seconds: report.silence_duration_seconds,
      schema_version: report.schema_version,
    },
    Object.keys({
      tenant_id: 0,
      indicator_state: 0,
      conditions: 0,
      recent_snapshot_count: 0,
      recent_snapshot_success_count: 0,
      snapshot_success_rate: 0,
      pending_failures: 0,
      active_alerts: 0,
      message: 0,
      last_state_change: 0,
      silence_duration_seconds: 0,
      schema_version: 0,
    }).sort()
  );

  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Verify silence indicator report hash
 *
 * @param report - Report to verify
 * @returns true if hash matches (data authentic), false if modified
 */
export function verifySilenceIndicatorHash(report: SilenceIndicatorReport): boolean {
  const computedHash = computeSilenceIndicatorHash(report);
  return report.canonical_hash === computedHash;
}

/**
 * Track silence state transitions over time
 *
 * @param entries - History entries
 * @returns Timeline with state analysis
 */
export function buildSilenceTimeline(
  tenant_id: string,
  entries: SilenceHistoryEntry[]
): SilenceTimeline {
  if (entries.length === 0) {
    return {
      tenant_id,
      entries: [],
      current_state: 'operating_normally',
      current_state_duration_seconds: 0,
      state_changes_in_period: 0,
      canonical_hash: '',
    };
  }

  // Sort by timestamp (ascending)
  const sorted = [...entries].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const currentEntry = sorted[sorted.length - 1];
  const now = new Date().getTime();
  const currentTime = new Date(currentEntry.timestamp).getTime();
  const currentStateDurationSeconds = Math.floor((now - currentTime) / 1000);

  const timeline: SilenceTimeline = {
    tenant_id,
    entries: sorted,
    current_state: currentEntry.state,
    current_state_duration_seconds: currentStateDurationSeconds,
    state_changes_in_period: sorted.length,
    canonical_hash: '',
  };

  // Compute hash
  timeline.canonical_hash = computeSilenceTimelineHash(timeline);

  return timeline;
}

/**
 * Compute hash of silence timeline
 *
 * @param timeline - Timeline to hash
 * @returns SHA-256 hex string
 */
export function computeSilenceTimelineHash(timeline: SilenceTimeline): string {
  const crypto = require('crypto');

  const canonical = JSON.stringify(
    {
      tenant_id: timeline.tenant_id,
      entries: timeline.entries,
      current_state: timeline.current_state,
      current_state_duration_seconds: timeline.current_state_duration_seconds,
      state_changes_in_period: timeline.state_changes_in_period,
    },
    Object.keys({
      tenant_id: 0,
      entries: 0,
      current_state: 0,
      current_state_duration_seconds: 0,
      state_changes_in_period: 0,
    }).sort()
  );

  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Render silence indicator as HTML badge
 *
 * Subtle design: no risk colors, informational only
 *
 * @param report - Silence indicator report
 * @returns HTML string for badge
 */
export function renderSilenceIndicatorHtml(report: SilenceIndicatorReport): string {
  const isOperatingNormally = report.indicator_state === 'operating_normally';
  const bgColor = isOperatingNormally ? '#f0f4f8' : '#fff7e6'; // Blue-ish or amber-ish
  const textColor = isOperatingNormally ? '#0052cc' : '#974f0c';
  const icon = isOperatingNormally ? '✓' : '⚠';

  return `
<div class="silence-indicator-badge" style="
  background-color: ${bgColor};
  color: ${textColor};
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(0, 0, 0, 0.1);
">
  <span class="silence-indicator-icon">${icon}</span>
  <span class="silence-indicator-message">${report.message}</span>
</div>
`.trim();
}

/**
 * Render silence timeline as HTML
 *
 * @param timeline - Silence timeline
 * @returns HTML string for timeline visualization
 */
export function renderSilenceTimelineHtml(timeline: SilenceTimeline): string {
  if (timeline.entries.length === 0) {
    return `<div class="silence-timeline" style="padding: 16px; color: #626f86;">No state transitions recorded</div>`;
  }

  const entries = timeline.entries
    .map((entry) => {
      const icon = entry.state === 'operating_normally' ? '✓' : '⚠';
      const color = entry.state === 'operating_normally' ? '#0052cc' : '#974f0c';
      const timestamp = new Date(entry.timestamp).toLocaleString();

      return `
  <div class="silence-timeline-entry" style="padding: 12px; border-left: 3px solid ${color}; margin-bottom: 8px; background-color: #f9f9f9;">
    <div style="display: flex; gap: 8px; align-items: center;">
      <span style="color: ${color}; font-size: 16px;">${icon}</span>
      <div>
        <div style="font-weight: 500; color: #161B22;">${entry.state === 'operating_normally' ? 'Silence started' : 'Issues detected'}</div>
        <div style="font-size: 12px; color: #626f86;">${entry.reason}</div>
        <div style="font-size: 12px; color: #626f86;">${timestamp}</div>
      </div>
    </div>
  </div>
`;
    })
    .join('\n');

  return `
<div class="silence-timeline">
  <h4 style="margin: 0 0 12px 0;">State Transitions</h4>
${entries}
  <div style="padding: 12px; background-color: #f9f9f9; margin-top: 12px; border-radius: 4px; font-size: 12px; color: #626f86;">
    <strong>Current:</strong> ${timeline.current_state} for ${timeline.current_state_duration_seconds} seconds
  </div>
</div>
`.trim();
}

/**
 * Generate markdown report of silence indicator status
 *
 * @param report - Silence indicator report
 * @returns Markdown string
 */
export function generateSilenceIndicatorReport(report: SilenceIndicatorReport): string {
  const statusEmoji = report.indicator_state === 'operating_normally' ? '✓' : '⚠';
  const silenceDurationLine =
    report.silence_duration_seconds !== undefined
      ? `**Silence Duration:** ${report.silence_duration_seconds} seconds\n\n`
      : '';

  return `# FirstTry System Status

## Status

${statusEmoji} **${report.message}**

---

## Conditions Assessed

| Condition | Status |
|-----------|--------|
| Snapshots Succeeding (≥95%) | ${report.conditions.snapshots_succeeding ? '✓' : '✗'} |
| No Failures Pending | ${report.conditions.no_failures_pending ? '✓' : '✗'} |
| No Alerts Triggered | ${report.conditions.no_alerts_triggered ? '✓' : '✗'} |

---

## Metrics

| Metric | Value |
|--------|-------|
| Recent Snapshots | ${report.recent_snapshot_count} |
| Successful Snapshots | ${report.recent_snapshot_success_count} |
| Success Rate | ${report.snapshot_success_rate.toFixed(1)}% |
| Pending Failures | ${report.pending_failures} |
| Active Alerts | ${report.active_alerts} |

${silenceDurationLine}
---

## Metadata

- **Timestamp:** ${report.timestamp}
- **Tenant:** ${report.tenant_id}
- **Hash:** \`${report.canonical_hash}\`
- **Schema Version:** ${report.schema_version}

---

**Note:** This status reflects FirstTry's operational state. Absence of alerts indicates normal operation, not Jira health assessment.
`;
}

/**
 * Export silence indicator as JSON
 *
 * @param report - Silence indicator report
 * @returns JSON object
 */
export function exportSilenceIndicatorJson(report: SilenceIndicatorReport): Record<string, any> {
  return {
    timestamp: report.timestamp,
    tenant_id: report.tenant_id,
    indicator_state: report.indicator_state,
    message: report.message,
    conditions: report.conditions,
    metrics: {
      recent_snapshot_count: report.recent_snapshot_count,
      recent_snapshot_success_count: report.recent_snapshot_success_count,
      snapshot_success_rate: report.snapshot_success_rate,
      pending_failures: report.pending_failures,
      active_alerts: report.active_alerts,
    },
    silence_duration_seconds: report.silence_duration_seconds,
    canonical_hash: report.canonical_hash,
    schema_version: report.schema_version,
  };
}
