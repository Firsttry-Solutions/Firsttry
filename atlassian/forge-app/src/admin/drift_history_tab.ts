/**
 * PHASE 7: DRIFT HISTORY TAB
 * 
 * Read-only UI component for viewing drift events between snapshots.
 * 
 * Features:
 * - List drift events with pagination (20 per page)
 * - Filter by object type and classification (query parameters)
 * - View detailed drift event information
 * - Deterministic ordering (by to_captured_at DESC, stable sort)
 * - Tenant isolation (read-only, current tenant only)
 * 
 * NOTE: Actor/source filtering not exposed in UI (always unknown).
 * Date range filtering handled by storage layer if needed.
 */

import { html } from '@forge/api';
import { DriftEventStorage } from '../phase7/drift_storage';

/**
 * Validate and parse query parameter value
 * Returns null if invalid to prevent injection/tampering
 */
function validateEnumValue(value: string | undefined, allowedValues: string[]): string | null {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return allowedValues.includes(trimmed) ? trimmed : null;
}

/**
 * Render drift history list page
 */
export async function renderDriftHistoryList(
  tenantId: string,
  cloudId: string,
  page: number = 0,
  queryParams: any = {}
) {
  // Validate page number
  const safePage = Math.max(0, parseInt(String(page), 10) || 0);

  // Parse and validate filters from query parameters
  const objectType = validateEnumValue(queryParams.object_type, [
    'FIELD', 'WORKFLOW', 'AUTOMATION_RULE', 'PROJECT', 'SCOPE', 'UNKNOWN'
  ]);
  const classification = validateEnumValue(queryParams.classification, [
    'STRUCTURAL', 'CONFIG_CHANGE', 'DATA_VISIBILITY_CHANGE', 'UNKNOWN'
  ]);

  // Build filter object - only validated values
  const queryFilters: any = {};
  if (objectType) queryFilters.object_type = objectType;
  if (classification) queryFilters.classification = classification;

  let result;
  try {
    const driftStorage = new DriftEventStorage(tenantId, cloudId);
    result = await driftStorage.listDriftEvents(queryFilters, safePage, 20);
  } catch (error: any) {
    return errorResponse(`Failed to load drift events: ${error.message}`);
  }

  // Format drift events as table rows
  const driftRowsHtml = result.items.map(event => `
    <tr>
      <td>${htmlEscape(event.object_type)}</td>
      <td><code>${htmlEscape(event.object_id)}</code></td>
      <td>
        <span class="badge badge-${event.change_type}">
          ${formatChangeType(event.change_type)}
        </span>
      </td>
      <td>
        <span class="badge badge-${event.classification}">
          ${formatClassification(event.classification)}
        </span>
      </td>
      <td>${new Date(event.time_window.to_captured_at).toLocaleString()}</td>
      <td>
        <a href="?action=view-drift&id=${htmlEscape(event.drift_event_id)}">View</a>
      </td>
    </tr>
  `).join('');

  // Build filter form (only object_type and classification - actor/source always unknown)
  const filterFormHtml = `
    <div class="filter-panel">
      <h3>🔍 Filter Drift Events</h3>
      <form method="get" style="display: flex; gap: 15px; flex-wrap: wrap;">
        <input type="hidden" name="action" value="drift-history">
        
        <div class="filter-group">
          <label for="object_type">Object Type:</label>
          <select name="object_type" id="object_type">
            <option value="">All Types</option>
            <option value="FIELD" ${objectType === 'FIELD' ? 'selected' : ''}>Field</option>
            <option value="WORKFLOW" ${objectType === 'WORKFLOW' ? 'selected' : ''}>Workflow</option>
            <option value="AUTOMATION_RULE" ${objectType === 'AUTOMATION_RULE' ? 'selected' : ''}>Automation Rule</option>
            <option value="PROJECT" ${objectType === 'PROJECT' ? 'selected' : ''}>Project</option>
            <option value="SCOPE" ${objectType === 'SCOPE' ? 'selected' : ''}>Scope</option>
          </select>
        </div>

        <div class="filter-group">
          <label for="classification">Classification:</label>
          <select name="classification" id="classification">
            <option value="">All Classifications</option>
            <option value="STRUCTURAL" ${classification === 'STRUCTURAL' ? 'selected' : ''}>Structural</option>
            <option value="CONFIG_CHANGE" ${classification === 'CONFIG_CHANGE' ? 'selected' : ''}>Config Change</option>
            <option value="DATA_VISIBILITY_CHANGE" ${classification === 'DATA_VISIBILITY_CHANGE' ? 'selected' : ''}>Visibility Change</option>
            <option value="UNKNOWN" ${classification === 'UNKNOWN' ? 'selected' : ''}>Unknown</option>
          </select>
        </div>

        <button type="submit" class="btn btn-filter">Filter</button>
        <a href="?action=drift-history" class="btn btn-clear">Clear Filters</a>
      </form>
      <small style="display: block; margin-top: 10px; color: #999;">
        ℹ️ Actor and source are always unknown (never inferred). Filters reset when navigating back.
      </small>
    </div>
  `;

  // Build pagination controls
  const pageNav = `
    <div class="pagination">
      ${safePage > 0 ? `<a href="?action=drift-history&page=${safePage - 1}${buildFilterQueryString(objectType, classification)}">&larr; Previous</a>` : '<span>&larr; Previous</span>'}
      <span>Page ${safePage + 1}</span>
      ${result.has_more ? `<a href="?action=drift-history&page=${safePage + 1}${buildFilterQueryString(objectType, classification)}">Next &rarr;</a>` : '<span>Next &rarr;</span>'}
    </div>
  `;

  // No statistics panel - Phase 7 is read-only, no derived metrics

  return html`
    <html>
      <head>
        <title>FirstTry Phase 7 - Drift History</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            padding: 20px; 
            background: #f5f5f5; 
          }
          .container { max-width: 1400px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
          h1 { margin-bottom: 10px; color: #0747a6; }
          .description { color: #626262; margin-bottom: 20px; font-size: 14px; }
          
          /* Tab Navigation */
          .tabs { margin-bottom: 20px; border-bottom: 1px solid #ddd; }
          .tabs a { padding: 10px 20px; margin-right: 10px; display: inline-block; }
          .tabs a.active { border-bottom: 3px solid #0747a6; color: #0747a6; font-weight: bold; }
          
          /* Filter Panel */
          .filter-panel { 
            background: #f9f9f9; 
            padding: 15px; 
            border-radius: 4px; 
            margin-bottom: 20px; 
            border: 1px solid #e0e0e0;
          }
          .filter-panel h3 { margin-bottom: 15px; font-size: 14px; }
          .filter-group { 
            display: flex; 
            flex-direction: column; 
            gap: 5px;
          }
          .filter-group label { font-size: 12px; font-weight: bold; }
          .filter-group select { 
            padding: 6px; 
            border: 1px solid #ccc; 
            border-radius: 3px;
            font-size: 13px;
          }
          
          /* Buttons */
          .btn { 
            padding: 8px 16px; 
            border: none; 
            border-radius: 4px; 
            text-decoration: none; 
            cursor: pointer;
            font-size: 13px;
            display: inline-flex;
            align-items: center;
          }
          .btn-filter { background: #0747a6; color: white; }
          .btn-filter:hover { background: #0747a6dd; }
          .btn-clear { background: #ddd; color: #333; }
          .btn-clear:hover { background: #ccc; }
          
          /* Stats Panel removed - Phase 7 is read-only */
          
          /* Table */
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { 
            background: #f5f5f5; 
            padding: 12px; 
            text-align: left; 
            font-weight: bold; 
            border-bottom: 2px solid #ddd;
            font-size: 13px;
          }
          td { 
            padding: 12px; 
            border-bottom: 1px solid #ddd;
            font-size: 13px;
          }
          tr:hover { background: #f9f9f9; }
          
          /* Badges */
          .badge { 
            display: inline-block;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
          }
          .badge-added { background: #d4edda; color: #155724; }
          .badge-removed { background: #f8d7da; color: #721c24; }
          .badge-modified { background: #cce5ff; color: #004085; }
          .badge-STRUCTURAL { background: #e7d4f5; color: #4a0080; }
          .badge-CONFIG_CHANGE { background: #fff3cd; color: #856404; }
          .badge-DATA_VISIBILITY_CHANGE { background: #f0e5ff; color: #3d0055; }
          .badge-UNKNOWN { background: #e2e3e5; color: #383d41; }
          
          /* Links */
          a { color: #0747a6; text-decoration: none; }
          a:hover { text-decoration: underline; }
          
          /* Pagination */
          .pagination { 
            text-align: center; 
            margin-bottom: 20px;
            padding: 15px;
            background: #f9f9f9;
            border-radius: 4px;
          }
          .pagination a, .pagination span { margin: 0 10px; }
          
          /* Empty State */
          .empty-state { 
            text-align: center; 
            padding: 40px; 
            color: #999;
          }
          .empty-state-icon { font-size: 48px; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📊 FirstTry Phase 7 - Drift History</h1>
          <p class="description">
            Detect and track changes between configuration snapshots. 
            Deterministic drift detection, read-only, no Jira API calls.
          </p>

          <div class="tabs">
            <a href="/">📅 Snapshots</a>
            <a href="?action=drift-history" class="active">🔄 Drift History</a>
            <a href="?action=policy">⚙️ Policy</a>
          </div>

          ${filterFormHtml}

          ${result.items.length > 0 ? `
              <thead>
                <tr>
                  <th>Object Type</th>
                  <th>Object ID</th>
                  <th>Change</th>
                  <th>Classification</th>
                  <th>Detected At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${driftRowsHtml}
              </tbody>
            </table>

            ${pageNav}
          ` : `
            <div class="empty-state">
              <div class="empty-state-icon">✨</div>
              <h2>No Drift Events</h2>
              <p>No configuration changes detected matching current filters.</p>
            </div>
          `}

          <hr style="margin: 30px 0;">
          <h3>About Drift Detection</h3>
          <ul style="margin-left: 20px; font-size: 13px;">
            <li><strong>Deterministic:</strong> Same snapshot pair always produces identical drift list</li>
            <li><strong>Snapshot-based:</strong> No Jira API calls required, computed from snapshots</li>
            <li><strong>Classified:</strong> Changes categorized as Structural, Config, or Visibility changes</li>
            <li><strong>READ-ONLY:</strong> Drift events are immutable, no modifications possible</li>
            <li><strong>Completeness:</strong> Each change includes a completeness percentage (0-100%)</li>
            <li><strong>Tenant-isolated:</strong> Each tenant sees only their own drift events</li>
          </ul>
        </div>
      </body>
    </html>
  `;
}

/**
 * Render drift event detail page
 */
export async function renderDriftEventDetail(
  tenantId: string,
  cloudId: string,
  driftEventId: string
) {
  // Validate drift event ID format (UUID-like)
  if (!driftEventId || typeof driftEventId !== 'string' || driftEventId.length === 0) {
    return errorResponse('Invalid drift event ID');
  }

  let event;
  try {
    const driftStorage = new DriftEventStorage(tenantId, cloudId);
    event = await driftStorage.getDriftEventById(driftEventId);
  } catch (error: any) {
    return errorResponse(`Failed to load drift event: ${error.message}`);
  }

  if (!event) {
    return errorResponse('Drift event not found', '?action=drift-history');
  }

  // Format before/after state as JSON with syntax highlighting
  const beforeStateJson = JSON.stringify(event.before_state || {}, null, 2);
  const afterStateJson = JSON.stringify(event.after_state || {}, null, 2);
  const changePatchJson = JSON.stringify(event.change_patch || [], null, 2);

  // Calculate time window
  const timeWindowStart = new Date(event.time_window.from_captured_at).toLocaleString();
  const timeWindowEnd = new Date(event.time_window.to_captured_at).toLocaleString();

  // Format metadata (safely - actor/source always unknown)
  const hasBeforeState = event.before_state !== null && Object.keys(event.before_state || {}).length > 0;
  const hasAfterState = event.after_state !== null && Object.keys(event.after_state || {}).length > 0;
  const hasMissingData = event.missing_data_reference && 
    (event.missing_data_reference.dataset_keys.length > 0 || 
     event.missing_data_reference.reason_codes.length > 0);

  return html`
    <html>
      <head>
        <title>Drift Event Detail</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            padding: 20px; 
            background: #f5f5f5;
          }
          .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
          h1 { color: #0747a6; margin-bottom: 10px; }
          .breadcrumb { margin-bottom: 20px; }
          .breadcrumb a { color: #0747a6; text-decoration: none; }
          
          .metadata-section { 
            background: #f9f9f9; 
            padding: 15px; 
            border-radius: 4px; 
            margin-bottom: 20px;
            border: 1px solid #e0e0e0;
          }
          .metadata-section h2 { font-size: 16px; margin-bottom: 15px; color: #333; }
          .metadata-row { 
            margin-bottom: 10px; 
            padding-bottom: 10px;
            border-bottom: 1px solid #f0f0f0;
          }
          .metadata-row:last-child { border-bottom: none; }
          .metadata-label { font-weight: bold; color: #626262; display: inline-block; width: 180px; }
          .metadata-value { color: #333; }
          
          .badge { 
            display: inline-block;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
          }
          .badge-added { background: #d4edda; color: #155724; }
          .badge-removed { background: #f8d7da; color: #721c24; }
          .badge-modified { background: #cce5ff; color: #004085; }
          .badge-STRUCTURAL { background: #e7d4f5; color: #4a0080; }
          .badge-CONFIG_CHANGE { background: #fff3cd; color: #856404; }
          .badge-DATA_VISIBILITY_CHANGE { background: #f0e5ff; color: #3d0055; }
          .badge-UNKNOWN { background: #e2e3e5; color: #383d41; }
          
          code { 
            background: white; 
            padding: 2px 4px; 
            border-radius: 3px; 
            font-family: monospace; 
            word-break: break-all;
          }
          
          .code-block {
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            margin-bottom: 15px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
          }
          
          /* Completeness visualization removed - Phase 7 shows raw values only */
          
          .section-title { 
            font-size: 16px; 
            font-weight: bold; 
            margin-top: 25px; 
            margin-bottom: 15px;
            color: #333;
          }
          
          .warning { 
            background: #fff3cd; 
            padding: 12px; 
            border-radius: 4px;
            border-left: 4px solid #ffc107;
            margin-bottom: 15px;
          }
          
          a { color: #0747a6; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔍 Drift Event Detail</h1>
          <p class="breadcrumb"><a href="?action=drift-history">&larr; Back to Drift History</a></p>

          <div class="metadata-section">
            <h2>Event Summary</h2>
            <div class="metadata-row">
              <span class="metadata-label">Event ID:</span>
              <span class="metadata-value"><code>${htmlEscape(event.drift_event_id)}</code></span>
            </div>
            <div class="metadata-row">
              <span class="metadata-label">Object Type:</span>
              <span class="metadata-value">${htmlEscape(event.object_type)}</span>
            </div>
            <div class="metadata-row">
              <span class="metadata-label">Object ID:</span>
              <span class="metadata-value"><code>${htmlEscape(event.object_id)}</code></span>
            </div>
            <div class="metadata-row">
              <span class="metadata-label">Change Type:</span>
              <span class="metadata-value"><span class="badge badge-${event.change_type}">${formatChangeType(event.change_type)}</span></span>
            </div>
            <div class="metadata-row">
              <span class="metadata-label">Classification:</span>
              <span class="metadata-value"><span class="badge badge-${event.classification}">${formatClassification(event.classification)}</span></span>
            </div>
          </div>

          <div class="metadata-section">
            <h2>Completeness & Confidence</h2>
            <div class="metadata-row">
              <span class="metadata-label">Completeness:</span>
              <span class="metadata-value">${event.completeness_percentage}%</span>
            </div>
            ${hasMissingData ? `
              <div class="metadata-row">
                <span class="metadata-label">Missing Data:</span>
                <span class="metadata-value">
                  <strong>Datasets:</strong> ${htmlEscape(event.missing_data_reference!.dataset_keys.join(', '))}<br>
                  <strong>Reasons:</strong> ${htmlEscape(event.missing_data_reference!.reason_codes.join(', '))}
                </span>
              </div>
            ` : ''}
            <div class="metadata-row">${event.completeness_percentage}%2>Actor & Source (Read-Only)</h2>
            <div class="warning">
              <strong>ℹ️ Note:</strong> Actor and source are never inferred. 
              They are always marked as unknown with none confidence unless explicitly provided.
            </div>
            <div class="metadata-row">
              <span class="metadata-label">Actor:</span>
              <span class="metadata-value"><em>unknown</em></span>
            </div>
            <div class="metadata-row">
              <span class="metadata-label">Source:</span>
              <span class="metadata-value"><em>unknown</em></span>
            </div>
          </div>

          <div class="metadata-section">
            <h2>Time Window</h2>
            <div class="metadata-row">
              <span class="metadata-label">From Snapshot:</span>
              <span class="metadata-value"><code>${htmlEscape(event.from_snapshot_id)}</code> (${timeWindowStart})</span>
            </div>
            <div class="metadata-row">
              <span class="metadata-label">To Snapshot:</span>
              <span class="metadata-value"><code>${htmlEscape(event.to_snapshot_id)}</code> (${timeWindowEnd})</span>
            </div>
            <div class="metadata-row">
              <span class="metadata-label">Repeat Count:</span>
              <span class="metadata-value">${event.repeat_count} (changes detected this many times)</span>
            </div>
          </div>

          <div class="metadata-section">
            <h2>Integrity & Metadata</h2>
            <div class="metadata-row">
              <span class="metadata-label">Event Hash:</span>
              <span class="metadata-value"><code>${htmlEscape(event.canonical_hash)}</code></span>
            </div>
            <div class="metadata-row">
              <span class="metadata-label">Hash Algorithm:</span>
              <span class="metadata-value">${htmlEscape(event.hash_algorithm)}</span>
            </div>
            <div class="metadata-row">
              <span class="metadata-label">Schema Version:</span>
              <span class="metadata-value">${htmlEscape(event.schema_version)}</span>
            </div>
            <div class="metadata-row">
              <span class="metadata-label">Created At:</span>
              <span class="metadata-value">${new Date(event.created_at).toLocaleString()}</span>
            </div>
          </div>

          <div class="section-title">Before State (Previous Snapshot)</div>
          ${hasBeforeState ? `
            <div class="code-block">${htmlEscape(beforeStateJson)}</div>
          ` : `
            <p style="color: #999;"><em>No before state (object was added)</em></p>
          `}

          <div class="section-title">After State (Current Snapshot)</div>
          ${hasAfterState ? `
            <div class="code-block">${htmlEscape(afterStateJson)}</div>
          ` : `
            <p style="color: #999;"><em>No after state (object was removed)</em></p>
          `}

          <div class="section-title">Change Patch (JSON Patch Format)</div>
          ${event.change_patch && event.change_patch.length > 0 ? `
            <div class="code-block">${htmlEscape(changePatchJson)}</div>
          ` : `
            <p style="color: #999;"><em>No changes (exact match or structure-only changes)</em></p>
          `}

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="font-size: 12px; color: #999;">
              Drift events are immutable and deterministic. This event was computed from snapshot pair 
              <code>${htmlEscape(event.from_snapshot_id.substring(0, 8))}</code> → 
              <code>${htmlEscape(event.to_snapshot_id.substring(0, 8))}</code>
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Format change type for display
 */
function formatChangeType(changeType: string): string {
  const map: { [key: string]: string } = {
    'added': 'Added',
    'removed': 'Removed',
    'modified': 'Modified',
  };
  return map[changeType] || changeType;
}

/**
 * Format classification for display
 */
function formatClassification(classification: string): string {
  const map: { [key: string]: string } = {
    'STRUCTURAL': 'Structural',
    'CONFIG_CHANGE': 'Config Change',
    'DATA_VISIBILITY_CHANGE': 'Visibility Change',
    'UNKNOWN': 'Unknown',
  };
  return map[classification] || classification;
}

/**
 * Build query string from filters (only non-null values)
 */
function buildFilterQueryString(objectType: string | null, classification: string | null): string {
  const params = new URLSearchParams();
  if (objectType) params.set('object_type', objectType);
  if (classification) params.set('classification', classification);
  
  const str = params.toString();
  return str ? '&' + str : '';
}

/**
 * HTML escape utility for safe rendering
 */
function htmlEscape(text: string | undefined): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Error response helper
 */
function errorResponse(message: string, backLink: string = '?action=drift-history') {
  return html`
    <html>
      <head>
        <title>Error - FirstTry Drift History</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            padding: 20px; 
            background: #f5f5f5;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            padding: 20px; 
            border-radius: 8px;
          }
          h1 { color: #d32f2f; }
          .error { 
            border: 1px solid #d32f2f; 
            padding: 12px; 
            border-radius: 4px; 
            background: #ffebee;
            color: #c62828;
          }
          a { color: #0747a6; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Error</h1>
          <div class="error">
            <p><strong>${htmlEscape(message)}</strong></p>
          </div>
          <p><a href="${backLink}">Back to Drift History</a></p>
        </div>
      </body>
    </html>
  `;
}
