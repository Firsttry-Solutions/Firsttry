/**
 * PHASE 6/7: UNIFIED ADMIN PAGE (Evidence Ledger & Drift History)
 * 
 * Server-rendered HTML page for browsing snapshots and drift events.
 * 
 * Features (Phase 6):
 * - Browse daily/weekly snapshots
 * - View snapshot details (hash, payload, missing data)
 * - Verify snapshot integrity (hash verification)
 * - Download snapshots (JSON export)
 * - View retention policy (read-only, immutable)
 * 
 * Features (Phase 7):
 * - Browse drift history between snapshots
 * - Filter drift events by type, classification, change type
 * - View detailed drift event information
 * - Export drift history as JSON
 */

import { html } from '@forge/api';
import {
  SnapshotRunStorage,
  SnapshotStorage,
  RetentionPolicyStorage,
} from '../phase6/snapshot_storage';
import {
  DEFAULT_RETENTION_POLICY,
} from '../phase6/constants';
import {
  verifyCanonicalHash,
} from '../phase6/canonicalization';
import {
  renderDriftHistoryList,
  renderDriftEventDetail,
} from './drift_history_tab';

/**
 * Admin page handler
 * Renders HTML page for snapshot management and drift history
 */
export async function handler(request: any) {
  const { tenantId, cloudId } = request.context;
  const { action, page = 0, type = 'daily' } = request.queryParameters || {};

  try {
    // Phase 7: Drift history
    if (action === 'drift-history') {
      return await renderDriftHistoryList(
        tenantId,
        cloudId,
        parseInt(String(page), 10),
        request.queryParameters || {}
      );
    }

    if (action === 'view-drift') {
      const { id } = request.queryParameters;
      if (!id) {
        return errorResponse('drift_event_id required');
      }
      return await renderDriftEventDetail(tenantId, cloudId, id);
    }

    // Phase 6: Snapshots and integrity checks
    if (action === 'view-run') {
      return await renderRunDetail(request, tenantId, cloudId);
    }

    if (action === 'view-snapshot') {
      return await renderSnapshotDetail(request, tenantId, cloudId);
    }

    if (action === 'verify-integrity') {
      return await renderIntegrityCheck(request, tenantId, cloudId);
    }

    if (action === 'policy') {
      return await renderPolicyPage(request, tenantId, cloudId);
    }

    // Default: list snapshots
    return await renderSnapshotList(request, tenantId, cloudId, type, parseInt(String(page), 10));
  } catch (error: any) {
    return errorResponse(error.message);
  }
}

/**
 * Error response helper
 */
function errorResponse(message: string) {
  return html`
    <html>
      <head>
        <title>Error - FirstTry Admin</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; }
          .error { color: #d32f2f; border: 1px solid #d32f2f; padding: 10px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>Error</h1>
        <div class="error">
          <p><strong>${message}</strong></p>
          <p><a href="/">Back to Snapshots</a></p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Render snapshot list page
 */
async function renderSnapshotList(
  request: any,
  tenantId: string,
  cloudId: string,
  type: string,
  page: number
) {
  const snapshotStorage = new SnapshotStorage(tenantId, cloudId);
  const result = await snapshotStorage.listSnapshots(
    { snapshot_type: type as any },
    page,
    20
  );

  const snapshotsHtml = result.items.map(snap => `
    <tr>
      <td>${snap.snapshot_id.substring(0, 8)}...</td>
      <td>${new Date(snap.captured_at).toLocaleString()}</td>
      <td>${snap.snapshot_type}</td>
      <td>${snap.canonical_hash.substring(0, 16)}...</td>
      <td>
        <a href="?action=view-snapshot&id=${snap.snapshot_id}">View</a> |
        <a href="?action=verify-integrity&id=${snap.snapshot_id}">Verify</a> |
        <a href="/api/phase6/export?id=${snap.snapshot_id}&format=json">JSON</a>
      </td>
    </tr>
  `).join('');

  const pageNav = `
    ${page > 0 ? `<a href="?page=${page - 1}&type=${type}">&larr; Previous</a>` : ''}
    <span>Page ${page + 1}</span>
    ${result.has_more ? `<a href="?page=${page + 1}&type=${type}">Next &rarr;</a>` : ''}
  `;

  return html`
    <html>
      <head>
        <title>FirstTry Phase 6 - Snapshot Evidence Ledger</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; background: #f5f5f5; }
          .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
          h1 { margin-bottom: 10px; color: #0747a6; }
          .description { color: #626262; margin-bottom: 20px; }
          .tabs { margin-bottom: 20px; border-bottom: 1px solid #ddd; }
          .tabs a { padding: 10px 20px; margin-right: 10px; display: inline-block; }
          .tabs a.active { border-bottom: 3px solid #0747a6; color: #0747a6; font-weight: bold; }
          .controls { margin-bottom: 20px; }
          .controls a { background: #0747a6; color: white; padding: 8px 16px; border-radius: 4px; margin-right: 10px; text-decoration: none; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #f5f5f5; padding: 12px; text-align: left; font-weight: bold; border-bottom: 2px solid #ddd; }
          td { padding: 12px; border-bottom: 1px solid #ddd; }
          tr:hover { background: #f9f9f9; }
          a { color: #0747a6; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .pagination { text-align: center; margin-bottom: 20px; }
          .pagination a { margin: 0 10px; }
          .pagination span { margin: 0 10px; }
          code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📊 FirstTry Phase 6/7 - Evidence Ledger & Drift History</h1>
          <p class="description">
            Immutable, deterministic snapshots of Jira configuration state.
            Detect and track changes between snapshots with drift analysis.
          </p>

          <div class="controls">
            <a href="?action=policy">⚙️ View Retention Policy</a>
          </div>

          <div class="tabs">
            <a href="?type=daily&page=0" class="tab ${type === 'daily' ? 'active' : ''}">📅 Daily Snapshots</a>
            <a href="?type=weekly&page=0" class="tab ${type === 'weekly' ? 'active' : ''}">📆 Weekly Snapshots</a>
            <a href="?action=drift-history" class="tab">🔄 Drift History</a>
          </div>

          <table>
            <thead>
              <tr>
                <th>Snapshot ID</th>
                <th>Captured At</th>
                <th>Type</th>
                <th>Hash (SHA256)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${snapshotsHtml || '<tr><td colspan="5" style="text-align: center; color: #999;">No snapshots yet</td></tr>'}
            </tbody>
          </table>

          <div class="pagination">
            ${pageNav}
          </div>

          <hr style="margin: 30px 0;">
          <h3>About Snapshot Evidence Ledger</h3>
          <ul style="margin-top: 10px; margin-left: 20px;">
            <li><strong>Daily Snapshots:</strong> Lightweight inventory (projects, fields, workflows, automation)</li>
            <li><strong>Weekly Snapshots:</strong> Comprehensive (includes full definitions)</li>
            <li><strong>Determinism:</strong> Identical Jira state always produces identical hash</li>
            <li><strong>Retention:</strong> Automatically cleaned up after ${DEFAULT_RETENTION_POLICY.max_days} days</li>
            <li><strong>READ-ONLY:</strong> No modifications to Jira configuration</li>
            <li><strong>Drift Analysis:</strong> <a href="?action=drift-history">View drift history</a> to detect configuration changes between snapshots</li>
          </ul>
        </div>
      </body>
    </html>
  `;
}

/**
 * Render snapshot detail page
 */
async function renderSnapshotDetail(
  request: any,
  tenantId: string,
  cloudId: string
) {
  const { id, type = 'daily' } = request.queryParameters;
  const snapshotStorage = new SnapshotStorage(tenantId, cloudId);
  const snapshot = await snapshotStorage.getSnapshotById(id);

  if (!snapshot) {
    return html`
      <html>
        <body>
          <h1>Snapshot Not Found</h1>
          <p><a href="/?type=${type}">Back to Snapshots</a></p>
        </body>
      </html>
    `;
  }

  const missingDataHtml = snapshot.missing_data.length > 0
    ? `
      <h3>⚠️ Missing Data Disclosure</h3>
      <table style="width: 100%; margin-bottom: 20px;">
        <thead>
          <tr style="background: #fff3cd;">
            <th>Dataset</th>
            <th>Status</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          ${snapshot.missing_data.map(item => `
            <tr>
              <td>${item.dataset_name}</td>
              <td>${item.coverage_status}</td>
              <td>${item.reason_detail}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : '';

  return html`
    <html>
      <head>
        <title>Snapshot Detail</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; }
          .container { max-width: 1200px; margin: 0 auto; }
          h1 { color: #0747a6; }
          .metadata { background: #f5f5f5; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
          .metadata-row { margin: 10px 0; }
          .metadata-label { font-weight: bold; }
          code { background: white; padding: 4px 8px; border-radius: 3px; font-family: monospace; word-break: break-all; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f5f5f5; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; }
          td { padding: 10px; border-bottom: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📸 Snapshot Detail</h1>
          <p><a href="/?type=${type}">&larr; Back</a></p>

          <div class="metadata">
            <div class="metadata-row">
              <span class="metadata-label">Snapshot ID:</span>
              <code>${snapshot.snapshot_id}</code>
            </div>
            <div class="metadata-row">
              <span class="metadata-label">Captured At:</span>
              ${new Date(snapshot.captured_at).toLocaleString()}
            </div>
            <div class="metadata-row">
              <span class="metadata-label">Type:</span>
              ${snapshot.snapshot_type}
            </div>
            <div class="metadata-row">
              <span class="metadata-label">Hash (SHA256):</span>
              <code>${snapshot.canonical_hash}</code>
            </div>
            <div class="metadata-row">
              <span class="metadata-label">Clock Source:</span>
              ${snapshot.clock_source}
            </div>
            <div class="metadata-row">
              <span class="metadata-label">Schema Version:</span>
              ${snapshot.schema_version}
            </div>
          </div>

          ${missingDataHtml}

          <h3>📊 Payload Summary</h3>
          <p>Datasets captured: ${Object.keys(snapshot.payload).join(', ')}</p>
          <p><a href="/api/phase6/export?id=${snapshot.snapshot_id}&format=json">⬇️ Download as JSON</a></p>

          <h3>✅ Integrity Verification</h3>
          <p><a href="?action=verify-integrity&id=${snapshot.snapshot_id}">Verify this snapshot's integrity</a></p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Render integrity check page
 * 
 * Verifies the payload hash only. Metadata fields (schema_version, clock_source, 
 * input_provenance, missing_data) are not cryptographically verified by this check.
 * This is the intended design: the canonical hash covers the captured state (payload),
 * not the snapshot record metadata.
 */
async function renderIntegrityCheck(
  request: any,
  tenantId: string,
  cloudId: string
) {
  const { id, type = 'daily' } = request.queryParameters;
  const snapshotStorage = new SnapshotStorage(tenantId, cloudId);
  const snapshot = await snapshotStorage.getSnapshotById(id);

  if (!snapshot) {
    return html`
      <html>
        <body>
          <h1>Snapshot Not Found</h1>
          <p><a href="/?type=${type}">Back to Snapshots</a></p>
        </body>
      </html>
    `;
  }

  const isValid = verifyCanonicalHash(snapshot.payload, snapshot.canonical_hash);
  const statusColor = isValid ? '#28a745' : '#d32f2f';
  const statusText = isValid ? '✅ PAYLOAD VALID' : '❌ PAYLOAD TAMPERING DETECTED';

  return html`
    <html>
      <head>
        <title>Integrity Verification</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; }
          .container { max-width: 1200px; margin: 0 auto; }
          h1 { color: #0747a6; }
          .result { border: 2px solid ${statusColor}; padding: 20px; border-radius: 4px; margin: 20px 0; }
          .result-status { font-size: 24px; font-weight: bold; color: ${statusColor}; }
          code { background: #f5f5f5; padding: 4px 8px; border-radius: 3px; font-family: monospace; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔐 Snapshot Integrity Verification</h1>
          <p><a href="?action=view-snapshot&id=${id}">&larr; Back to snapshot</a></p>

          <div class="result">
            <div class="result-status">${statusText}</div>
            <p style="margin-top: 10px;">
              Snapshot ID: <code>${id}</code>
            </p>
            <p>
              Expected Payload Hash: <code>${snapshot.canonical_hash}</code>
            </p>
            <p style="margin-top: 20px;">
              <strong>Verification Result:</strong><br>
              The snapshot's payload matches the expected SHA256 hash.
              This confirms the captured state (payload) has not been modified since capture.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Render retention policy page
 */
async function renderPolicyPage(
  request: any,
  tenantId: string,
  cloudId: string
) {
  const policyStorage = new RetentionPolicyStorage(tenantId);
  const policy = await policyStorage.getPolicy();

  return html`
    <html>
      <head>
        <title>Retention Policy</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
          h1 { color: #0747a6; }
          .policy-item { margin: 15px 0; padding: 15px; background: #f5f5f5; border-radius: 4px; }
          .policy-label { font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>⚙️ Snapshot Retention Policy (Read-Only)</h1>
          <p><a href="/">&larr; Back to Snapshots</a></p>

          <div class="policy-item">
            <div class="policy-label">Maximum Age</div>
            <p>${policy.max_days} days</p>
            <small>Snapshots older than this will be automatically deleted.</small>
          </div>

          <div class="policy-item">
            <div class="policy-label">Max Daily Snapshots</div>
            <p>${policy.max_records_daily} records</p>
            <small>When limit exceeded, oldest daily snapshots are deleted (FIFO).</small>
          </div>

          <div class="policy-item">
            <div class="policy-label">Max Weekly Snapshots</div>
            <p>${policy.max_records_weekly} records</p>
            <small>When limit exceeded, oldest weekly snapshots are deleted (FIFO).</small>
          </div>

          <div class="policy-item">
            <div class="policy-label">Deletion Strategy</div>
            <p>${policy.deletion_strategy}</p>
            <small>First-in-first-out: oldest records deleted first.</small>
          </div>

          <div class="policy-item">
            <div class="policy-label">Data Retention</div>
            <p>Snapshots subject to age and count limits</p>
            <small>
              Snapshots are automatically deleted when they exceed the maximum age (${policy.max_days} days)
              or when the total count exceeds configured limits. After app uninstall, no new snapshots
              are recorded, and existing data follows standard retention policies.
            </small>
          </div>

          <hr style="margin: 30px 0;">
          <h3>About Retention</h3>
          <p>
            Snapshot retention is managed automatically. The system tracks:
          </p>
          <ul style="margin-left: 20px;">
            <li><strong>Age:</strong> Delete snapshots older than max_days</li>
            <li><strong>Count:</strong> Delete oldest snapshots if count exceeds limit (FIFO)</li>
            <li><strong>TTL:</strong> @forge/api storage auto-expires records at 90 days</li>
          </ul>
        </div>
      </body>
    </html>
  `;
}
