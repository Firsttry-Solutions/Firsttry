/**
 * PHASE 6 v2: SNAPSHOT EXPORT
 * 
 * Export single snapshots in JSON and PDF formats.
 * 
 * Features:
 * - JSON export (raw snapshot payload in canonical form)
 * - PDF export (formatted evidence report - single snapshot only)
 * - Metadata preservation (hash, timestamp, provenance)
 * - READ-ONLY (no modifications, no derived metrics)
 * - Single snapshot per export (no bulk/cross-snapshot exports)
 */

import { api } from '@forge/api';
import {
  SnapshotStorage,
  SnapshotRunStorage,
} from '../phase6/snapshot_storage';

/**
 * Export snapshot handler
 * Supports JSON and PDF formats, single snapshot only
 */
export async function handleExport(request: any) {
  const { tenantId, cloudId } = request.context;
  const { id, format = 'json' } = request.queryParameters || {};

  if (!id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'snapshot_id required' }),
    };
  }

  // Single snapshot only - no bulk/multi-snapshot exports
  if (Array.isArray(id)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'single_snapshot_only' }),
    };
  }

  try {
    if (format === 'json') {
      return await exportJSON(tenantId, cloudId, id);
    } else if (format === 'pdf') {
      return await exportPDF(tenantId, cloudId, id);
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'format must be json or pdf' }),
      };
    }
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

/**
 * Export snapshot as JSON
 */
async function exportJSON(
  tenantId: string,
  cloudId: string,
  snapshotId: string
) {
  const snapshotStorage = new SnapshotStorage(tenantId, cloudId);
  const snapshot = await snapshotStorage.getSnapshotById(snapshotId);

  if (!snapshot) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'snapshot_not_found' }),
    };
  }

  // Create export envelope with metadata
  const exportData = {
    format_version: '1.0',
    export_timestamp: new Date().toISOString(),
    snapshot: {
      id: snapshot.snapshot_id,
      tenant_id: snapshot.tenant_id,
      cloud_id: snapshot.cloud_id,
      captured_at: snapshot.captured_at,
      type: snapshot.snapshot_type,
      schema_version: snapshot.schema_version,
      canonical_hash: snapshot.canonical_hash,
      hash_algorithm: snapshot.hash_algorithm,
      clock_source: snapshot.clock_source,
      scope: snapshot.scope,
      input_provenance: snapshot.input_provenance,
      missing_data: snapshot.missing_data,
      payload: snapshot.payload,
    },
  };

  const filename = `snapshot-${snapshot.snapshot_type}-${snapshot.snapshot_id.substring(0, 8)}.json`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
    body: JSON.stringify(exportData, null, 2),
  };
}

/**
 * Export snapshot as PDF
 * 
 * Produces a formatted HTML+text evidence report for a single snapshot.
 * The PDF includes metadata, scope, provenance, and payload summary.
 * No derived analytics, no cross-snapshot data, no modifications.
 */
async function exportPDF(
  tenantId: string,
  cloudId: string,
  snapshotId: string
) {
  const snapshotStorage = new SnapshotStorage(tenantId, cloudId);
  const snapshot = await snapshotStorage.getSnapshotById(snapshotId);

  if (!snapshot) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'snapshot_not_found' }),
    };
  }

  // Generate HTML content for PDF
  const htmlContent = generatePDFContent(snapshot);

  // Convert to text/plain with structured formatting
  // In production, would use a proper PDF library (pdfkit, etc.)
  // For now, return as printable text document
  const textContent = htmlToText(htmlContent);

  const filename = `snapshot-${snapshot.snapshot_type}-${snapshot.snapshot_id.substring(0, 8)}.txt`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
    body: textContent,
  };
}

/**
 * Generate HTML content for PDF export
 */
function generatePDFContent(snapshot: any): string {
  const timestamp = new Date(snapshot.captured_at).toLocaleString();
  const datasetList = Object.keys(snapshot.payload).join(', ');

  const missingDataHtml = snapshot.missing_data.length > 0
    ? `
      <h2>Missing Data Disclosure</h2>
      <table border="1" cellpadding="8" cellspacing="0" width="100%">
        <tr>
          <th>Dataset</th>
          <th>Status</th>
          <th>Reason</th>
        </tr>
        ${snapshot.missing_data.map((item: any) => `
          <tr>
            <td>${item.dataset_name}</td>
            <td>${item.coverage_status}</td>
            <td>${item.reason_detail}</td>
          </tr>
        `).join('')}
      </table>
    `
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Snapshot Evidence Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        h1 { color: #0747a6; border-bottom: 3px solid #0747a6; padding-bottom: 10px; }
        h2 { color: #333; margin-top: 20px; }
        .metadata { background: #f5f5f5; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
        .metadata-item { margin: 8px 0; }
        .metadata-label { font-weight: bold; }
        code { background: white; padding: 2px 4px; font-family: monospace; }
        table { border-collapse: collapse; margin-bottom: 20px; }
        th { background: #f5f5f5; }
        td { padding: 8px; }
        .warning { background: #fff3cd; padding: 10px; border-radius: 4px; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <h1>📋 Jira Configuration Snapshot Evidence Report</h1>
      
      <p><strong>Report Generated:</strong> ${new Date().toISOString()}</p>

      <h2>Snapshot Metadata</h2>
      <div class="metadata">
        <div class="metadata-item">
          <span class="metadata-label">Snapshot ID:</span>
          <code>${snapshot.snapshot_id}</code>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Captured At:</span>
          ${timestamp}
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Type:</span>
          ${snapshot.snapshot_type} (${snapshot.snapshot_type === 'daily' ? 'lightweight inventory' : 'comprehensive with definitions'})
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Hash (SHA256):</span>
          <code>${snapshot.canonical_hash}</code>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Clock Source:</span>
          ${snapshot.clock_source}
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Schema Version:</span>
          ${snapshot.schema_version}
        </div>
      </div>

      <h2>Scope & Provenance</h2>
      <div class="metadata">
        <div class="metadata-item">
          <span class="metadata-label">Projects Included:</span>
          ${snapshot.scope.projects_included.join(', ')}
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Projects Excluded:</span>
          ${snapshot.scope.projects_excluded.length > 0 ? snapshot.scope.projects_excluded.join(', ') : '(none)'}
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Endpoints Queried:</span>
          ${snapshot.input_provenance.endpoints_queried.join(', ')}
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Available Scopes:</span>
          ${snapshot.input_provenance.available_scopes.join(', ')}
        </div>
      </div>

      <h2>Captured Data</h2>
      <p>Datasets included in this snapshot:</p>
      <ul>
        ${Object.keys(snapshot.payload).map(key => {
          const count = Array.isArray(snapshot.payload[key]) ? snapshot.payload[key].length : 1;
          return `<li><code>${key}</code> (${count} records)</li>`;
        }).join('')}
      </ul>

      ${snapshot.missing_data.length > 0 ? `
        <div class="warning">
          <strong>⚠️ This snapshot has missing data:</strong>
          See "Missing Data Disclosure" section below for details.
        </div>
      ` : ''}

      ${missingDataHtml}

      <h2>Snapshot Integrity</h2>
      <p>
        This snapshot is immutable and has been cryptographically hashed.
        The SHA256 hash ensures that any modification to the payload can be detected.
      </p>
      <p>
        <strong>Hash Algorithm:</strong> ${snapshot.hash_algorithm}
      </p>
      <p>
        <strong>Expected Hash:</strong><br>
        <code>${snapshot.canonical_hash}</code>
      </p>

      <hr style="margin-top: 40px;">
      <p style="color: #999; font-size: 12px;">
        This report was generated from FirstTry Phase 6 v2 Snapshot Evidence Ledger.
        Report timestamp: ${new Date().toISOString()}
      </p>
    </body>
    </html>
  `;
}

/**
 * Simple HTML to structured text conversion
 * Preserves content without rendering; suitable for email, logs, or text export
 */
function htmlToText(htmlContent: string): string {
  // Simple conversion: strip HTML tags and preserve structure
  let text = htmlContent
    .replace(/<h1[^>]*>/g, '\n=== ')
    .replace(/<\/h1>/g, ' ===\n')
    .replace(/<h2[^>]*>/g, '\n-- ')
    .replace(/<\/h2>/g, ' --\n')
    .replace(/<p[^>]*>/g, '')
    .replace(/<\/p>/g, '\n')
    .replace(/<code[^>]*>/g, '`')
    .replace(/<\/code>/g, '`')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  
  // Normalize whitespace
  text = text.replace(/\n\n+/g, '\n\n');
  
  return text.trim() + '\n';
}

/**
 * Get export formats available
 */
export function getAvailableFormats(): string[] {
  return ['json', 'pdf'];
}

/**
 * Get export metadata
 */
export async function getExportMetadata(
  tenantId: string,
  cloudId: string,
  snapshotId: string
) {
  const snapshotStorage = new SnapshotStorage(tenantId, cloudId);
  const snapshot = await snapshotStorage.getSnapshotById(snapshotId);

  if (!snapshot) {
    return null;
  }

  return {
    snapshot_id: snapshot.snapshot_id,
    type: snapshot.snapshot_type,
    captured_at: snapshot.captured_at,
    hash: snapshot.canonical_hash,
    formats_available: getAvailableFormats(),
  };
}
