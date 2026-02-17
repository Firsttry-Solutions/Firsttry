/**
 * Executive Summary Export (Deterministic HTML)
 * 
 * FT_PROOF_EXEC_SUMMARY_EXPORT_v1
 * 
 * Generate HTML executive summary from stored state.
 * Deterministic. No dynamic Date. Inline CSS only. No external assets.
 */

import { buildLifecyclePanelState } from "../enterprise/lifecyclePanel";
import { getStorageMetrics } from "../enterprise/storageMetrics";
import { detectPossibleRestore } from "../enterprise/restoreHeuristic";
import { getVerifyAudit } from "../enterprise/verifyAudit";
import { getSnapshotFrequency } from "../enterprise/snapshotFrequency";

/**
 * Generate executive summary HTML
 * 
 * Sections (fixed order):
 * 1. Verification status
 * 2. Risk score
 * 3. Drift SLA stats
 * 4. Last certification
 * 5. Storage metrics
 * 6. Snapshot frequency
 * 7. Restore suspicion
 * 8. Constraints disclosure
 */
export async function generateExecutiveSummaryHtml(
  tenantKey: string,
  snapshot?: any
): Promise<string> {
  // Gather all data
  const lifecycle = await buildLifecyclePanelState(tenantKey, snapshot || {});
  const storage = await getStorageMetrics(tenantKey);
  const restoreDetection = await detectPossibleRestore(tenantKey);
  const verify = await getVerifyAudit(tenantKey);
  const frequency = await getSnapshotFrequency(tenantKey);

  // Extract or compute metrics (with graceful fallbacks)
  const riskScore = snapshot?.riskScore ?? 0;
  const driftCount = snapshot?.unresolvedDrifts ?? 0;
  const shadowAdminCount = snapshot?.shadowAdmins ?? 0;

  // Compute quarter from current storage state (approx)
  const quarter = lifecycle.ledgerCreatedAtUtc
    ? `Q${Math.ceil((parseInt(lifecycle.ledgerCreatedAtUtc.slice(5, 7), 10) || 1) / 3)}`
    : "Unknown";

  // HTML template
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FirstTry Executive Summary</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 30px;
    }
    h1 {
      color: #0052cc;
      border-bottom: 3px solid #0052cc;
      padding-bottom: 10px;
    }
    h2 {
      color: #003366;
      margin-top: 30px;
      border-left: 4px solid #0052cc;
      padding-left: 12px;
    }
    .metric {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin: 15px 0;
    }
    .metric-box {
      background-color: #f9f9f9;
      border-left: 4px solid #0052cc;
      padding: 15px;
      border-radius: 4px;
    }
    .metric-box label {
      font-weight: 600;
      color: #555;
      display: block;
      margin-bottom: 5px;
    }
    .metric-box value {
      font-size: 1.2em;
      color: #0052cc;
      font-weight: 700;
    }
    .status-ok { color: #22862e; font-weight: 600; }
    .status-warning { color: #d4a000; font-weight: 600; }
    .status-critical { color: #cb2431; font-weight: 600; }
    .constraints-panel {
      background-color: #f0f7ff;
      border: 1px solid #0052cc;
      border-radius: 4px;
      padding: 20px;
      margin: 20px 0;
    }
    .constraints-panel h3 {
      color: #0052cc;
      margin-top: 0;
    }
    .constraint-item {
      margin: 10px 0;
      padding-left: 20px;
    }
    .constraint-item:before {
      content: "✓";
      display: inline-block;
      width: 20px;
      margin-left: -20px;
      color: #22862e;
      font-weight: bold;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th, td {
      text-align: left;
      padding: 12px;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #f5f5f5;
      font-weight: 600;
      color: #333;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 0.9em;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>FirstTry Executive Summary</h1>
    <p><em>Generated from stored state. All metrics deterministic from ledger blocks.</em></p>

    <h2>1. Verification Status</h2>
    <div class="metric">
      <div class="metric-box">
        <label>Last Window Verify</label>
        <value class="${verify.lastWindowStatus === 'OK_VERIFIED' ? 'status-ok' : verify.lastWindowStatus === 'FAIL_MISMATCH' ? 'status-critical' : 'status-warning'}">
          ${verify.lastWindowStatus || 'Not yet run'}
        </value>
      </div>
      <div class="metric-box">
        <label>Last Window Verify Time</label>
        <value>${verify.lastWindowVerifyAtUtc ? verify.lastWindowVerifyAtUtc.slice(0, 10) : 'Never'}</value>
      </div>
    </div>

    <h2>2. Risk Profile</h2>
    <div class="metric">
      <div class="metric-box">
        <label>Overall Risk Score</label>
        <value class="${riskScore < 30 ? 'status-ok' : riskScore < 70 ? 'status-warning' : 'status-critical'}">
          ${riskScore}
        </value>
      </div>
      <div class="metric-box">
        <label>Shadow Admins Detected</label>
        <value class="${shadowAdminCount === 0 ? 'status-ok' : 'status-warning'}">
          ${shadowAdminCount}
        </value>
      </div>
    </div>
    <div class="metric">
      <div class="metric-box">
        <label>Unresolved Drifts</label>
        <value class="${driftCount === 0 ? 'status-ok' : 'status-warning'}">
          ${driftCount}
        </value>
      </div>
      <div class="metric-box">
        <label>Drift SLA Status</label>
        <value class="${driftCount === 0 ? 'status-ok' : 'status-warning'}">
          ${driftCount === 0 ? 'On Target' : 'At Risk'}
        </value>
      </div>
    </div>

    <h2>3. Storage & Lifecycle</h2>
    <div class="metric">
      <div class="metric-box">
        <label>Installation Age</label>
        <value>${lifecycle.ledgerCreatedAtUtc ? lifecycle.ledgerCreatedAtUtc.slice(0, 10) : 'Unknown'}</value>
      </div>
      <div class="metric-box">
        <label>Ledger Segments Retained</label>
        <value>${storage.segmentsRetained} / 8</value>
      </div>
    </div>
    <div class="metric">
      <div class="metric-box">
        <label>Total Ledger Blocks</label>
        <value>${storage.totalBlocks}</value>
      </div>
      <div class="metric-box">
        <label>Estimated Storage</label>
        <value>${(storage.estimatedSizeBytes / 1024).toFixed(1)} KB</value>
      </div>
    </div>

    <h2>4. Snapshot Behavior</h2>
    <div class="metric">
      <div class="metric-box">
        <label>Snapshot Collection Frequency</label>
        <value>${frequency.bucket || 'Unknown'}</value>
      </div>
      <div class="metric-box">
        <label>Average Interval</label>
        <value>${frequency.avgHours ? frequency.avgHours + ' hours' : 'Unknown'}</value>
      </div>
    </div>

    <h2>5. Integrity & Restore Detection</h2>
    <div class="metric">
      <div class="metric-box">
        <label>Reset/Restore Suspected</label>
        <value class="${restoreDetection.suspected ? 'status-warning' : 'status-ok'}">
          ${restoreDetection.suspected ? 'Yes' : 'No'}
        </value>
      </div>
      <div class="metric-box">
        <label>Install ID</label>
        <value>${lifecycle.installationId ? lifecycle.installationId.slice(0, 16) + '...' : 'Not assigned'}</value>
      </div>
    </div>
    ${
      restoreDetection.suspected && restoreDetection.reason
        ? `<p><em style="color: #d4a000;">⚠️ ${restoreDetection.reason}</em></p>`
        : ''
    }

    <h2>6. What This Tool Does <em>NOT</em> Do</h2>
    <div class="constraints-panel">
      <h3>Architectural Constraints (Non-Negotiable)</h3>
      <div class="constraint-item">Does NOT create new scopes or request additional permissions</div>
      <div class="constraint-item">Does NOT make outbound network calls (all local computation)</div>
      <div class="constraint-item">Does NOT write to Jira (read-only analysis)</div>
      <div class="constraint-item">Does NOT store PII (all hashes and identifiers are salted)</div>
      <div class="constraint-item">Does NOT introduce new package dependencies</div>
      <div class="constraint-item">Does NOT modify manifest configuration (unchanged scopes)</div>
      <div class="constraint-item">All outputs deterministic from stored state (no runtime randomness)</div>
      <div class="constraint-item">Verification always fail-closed on any data inconsistency</div>
    </div>

    <div class="footer">
      <p><strong>Generated</strong>: Deterministic from ledger blocks</p>
      <p><strong>Format</strong>: ft-executive-summary@1</p>
      <p><strong>Tenant Hash</strong>: ${lifecycle.tenantKeyHash16}</p>
    </div>
  </div>
</body>
</html>`;

  return html;
}
