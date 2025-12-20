/**
 * PHASE 9.5-B: HISTORICAL BLIND-SPOT MAP
 *
 * Derives time ranges where governance evidence is missing (blind spots).
 * Exposes unknown periods visually without inferring causes.
 *
 * Blind spots occur when:
 * - FirstTry not yet installed
 * - Permissions insufficient for snapshots
 * - Snapshots failed or incomplete
 * - Time ranges with no evidence
 *
 * Core rule: Derive automatically, never infer causes beyond stated reasons.
 */

/**
 * Reason for blind spot (factual, no inference)
 */
export type BlindSpotReason =
  | 'not_installed'        // FirstTry not installed yet
  | 'permission_missing'   // Insufficient permissions
  | 'snapshot_failed'      // Snapshot failed or incomplete
  | 'unknown';             // Unknown reason (gap with no clear cause)

/**
 * A continuous period with no governance evidence
 */
export interface BlindSpotPeriod {
  start_time: string;              // ISO 8601 UTC
  end_time: string;                // ISO 8601 UTC
  reason: BlindSpotReason;
  reason_description: string;      // Static text explaining reason
  duration_days: number;           // (end_time - start_time) in days
  severity: 'critical' | 'high' | 'medium';  // How significant this gap is
}

/**
 * Blind-spot map for a tenant
 */
export interface BlindSpotMap {
  tenant_id: string;
  computed_at: string;             // ISO 8601 UTC
  analysis_start: string;          // Start of analysis window
  analysis_end: string;            // End of analysis window
  blind_spot_periods: BlindSpotPeriod[];
  total_blind_days: number;        // Sum of all duration_days
  coverage_percentage: number;     // (1 - blind_days/total_days) * 100
  canonical_hash: string;          // SHA-256 for integrity
  schema_version: '1.0';
}

/**
 * Input for blind-spot derivation
 */
export interface BlindSpotInput {
  tenant_id: string;
  first_install_date?: string;     // ISO 8601 UTC or null if not yet installed
  snapshot_runs: SnapshotRunRecord[];  // History of snapshot attempts
  analysis_window: {
    start: string;                 // ISO 8601 UTC
    end: string;                   // ISO 8601 UTC
  };
}

/**
 * Record of a snapshot run attempt
 */
export interface SnapshotRunRecord {
  run_id: string;
  scheduled_at: string;            // ISO 8601 UTC
  completed_at?: string;           // ISO 8601 UTC, undefined if failed
  success: boolean;
  failure_reason?: string;         // 'permission_denied', 'timeout', 'error', etc.
  snapshot_start?: string;         // Time window of snapshot
  snapshot_end?: string;
}

// ============================================================================
// BLIND-SPOT DERIVATION
// ============================================================================

/**
 * Derive blind spots from snapshot history.
 * Analyzes gaps in evidence without inferring causes.
 */
export function deriveBlindSpots(input: BlindSpotInput): BlindSpotMap {
  const { tenant_id, first_install_date, snapshot_runs, analysis_window } = input;

  const blind_spot_periods: BlindSpotPeriod[] = [];

  // 1. Period before install is a blind spot (if install_date provided)
  if (first_install_date) {
    const installDate = new Date(first_install_date);
    const windowStart = new Date(analysis_window.start);

    // Check if install date is within the analysis window
    if (windowStart <= installDate) {
      const windowEnd = new Date(analysis_window.end);
      // Only create blind spot if install date is before window end
      if (installDate <= windowEnd) {
        const endTime = first_install_date;
        const duration = computeDaysBetween(analysis_window.start, endTime);

        blind_spot_periods.push({
          start_time: analysis_window.start,
          end_time: endTime,
          reason: 'not_installed',
          reason_description: 'FirstTry was not installed during this period',
          duration_days: duration,
          severity: 'critical',
        });
      }
    }
  }

  // 2. Analyze gaps in snapshot execution
  if (snapshot_runs.length > 0) {
    // Sort by scheduled_at
    const sorted = [...snapshot_runs].sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );

    // Look for gaps between successful snapshots
    // Start from install date if it's within or after window start, otherwise start from window start
    let lastSuccessfulTime = first_install_date
      ? new Date(first_install_date).toISOString()
      : analysis_window.start;

    // Ensure we don't look for gaps before the analysis window starts
    if (new Date(lastSuccessfulTime) < new Date(analysis_window.start)) {
      lastSuccessfulTime = analysis_window.start;
    }

    // Check if we're starting from the install date/window start (no earlier successful run)
    let isFirstRun = true;
    let hadAnySuccessfulRun = false;

    for (const run of sorted) {
      // Skip runs that start before analysis window
      const runTime = new Date(run.scheduled_at);
      if (runTime < new Date(analysis_window.start)) {
        // But still update lastSuccessfulTime if this run was successful
        if (run.success && run.completed_at) {
          const completedTime = new Date(run.completed_at);
          if (completedTime >= new Date(analysis_window.start)) {
            lastSuccessfulTime = run.completed_at;
          } else if (completedTime > new Date(lastSuccessfulTime)) {
            lastSuccessfulTime = run.completed_at;
          }
        }
        continue;
      }

      const lastTime = new Date(lastSuccessfulTime);

      // Gap between last success and this run
      if (runTime > lastTime) {
        let gapStart = lastSuccessfulTime;
        let gapEnd = run.scheduled_at;

        // Ensure gap doesn't extend before analysis window start
        if (new Date(gapStart) < new Date(analysis_window.start)) {
          gapStart = analysis_window.start;
        }

        const duration = computeDaysBetween(gapStart, gapEnd);

        // Only create blind spot if:
        // 1. This is the FIRST run and gap >= 12 hours from install/window start, OR
        // 2. This run FAILED (and gap >= 12 hours), OR  
        // 3. Gap is very long (> 7 days) and this run succeeded (indicates infrastructure issue)
        // Do NOT create blind spots just for gaps between successful runs (unless very long)
        const isFailure = !run.success;
        const isVeryLongGap = duration > 7;
        const isMinimalGap = duration >= 0.5;

        if ((isFirstRun && isMinimalGap) || (isFailure && isMinimalGap) || (isVeryLongGap && run.success)) {
          if (isFirstRun && run.success) {
            // First run after install/window start - create blind spot for gap
            blind_spot_periods.push({
              start_time: gapStart,
              end_time: gapEnd,
              reason: 'unknown',
              reason_description: 'No snapshot runs from start until first successful snapshot',
              duration_days: duration,
              severity: duration > 7 ? 'high' : 'medium',
            });
          } else if (isFailure) {
            // Gap ended with failure
            const failureReason = run.failure_reason || 'unknown';
            const reason: BlindSpotReason =
              failureReason === 'permission_denied'
                ? 'permission_missing'
                : 'snapshot_failed';

            blind_spot_periods.push({
              start_time: gapStart,
              end_time: gapEnd,
              reason,
              reason_description: getReasonDescription(reason, failureReason),
              duration_days: duration,
              severity: duration > 7 ? 'high' : 'medium',
            });
          } else if (isVeryLongGap && run.success) {
            // Very long gap with a successful run afterwards - indicates infrastructure problem
            blind_spot_periods.push({
              start_time: gapStart,
              end_time: gapEnd,
              reason: 'unknown',
              reason_description: 'Extended period without snapshot runs',
              duration_days: duration,
              severity: 'high',
            });
          }
        }
      }

      // Update last successful time if this run succeeded
      if (run.success && run.completed_at) {
        lastSuccessfulTime = run.completed_at;
        hadAnySuccessfulRun = true;
        isFirstRun = false;  // No longer the first run
      }
    }

    // Check if last successful snapshot is older than analysis_end
    // Note: We don't create blind spots for post-analysis gaps (gaps at the end
    // of the window after the last successful run) unless there's explicit evidence
    // of a failure. If all runs were successful, the window ending doesn't create a blind spot.
    // This avoids "fabricating" blind spots for periods we have no evidence about
    // but also have no evidence of failure.
    const lastSuccessTime = new Date(lastSuccessfulTime);
    const analysisEnd = new Date(analysis_window.end);

    // Only create post-analysis gap if it would be very long (> 7 days)
    // to avoid fabricating blind spots just because the analysis window ended
    if (analysisEnd > lastSuccessTime) {
      const duration = computeDaysBetween(lastSuccessfulTime, analysis_window.end);
      // Only create blind spot for very long post-window gaps
      if (duration > 7) {
        blind_spot_periods.push({
          start_time: lastSuccessfulTime,
          end_time: analysis_window.end,
          reason: 'unknown',
          reason_description: 'No snapshot runs after last successful snapshot',
          duration_days: duration,
          severity: duration > 14 ? 'critical' : 'high',
        });
      }
    }
  } else {
    // No snapshot runs at all in window
    // If there's an install date, the no-runs period starts after install
    // Otherwise it spans the entire window
    const noRunsStart = first_install_date || analysis_window.start;
    const duration = computeDaysBetween(noRunsStart, analysis_window.end);

    blind_spot_periods.push({
      start_time: noRunsStart,
      end_time: analysis_window.end,
      reason: 'unknown',
      reason_description: 'No snapshot data available for analysis window',
      duration_days: duration,
      severity: 'critical',
    });
  }

  // Merge overlapping or adjacent periods
  const merged = mergeBlindSpots(blind_spot_periods);

  // Compute coverage
  const totalDays = computeDaysBetween(
    analysis_window.start,
    analysis_window.end
  );
  const totalBlindDays = merged.reduce((sum, period) => sum + period.duration_days, 0);
  const coverage = ((totalDays - totalBlindDays) / totalDays) * 100;

  const map: BlindSpotMap = {
    tenant_id,
    computed_at: new Date().toISOString(),
    analysis_start: analysis_window.start,
    analysis_end: analysis_window.end,
    blind_spot_periods: merged,
    total_blind_days: totalBlindDays,
    coverage_percentage: Math.max(0, Math.min(100, coverage)),
    canonical_hash: '', // Computed below
    schema_version: '1.0',
  };

  // Compute hash
  map.canonical_hash = computeBlindSpotHash(map);

  return map;
}

/**
 * Helper: Get static text description for reason
 */
function getReasonDescription(reason: BlindSpotReason, failureReason?: string): string {
  switch (reason) {
    case 'not_installed':
      return 'FirstTry was not installed during this period';
    case 'permission_missing':
      return 'Insufficient permissions to capture snapshots during this period';
    case 'snapshot_failed':
      return `Snapshot execution failed: ${failureReason || 'unknown error'}`;
    case 'unknown':
      return 'No evidence available for this period (reason unknown)';
  }
}

/**
 * Merge overlapping or adjacent blind spot periods with the same reason
 */
function mergeBlindSpots(periods: BlindSpotPeriod[]): BlindSpotPeriod[] {
  if (periods.length === 0) return [];

  const sorted = [...periods].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const merged: BlindSpotPeriod[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const currentEnd = new Date(current.end_time);
    const nextStart = new Date(next.start_time);
    const gapMinutes = (nextStart.getTime() - currentEnd.getTime()) / 1000 / 60;

    // Only merge if adjacent (< 1 hour gap) AND same reason
    if (gapMinutes < 60 && current.reason === next.reason) {
      current.end_time = next.end_time;
      current.duration_days = computeDaysBetween(current.start_time, current.end_time);
      // Keep most severe reason (should be same)
      if (next.severity === 'critical') current.severity = 'critical';
      else if (next.severity === 'high' && current.severity !== 'critical') {
        current.severity = 'high';
      }
    } else {
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}

// ============================================================================
// HASHING & VERIFICATION
// ============================================================================

/**
 * Compute canonical hash of blind-spot map
 */
export function computeBlindSpotHash(map: BlindSpotMap): string {
  const { createHash } = require('crypto');

  // Create canonical form (exclude canonical_hash and computed_at for deterministic hashing)
  // computed_at changes every run, so exclude it
  // canonical_hash is what we're computing, so exclude it
  const hashData = {
    analysis_end: map.analysis_end,
    analysis_start: map.analysis_start,
    blind_spot_periods: map.blind_spot_periods
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((p) => ({
        duration_days: p.duration_days,
        end_time: p.end_time,
        reason: p.reason,
        reason_description: p.reason_description,
        severity: p.severity,
        start_time: p.start_time,
      })),
    coverage_percentage: map.coverage_percentage,
    schema_version: map.schema_version,
    tenant_id: map.tenant_id,
    total_blind_days: map.total_blind_days,
  };

  // Build canonical JSON string with explicitly sorted keys to ensure deterministic hashing
  // JavaScript's JSON.stringify doesn't guarantee key order, so we must build it manually
  const sortedKeys = [
    'analysis_end',
    'analysis_start',
    'blind_spot_periods',
    'coverage_percentage',
    'schema_version',
    'tenant_id',
    'total_blind_days',
  ];
  let canonical = '{';
  for (let i = 0; i < sortedKeys.length; i++) {
    const key = sortedKeys[i];
    const value = (hashData as any)[key];
    const jsonVal = JSON.stringify(value);
    canonical += `"${key}":${jsonVal}`;
    if (i < sortedKeys.length - 1) {
      canonical += ',';
    }
  }
  canonical += '}';

  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Verify blind-spot map integrity
 */
export function verifyBlindSpotHash(map: BlindSpotMap): boolean {
  const recomputed = computeBlindSpotHash(map);
  return recomputed === map.canonical_hash;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Compute days between two ISO 8601 timestamps
 */
function computeDaysBetween(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  return diffMs / 1000 / 60 / 60 / 24;
}

/**
 * UI: Render blind-spot timeline for admin
 */
export function renderBlindSpotTimeline(map: BlindSpotMap): string {
  const lines = [
    '<div class="blind-spot-timeline">',
    '<h3>Governance Evidence Timeline</h3>',
    `<p>Coverage: <strong>${map.coverage_percentage.toFixed(1)}%</strong></p>`,
    `<p>Total blind days: <strong>${map.total_blind_days.toFixed(1)}</strong></p>`,
    '<div class="timeline">',
  ];

  const windowDays = computeDaysBetween(map.analysis_start, map.analysis_end);
  const segmentWidth = 100 / windowDays;

  for (const period of map.blind_spot_periods) {
    const startOffset = computeDaysBetween(map.analysis_start, period.start_time);
    const width = (period.duration_days / windowDays) * 100;
    const color =
      period.reason === 'not_installed' ? '#999' :
      period.reason === 'permission_missing' ? '#f44' :
      period.reason === 'snapshot_failed' ? '#fa4' :
      '#ddd';

    lines.push(`
      <div class="timeline-segment" 
           style="left: ${(startOffset / windowDays) * 100}%; width: ${width}%"
           title="${period.reason}: ${period.reason_description}"
           style="background-color: ${color}">
        <span>${period.reason}</span>
      </div>
    `);
  }

  lines.push('</div>', '</div>');
  return lines.join('\n');
}

/**
 * UI: Render blind-spot table for admin
 */
export function renderBlindSpotTable(map: BlindSpotMap): string {
  const lines = [
    '<table class="blind-spot-table">',
    '<thead>',
    '<tr>',
    '<th>Period</th>',
    '<th>Reason</th>',
    '<th>Duration (Days)</th>',
    '<th>Severity</th>',
    '</tr>',
    '</thead>',
    '<tbody>',
  ];

  for (const period of map.blind_spot_periods) {
    const startDate = new Date(period.start_time).toLocaleDateString();
    const endDate = new Date(period.end_time).toLocaleDateString();
    const severityColor =
      period.severity === 'critical' ? '#f00' :
      period.severity === 'high' ? '#fa0' :
      '#00a';

    lines.push(`
      <tr style="border-left: 4px solid ${severityColor}">
        <td>${startDate} — ${endDate}</td>
        <td>${period.reason}</td>
        <td>${period.duration_days.toFixed(2)}</td>
        <td>${period.severity}</td>
      </tr>
    `);
  }

  lines.push('</tbody>', '</table>');
  return lines.join('\n');
}

/**
 * Generate audit report
 */
export function generateBlindSpotReport(map: BlindSpotMap): string {
  const lines = [
    '# GOVERNANCE EVIDENCE GAP ANALYSIS',
    '',
    `**Tenant:** ${map.tenant_id}`,
    `**Analysis Period:** ${map.analysis_start} to ${map.analysis_end}`,
    `**Coverage:** ${map.coverage_percentage.toFixed(1)}%`,
    `**Total Blind Days:** ${map.total_blind_days.toFixed(1)}`,
    '',
    '## Unknown Periods (Blind Spots)',
    '',
  ];

  if (map.blind_spot_periods.length === 0) {
    lines.push('No blind spots detected. Full coverage during analysis period.');
  } else {
    for (const period of map.blind_spot_periods) {
      const severity = period.severity.toUpperCase();
      lines.push(`### ${period.reason.toUpperCase()} [${severity}]`);
      lines.push(`- **Period:** ${period.start_time} to ${period.end_time}`);
      lines.push(`- **Duration:** ${period.duration_days.toFixed(2)} days`);
      lines.push(`- **Reason:** ${period.reason_description}`);
      lines.push('');
    }
  }

  lines.push('## Key Facts');
  lines.push('- Blind spots represent periods with NO governance evidence');
  lines.push('- Red/grey areas on timeline = no evidence');
  lines.push('- Green areas = evidence exists');
  lines.push('- Each blind spot reason is factual, not inferred');
  lines.push('- Coverage percentage = (evidence days / total days) × 100%');

  return lines.join('\n');
}
