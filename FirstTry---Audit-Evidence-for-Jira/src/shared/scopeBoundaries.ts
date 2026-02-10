/**
 * SCOPE BOUNDARIES & EXPLICIT NON-GOALS
 * 
 * This is the SINGLE SOURCE OF TRUTH for all scope copy rendered in the dashboard.
 * Updated to reflect OPTION 2: Scheduled triggers and snapshots exist.
 */

export const SCOPE_BOUNDARIES_COPY = `
## Scope Boundaries & Explicit Non-Goals

### What FirstTry Governance Does ✅

- **Read-Only Assessment**: FirstTry audits your Jira workspace for configuration quality, compliance readiness, and governance best practices. **No changes are made to your Jira data.**
- **Scheduled Collection**: Background jobs run automatically on a configurable schedule (every 5 minutes to detect state changes quickly; weekly snapshots for audit trails).
- **Snapshot Storage**: Assessment snapshots are retained in Atlassian Forge storage for timeline analysis and historical verification.
- **Export Capabilities**: 
  - When snapshots exist: Export canonical audit snapshots as JSON (machine-readable) and PDF (human-readable).
  - When snapshot export is unavailable: Export current dashboard state for manual documentation.
- **Dashboard Gadget**: Real-time governance status dashboard shows health, data freshness, scheduler status, and retention metrics.
- **Token Refresh**: OAuth tokens are automatically refreshed to maintain continuity (refresh tokens every 12 hours).
- **Deterministic Audit Trail**: All operations logged with correlation IDs for verification and debugging.

### What FirstTry Does NOT Do ❌

- **No Jira Writes**: FirstTry will never modify Jira configurations, create issues, or alter any Jira data. Read scopes only.
- **No External Egress**: Assessment results are not sent outside Atlassian's infrastructure.
- **No Cross-Workspace Access**: FirstTry operates only within the workspace where it is installed.
- **No User Data Collection**: FirstTry does not collect personal information beyond tenant identity verification.

### Guaranteed Operations

1. **Read-Only Guarantees**: Every resolver, scheduled job, and export function is read-only. Storage operations only persist audit snapshots.
2. **No Scope Expansion**: New phases (if any) will never add write scopes, delete scopes, or external API access.
3. **Transparent Operation**: All markers and correlation IDs are visible in logs for independent verification.
4. **Deterministic State**: Dashboard state is computed from explicit signals; no contradictory combinations (e.g., "Fresh" without data) are possible.

### Data Retention

- **Snapshots**: Retained for 30 days in Forge storage (configurable retention policy per workspace).
- **Logs**: Accessible via \`forge logs\` for the current environment (typically 7-30 days depending on Forge service SLA).
- **No Permanent External Storage**: Assessment results are never persisted outside Atlassian infrastructure.

### Operational Guarantees (Option 2 Reality)

Because FirstTry uses scheduled triggers:
- ✅ Background jobs run automatically (no user interaction required for collection).
- ✅ Snapshots are generated and stored on schedule.
- ✅ If no successful runs yet, dashboard shows "Awaiting first run" state (not "Never configured").
- ✅ Scheduler status is deterministically computed from last run timestamp and job failure history.

Because FirstTry uses Forge storage:
- ✅ Snapshots persist across gadget refreshes.
- ✅ Export functions produce consistent, canonical output based on stored snapshots.
- ✅ Storage status is always explicitly tracked (empty, nonempty, or error).
`;

export const SCOPE_BOUNDARIES_HTML = `
<div class="scope-boundaries">
  <h2>Scope Boundaries & Explicit Non-Goals</h2>
  <h3>What FirstTry Governance Does ✅</h3>
  <ul>
    <li><strong>Read-Only Assessment:</strong> FirstTry audits your Jira workspace for configuration quality, compliance readiness, and governance best practices. <strong>No changes are made to your Jira data.</strong></li>
    <li><strong>Scheduled Collection:</strong> Background jobs run automatically on a configurable schedule (every 5 minutes to detect state changes quickly; weekly snapshots for audit trails).</li>
    <li><strong>Snapshot Storage:</strong> Assessment snapshots are retained in Atlassian Forge storage for timeline analysis and historical verification.</li>
    <li><strong>Export Capabilities:</strong>
      <ul>
        <li>When snapshots exist: Export canonical audit snapshots as JSON (machine-readable) and PDF (human-readable).</li>
        <li>When snapshot export is unavailable: Export current dashboard state for manual documentation.</li>
      </ul>
    </li>
    <li><strong>Dashboard Gadget:</strong> Real-time governance status dashboard shows health, data freshness, scheduler status, and retention metrics.</li>
    <li><strong>Token Refresh:</strong> OAuth tokens are automatically refreshed to maintain continuity (refresh tokens every 12 hours).</li>
    <li><strong>Deterministic Audit Trail:</strong> All operations logged with correlation IDs for verification and debugging.</li>
  </ul>

  <h3>What FirstTry Does NOT Do ❌</h3>
  <ul>
    <li><strong>No Jira Writes:</strong> FirstTry will never modify Jira configurations, create issues, or alter any Jira data. Read scopes only.</li>
    <li><strong>No External Egress:</strong> Assessment results are not sent outside Atlassian's infrastructure.</li>
    <li><strong>No Cross-Workspace Access:</strong> FirstTry operates only within the workspace where it is installed.</li>
    <li><strong>No User Data Collection:</strong> FirstTry does not collect personal information beyond tenant identity verification.</li>
  </ul>

  <h3>Guaranteed Operations</h3>
  <ol>
    <li><strong>Read-Only Guarantees:</strong> Every resolver, scheduled job, and export function is read-only. Storage operations only persist audit snapshots.</li>
    <li><strong>No Scope Expansion:</strong> New phases (if any) will never add write scopes, delete scopes, or external API access.</li>
    <li><strong>Transparent Operation:</strong> All markers and correlation IDs are visible in logs for independent verification.</li>
    <li><strong>Deterministic State:</strong> Dashboard state is computed from explicit signals; no contradictory combinations (e.g., "Fresh" without data) are possible.</li>
  </ol>

  <h3>Data Retention</h3>
  <ul>
    <li><strong>Snapshots:</strong> Retained for 30 days in Forge storage (configurable retention policy per workspace).</li>
    <li><strong>Logs:</strong> Accessible via <code>forge logs</code> for the current environment (typically 7-30 days depending on Forge service SLA).</li>
    <li><strong>No Permanent External Storage:</strong> Assessment results are never persisted outside Atlassian infrastructure.</li>
  </ul>

  <h3>Operational Guarantees (Scheduled Triggers & Snapshots)</h3>
  <ul>
    <li>✅ Background jobs run automatically (no user interaction required for collection).</li>
    <li>✅ Snapshots are generated and stored on schedule.</li>
    <li>✅ If no successful runs yet, dashboard shows "Awaiting first run" state (not "Never configured").</li>
    <li>✅ Scheduler status is deterministically computed from last run timestamp and job failure history.</li>
    <li>✅ Snapshots persist across gadget refreshes (using Forge storage).</li>
    <li>✅ Export functions produce consistent, canonical output based on stored snapshots.</li>
    <li>✅ Storage status is always explicitly tracked (empty, nonempty, or error).</li>
  </ul>
</div>
`;
