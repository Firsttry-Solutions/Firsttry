/**
 * Phase 9.5-E: Auto-Repair Disclosure Log
 *
 * Logs when FirstTry self-heals and recovers from transient issues.
 *
 * CORE PRINCIPLE: Disclose self-recovery without claiming to "fix" anything.
 * This is informational logging about FirstTry's own resilience mechanisms.
 *
 * CRITICAL RULE: No modifications to Jira. No suggestions. Read-only only.
 * We only log what FirstTry does internally to recover from failures.
 */

import crypto from 'crypto';

/**
 * Types of auto-recovery that FirstTry performs.
 * These are FirstTry's own internal mechanisms, not Jira modifications.
 */
export type RepairType =
  | 'retry' // Retried a failed operation (without changing config)
  | 'pagination_adjust' // Adjusted pagination size for overloaded endpoint
  | 'fallback_endpoint' // Switched to fallback API endpoint
  | 'partial_degrade' // Degraded gracefully (fewer features, still functional)
  | 'connection_reset' // Reset connection pool after timeout
  | 'cache_invalidate' // Invalidated cache to retry fresh
  | 'timeout_extend'; // Extended timeout for slow endpoint

/**
 * Outcome of a repair attempt.
 */
export type RepairOutcome = 'success' | 'partial' | 'failed';

/**
 * Reason that triggered the auto-repair.
 * These are symptoms FirstTry observed, not root causes.
 */
export type RepairTriggerReason =
  | 'timeout' // Operation took too long
  | 'rate_limit' // Hit rate limit (429)
  | 'service_unavailable' // Endpoint unavailable (503)
  | 'partial_failure' // Some requests succeeded, some failed
  | 'connection_error' // Network/connection issue
  | 'malformed_response' // API returned unexpected format
  | 'quota_exceeded' // Hit usage quota
  | 'unknown'; // Symptoms observed but reason unclear

/**
 * A single auto-repair event in the disclosure log.
 * Read-only record of FirstTry's self-healing.
 */
export interface AutoRepairEvent {
  // Identity
  event_id: string; // UUID
  tenant_id: string;
  timestamp: string; // ISO 8601 UTC

  // What happened
  repair_type: RepairType;
  trigger_reason: RepairTriggerReason;
  outcome: RepairOutcome;

  // Context
  affected_operation: string; // e.g., "snapshot_capture", "field_analysis"
  linked_snapshot_run_id: string | null; // If applicable
  attempt_number: number; // 1st, 2nd, 3rd retry etc.

  // Details (no Jira modifications recorded here)
  details: {
    original_error?: string; // Original error message (if available)
    repair_duration_ms: number; // How long the repair took
    success_after_repair: boolean; // Did it work after repair?
  };

  // Metadata
  schema_version: string; // "1.0"
  first_try_version: string; // FirstTry version at time of event
}

/**
 * Auto-repair disclosure log for a tenant.
 * Immutable record of all self-recovery events.
 */
export interface AutoRepairLog {
  // Identity
  tenant_id: string;
  computed_at: string; // ISO 8601 UTC
  schema_version: string; // "1.0"

  // Events
  events: AutoRepairEvent[];
  total_events: number;
  events_by_outcome: {
    success: number;
    partial: number;
    failed: number;
  };

  // Summary statistics (no interpretation, just counts)
  repair_type_breakdown: Record<RepairType, number>;
  trigger_reason_breakdown: Record<RepairTriggerReason, number>;
  total_repair_attempts: number;
  success_rate: number; // successful_outcomes / total_outcomes

  // Integrity
  canonical_hash: string; // SHA-256

  // Metadata
  time_period_start: string; // ISO 8601 UTC
  time_period_end: string; // ISO 8601 UTC
}

/**
 * Create a new auto-repair event.
 * Called by FirstTry internal recovery mechanisms.
 */
export function createAutoRepairEvent(params: {
  tenant_id: string;
  repair_type: RepairType;
  trigger_reason: RepairTriggerReason;
  outcome: RepairOutcome;
  affected_operation: string;
  linked_snapshot_run_id?: string;
  attempt_number?: number;
  original_error?: string;
  repair_duration_ms: number;
  success_after_repair: boolean;
  first_try_version?: string;
}): AutoRepairEvent {
  return {
    event_id: crypto.randomUUID(),
    tenant_id: params.tenant_id,
    timestamp: new Date().toISOString(),
    repair_type: params.repair_type,
    trigger_reason: params.trigger_reason,
    outcome: params.outcome,
    affected_operation: params.affected_operation,
    linked_snapshot_run_id: params.linked_snapshot_run_id || null,
    attempt_number: params.attempt_number || 1,
    details: {
      original_error: params.original_error,
      repair_duration_ms: params.repair_duration_ms,
      success_after_repair: params.success_after_repair,
    },
    schema_version: '1.0',
    first_try_version: params.first_try_version || 'unknown',
  };
}

/**
 * Build auto-repair disclosure log from events.
 */
export function buildAutoRepairLog(
  tenant_id: string,
  events: AutoRepairEvent[],
  timePeriod?: { start: string; end: string }
): AutoRepairLog {
  const now = new Date().toISOString();
  const periodStart = timePeriod?.start || events[0]?.timestamp || now;
  const periodEnd = timePeriod?.end || events[events.length - 1]?.timestamp || now;

  // Count outcomes
  const eventsByOutcome = {
    success: events.filter((e) => e.outcome === 'success').length,
    partial: events.filter((e) => e.outcome === 'partial').length,
    failed: events.filter((e) => e.outcome === 'failed').length,
  };

  // Count repair types
  const repairTypeBreakdown = {
    retry: 0,
    pagination_adjust: 0,
    fallback_endpoint: 0,
    partial_degrade: 0,
    connection_reset: 0,
    cache_invalidate: 0,
    timeout_extend: 0,
  } as Record<RepairType, number>;

  events.forEach((event) => {
    repairTypeBreakdown[event.repair_type]++;
  });

  // Count trigger reasons
  const triggerReasonBreakdown = {
    timeout: 0,
    rate_limit: 0,
    service_unavailable: 0,
    partial_failure: 0,
    connection_error: 0,
    malformed_response: 0,
    quota_exceeded: 0,
    unknown: 0,
  } as Record<RepairTriggerReason, number>;

  events.forEach((event) => {
    triggerReasonBreakdown[event.trigger_reason]++;
  });

  // Calculate success rate (successful outcomes only, not partial)
  const totalOutcomes = eventsByOutcome.success + eventsByOutcome.partial + eventsByOutcome.failed;
  const successRate = totalOutcomes > 0 ? (eventsByOutcome.success / totalOutcomes) * 100 : 0;

  const log: AutoRepairLog = {
    tenant_id,
    computed_at: now,
    schema_version: '1.0',
    events,
    total_events: events.length,
    events_by_outcome: eventsByOutcome,
    repair_type_breakdown: repairTypeBreakdown,
    trigger_reason_breakdown: triggerReasonBreakdown,
    total_repair_attempts: events.length,
    success_rate: Math.round(successRate * 100) / 100,
    canonical_hash: '', // Set below
    time_period_start: periodStart,
    time_period_end: periodEnd,
  };

  // Compute hash
  log.canonical_hash = computeAutoRepairLogHash(log);

  return log;
}

/**
 * Compute canonical SHA-256 hash of auto-repair log.
 * Ensures data integrity in storage.
 */
export function computeAutoRepairLogHash(log: Omit<AutoRepairLog, 'canonical_hash'>): string {
  // Build canonical string (simplified version without events array)
  const sortedKeys = [
    'computed_at',
    'events_by_outcome',
    'repair_type_breakdown',
    'schema_version',
    'success_rate',
    'tenant_id',
    'time_period_end',
    'time_period_start',
    'total_events',
    'total_repair_attempts',
    'trigger_reason_breakdown',
  ];

  let canonical = '';
  for (const key of sortedKeys) {
    const value = (log as Record<string, unknown>)[key];
    if (value === null || value === undefined) {
      canonical += `${key}:null;`;
    } else if (typeof value === 'object') {
      const sorted = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
      canonical += `${key}:{${sorted.map(([k, v]) => `${k}:${v}`).join(',')}}`;
    } else if (typeof value === 'number') {
      canonical += `${key}:${value};`;
    } else {
      canonical += `${key}:${String(value)};`;
    }
  }

  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Verify auto-repair log integrity.
 */
export function verifyAutoRepairLogHash(log: AutoRepairLog): boolean {
  const { canonical_hash, ...logWithoutHash } = log;
  const computedHash = computeAutoRepairLogHash(logWithoutHash as Omit<AutoRepairLog, 'canonical_hash'>);
  return computedHash === canonical_hash;
}

/**
 * Render auto-repair log as HTML timeline.
 * Read-only informational display for admin UI.
 */
export function renderAutoRepairTimelineHtml(log: AutoRepairLog): string {
  const eventsByDate = log.events.reduce(
    (acc, event) => {
      const date = new Date(event.timestamp).toLocaleDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push(event);
      return acc;
    },
    {} as Record<string, AutoRepairEvent[]>
  );

  let html = `
<div class="auto-repair-timeline">
  <h3>System Self-Recovery Events</h3>
  <p class="subtitle">FirstTry's automatic resilience mechanisms</p>
  
  <div class="timeline-summary">
    <div class="summary-stat">
      <span class="label">Total Events</span>
      <span class="value">${log.total_events}</span>
    </div>
    <div class="summary-stat">
      <span class="label">Success Rate</span>
      <span class="value">${log.success_rate.toFixed(1)}%</span>
    </div>
    <div class="summary-stat">
      <span class="label">Period</span>
      <span class="value">${new Date(log.time_period_start).toLocaleDateString()} - ${new Date(log.time_period_end).toLocaleDateString()}</span>
    </div>
  </div>

  <div class="timeline-events">
`;

  // Sort dates in reverse (newest first)
  const sortedDates = Object.keys(eventsByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  for (const date of sortedDates) {
    html += `<div class="timeline-date"><h4>${date}</h4>`;

    for (const event of eventsByDate[date]) {
      const outcomeClass = `outcome-${event.outcome}`;
      const time = new Date(event.timestamp).toLocaleTimeString();

      html += `
    <div class="timeline-event ${outcomeClass}">
      <div class="event-time">${time}</div>
      <div class="event-repair-type">${event.repair_type}</div>
      <div class="event-trigger">${event.trigger_reason}</div>
      <div class="event-outcome">${event.outcome}</div>
      <div class="event-operation">${event.affected_operation}</div>
      <div class="event-duration">${event.details.repair_duration_ms}ms</div>
    </div>
`;
    }

    html += '</div>';
  }

  html += `
  </div>

  <div class="timeline-breakdown">
    <div class="breakdown-section">
      <h4>By Repair Type</h4>
      <ul>
`;

  for (const [type, count] of Object.entries(log.repair_type_breakdown)) {
    if (count > 0) {
      html += `<li>${type}: ${count}</li>`;
    }
  }

  html += `
      </ul>
    </div>

    <div class="breakdown-section">
      <h4>By Trigger Reason</h4>
      <ul>
`;

  for (const [reason, count] of Object.entries(log.trigger_reason_breakdown)) {
    if (count > 0) {
      html += `<li>${reason}: ${count}</li>`;
    }
  }

  html += `
      </ul>
    </div>
  </div>
</div>
  `;

  return html;
}

/**
 * Render auto-repair log as table.
 */
export function renderAutoRepairTableHtml(log: AutoRepairLog): string {
  const sortedEvents = [...log.events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  let html = `
<div class="auto-repair-table">
  <h3>Self-Recovery Events Detail</h3>
  <table class="repair-events-table">
    <thead>
      <tr>
        <th>Timestamp</th>
        <th>Repair Type</th>
        <th>Trigger</th>
        <th>Operation</th>
        <th>Outcome</th>
        <th>Duration</th>
        <th>Attempt</th>
      </tr>
    </thead>
    <tbody>
`;

  for (const event of sortedEvents) {
    const timestamp = new Date(event.timestamp).toLocaleString();
    html += `
      <tr class="outcome-${event.outcome}">
        <td>${timestamp}</td>
        <td>${event.repair_type}</td>
        <td>${event.trigger_reason}</td>
        <td>${event.affected_operation}</td>
        <td><strong>${event.outcome}</strong></td>
        <td>${event.details.repair_duration_ms}ms</td>
        <td>${event.attempt_number}</td>
      </tr>
`;
  }

  html += `
    </tbody>
  </table>
</div>
  `;

  return html;
}

/**
 * Export auto-repair log as JSON.
 */
export function exportAutoRepairLogJson(log: AutoRepairLog): Record<string, unknown> {
  return {
    // Summary
    total_events: log.total_events,
    success_rate: log.success_rate,
    time_period_start: log.time_period_start,
    time_period_end: log.time_period_end,

    // Breakdown
    events_by_outcome: log.events_by_outcome,
    repair_type_breakdown: log.repair_type_breakdown,
    trigger_reason_breakdown: log.trigger_reason_breakdown,

    // Events (full detail)
    events: log.events,

    // Integrity
    canonical_hash: log.canonical_hash,

    // Metadata
    tenant_id: log.tenant_id,
    computed_at: log.computed_at,
    schema_version: log.schema_version,
  };
}

/**
 * Generate markdown report of auto-repair events.
 */
export function generateAutoRepairReport(log: AutoRepairLog): string {
  return `# System Self-Recovery Events

## Summary

FirstTry successfully self-recovered from ${log.events_by_outcome.success} transient issues.
Success rate: **${log.success_rate.toFixed(1)}%**

## Statistics

| Metric | Value |
|--------|-------|
| Total Events | ${log.total_events} |
| Successful | ${log.events_by_outcome.success} |
| Partial | ${log.events_by_outcome.partial} |
| Failed | ${log.events_by_outcome.failed} |
| Period | ${log.time_period_start} to ${log.time_period_end} |

## Recovery Types Used

| Type | Count |
|------|-------|
${Object.entries(log.repair_type_breakdown)
  .filter(([, count]) => count > 0)
  .map(([type, count]) => `| ${type} | ${count} |`)
  .join('\n')}

## Trigger Reasons

| Reason | Count |
|--------|-------|
${Object.entries(log.trigger_reason_breakdown)
  .filter(([, count]) => count > 0)
  .map(([reason, count]) => `| ${reason} | ${count} |`)
  .join('\n')}

## Events (Recent First)

${log.events
  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  .slice(0, 20) // Show last 20
  .map(
    (event) =>
      `### ${new Date(event.timestamp).toLocaleString()}

- **Type:** ${event.repair_type}
- **Trigger:** ${event.trigger_reason}
- **Operation:** ${event.affected_operation}
- **Outcome:** ${event.outcome}
- **Duration:** ${event.details.repair_duration_ms}ms
- **Attempt:** #${event.attempt_number}
${event.linked_snapshot_run_id ? `- **Linked Run:** ${event.linked_snapshot_run_id}` : ''}
`
  )
  .join('\n')}

## Note

These are automatic recovery mechanisms within FirstTry. They represent FirstTry's resilience in the face of transient issues, not modifications to your Jira configuration.

---

**Computed:** ${log.computed_at}  
**Hash:** \`${log.canonical_hash}\`
`;
}
