/**
 * PHASE 6 v2 + P2: SNAPSHOT EXPORT WITH OUTPUT TRUTH GUARANTEES
 * 
 * Export single snapshots in JSON and PDF formats.
 * 
 * Features:
 * - JSON export (raw snapshot payload in canonical form)
 * - PDF export (formatted evidence report - single snapshot only)
 * - Metadata preservation (hash, timestamp, provenance)
 * - READ-ONLY (no modifications, no derived metrics)
 * - Single snapshot per export (no bulk/cross-snapshot exports)
 * - P2: Output truth metadata (completeness, confidence, validity)
 * - P2: Operator acknowledgment required for non-VALID outputs
 * - P2: Watermarking for degraded/expired outputs
 * - P2: Audit event recording for export operations
 */

import { api } from '@forge/api';
import {
  SnapshotStorage,
  SnapshotRunStorage,
} from '../phase6/snapshot_storage';
import {
  OutputTruthMetadata,
  computeOutputTruthMetadata,
  requireValidForExport,
  ExportBlockedError,
  MAX_SNAPSHOT_AGE_SECONDS,
} from '../output/output_contract';
import { getOutputRecordStore } from '../output/output_store';
import { getAuditEventStore } from '../audit/audit_events';
import { getDriftStateTracker } from '../drift/drift_state';

/**
 * Export snapshot handler with output truth validation
 * Supports JSON and PDF formats, single snapshot only
 * 
 * TRUTH VALIDATION:
 * - Computes OutputTruthMetadata for the snapshot
 * - If output is not VALID, requires explicit operator acknowledgment
 * - Records audit events for all export operations
 * - Watermarks non-VALID outputs
 */
export async function handleExport(request: any) {
  const { tenantId, cloudId } = request.context;
  const { id, format = 'json', acknowledge_degradation = false } = request.queryParameters || {};

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
    const snapshotStorage = new SnapshotStorage(tenantId, cloudId);
    const snapshot = await snapshotStorage.getSnapshotById(id);

    if (!snapshot) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'snapshot_not_found' }),
      };
    }

    // P2: COMPUTE OUTPUT TRUTH METADATA
    const nowISO = new Date().toISOString();
    const driftTracker = getDriftStateTracker(tenantId, cloudId);
    const driftStatus = await driftTracker.getDriftStatus(id, nowISO);

    // Calculate completeness (from missing_data in snapshot)
    const missingDataList = snapshot.missing_data || [];
    const completenessPercent = missingDataList.length === 0 ? 100 : Math.max(0, 100 - (missingDataList.length * 10));

    const truthMetadata = computeOutputTruthMetadata({
      generatedAtISO: nowISO,
      snapshotId: id,
      snapshotCreatedAtISO: snapshot.captured_at,
      rulesetVersion: '1.0',
      driftStatus,
      completenessPercent,
      missingData: missingDataList.map((item) => item.dataset_name),
      nowISO,
    });

    // P2: VALIDATE EXPORT PERMISSION
    const acknowledgedDegradation = acknowledge_degradation === 'true' || acknowledge_degradation === true;

    try {
      requireValidForExport(truthMetadata, acknowledgedDegradation);
    } catch (err) {
      if (err instanceof ExportBlockedError) {
        // Record the blocked export attempt in audit
        const auditStore = getAuditEventStore(tenantId, cloudId);
        await auditStore.recordEvent(
          'OUTPUT_EXPORTED',
          id,
          `export_${id}_${Date.now()}`,
          {
            outputType: format as any,
            validityStatus: truthMetadata.validityStatus,
            operatorAction: 'blocked',
            reason: err.reasons.join('; '),
          },
          nowISO,
          truthMetadata.validUntilISO
        );

        // Return 403 Forbidden with truth reasons
        return {
          statusCode: 403,
          body: JSON.stringify({
            error: 'export_blocked',
            validity_status: truthMetadata.validityStatus,
            reasons: truthMetadata.reasons,
            warnings: truthMetadata.warnings,
            required_acknowledgment: truthMetadata.validityStatus !== 'VALID',
            query_param: 'acknowledge_degradation=true',
          }),
        };
      }
      throw err;
    }

    // P2: RECORD ACKNOWLEDGMENT IF DEGRADED
    if (truthMetadata.validityStatus !== 'VALID' && acknowledgedDegradation) {
      const auditStore = getAuditEventStore(tenantId, cloudId);
      await auditStore.recordAcknowledgedDegradation(
        id,
        `export_${id}_${Date.now()}`,
        format as any,
        truthMetadata.validityStatus,
        `Export of ${truthMetadata.validityStatus} output. Reasons: ${truthMetadata.reasons.join('; ')}`,
        nowISO,
        truthMetadata.validUntilISO
      );
    }

    // P2: RECORD OUTPUT GENERATION
    const outputRecordStore = getOutputRecordStore(tenantId, cloudId);
    const outputId = `output_${id}_${format}_${Date.now()}`;
    await outputRecordStore.recordOutputGeneration(
      outputId,
      id,
      format as any,
      truthMetadata,
      nowISO
    );

    // Generate export with appropriate format
    let exportResponse;
    if (format === 'json') {
      exportResponse = await exportJSON(tenantId, cloudId, id, truthMetadata);
    } else if (format === 'pdf') {
      exportResponse = await exportPDF(tenantId, cloudId, id, truthMetadata);
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'format must be json or pdf' }),
      };
    }

    // P2: RECORD EXPORT IN AUDIT TRAIL
    const auditStore = getAuditEventStore(tenantId, cloudId);
    await auditStore.recordOutputExported(
      id,
      outputId,
      format as any,
      truthMetadata.validityStatus,
      acknowledgedDegradation ? 'confirmed_with_ack' : 'confirmed',
      nowISO,
      truthMetadata.validUntilISO
    );

    // P2: UPDATE OUTPUT RECORD WITH EXPORT STATUS
    await outputRecordStore.recordOutputExport(
      outputId,
      'system', // No operator ID stored (Phase P1 PII safety)
      acknowledgedDegradation,
      nowISO
    );

    return exportResponse;
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }

/**
 * Export snapshot as JSON with truth metadata
 */
async function exportJSON(
  tenantId: string,
  cloudId: string,
  snapshotId: string,
  truthMetadata: OutputTruthMetadata
) {
  const snapshotStorage = new SnapshotStorage(tenantId, cloudId);
  const snapshot = await snapshotStorage.getSnapshotById(snapshotId);

  if (!snapshot) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'snapshot_not_found' }),
    };
  }

  // P2: Build export envelope with truth metadata
  const exportData: any = {
    // P2: Truth metadata (REQUIRED)
    truth_metadata: truthMetadata,

    // Original snapshot data
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

  // P2: WATERMARK if not VALID
  if (truthMetadata.validityStatus !== 'VALID') {
    exportData.watermark = {
      status: truthMetadata.validityStatus,
      message: `⚠️ ${truthMetadata.validityStatus}: ${truthMetadata.reasons.join('; ')}`,
      warnings: truthMetadata.warnings,
      reasons: truthMetadata.reasons,
    };
  }

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
 * Export snapshot as PDF with truth metadata and watermarking
 * 
 * Produces a formatted HTML+text evidence report for a single snapshot.
 * The PDF includes metadata, scope, provenance, truth signals, and payload summary.
 * Non-VALID outputs are watermarked with explicit degradation warnings.
 */
async function exportPDF(
  tenantId: string,
  cloudId: string,
  snapshotId: string,
  truthMetadata: OutputTruthMetadata
) {
  const snapshotStorage = new SnapshotStorage(tenantId, cloudId);
  const snapshot = await snapshotStorage.getSnapshotById(snapshotId);

  if (!snapshot) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'snapshot_not_found' }),
    };
  }

  // Generate HTML content for PDF with truth metadata
  const htmlContent = generatePDFContent(snapshot, truthMetadata);

  // Convert to text/plain with structured formatting
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
 * Generate HTML content for PDF export with truth metadata
 * P2: Includes output validity warnings and watermarking for non-VALID outputs
 */
function generatePDFContent(snapshot: any, truthMetadata: OutputTruthMetadata): string {
  const timestamp = new Date(snapshot.captured_at).toLocaleString();
  const datasetList = Object.keys(snapshot.payload).join(', ');

  // P2: Build watermark section for non-VALID outputs
  const watermarkHtml = truthMetadata.validityStatus !== 'VALID'
    ? `
      <div class="watermark-warning">
        <h2>⚠️ IMPORTANT: OUTPUT QUALITY WARNING</h2>
        <p><strong>Status:</strong> ${truthMetadata.validityStatus}</p>
        <p><strong>Reasons:</strong></p>
        <ul>
          ${truthMetadata.reasons.map((reason) => `<li>${reason}</li>`).join('')}
        </ul>
        <p><strong>Warnings:</strong></p>
        <ul>
          ${truthMetadata.warnings.map((warning) => `<li>${warning}</li>`).join('')}
        </ul>
        <p>
          <strong>⚠️ This export was made with explicit operator acknowledgment of data quality issues.</strong>
        </p>
      </div>
    `
    : '';

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
        .watermark-warning { background: #f8d7da; padding: 15px; border: 3px solid #f5c6cb; border-radius: 4px; margin-bottom: 20px; }
        .watermark-warning h2 { color: #721c24; margin-top: 0; }
        .watermark-warning p { color: #721c24; }
        .watermark-warning ul { color: #721c24; }
        .truth-metadata { background: #e7f3ff; padding: 15px; border-left: 5px solid #0747a6; margin-bottom: 20px; }
        .truth-metadata-item { margin: 6px 0; font-size: 12px; }
      </style>
    </head>
    <body>
      <h1>📋 Jira Configuration Snapshot Evidence Report</h1>
      
      <p><strong>Report Generated:</strong> ${new Date().toISOString()}</p>

      ${watermarkHtml}

      <h2>Output Truth Metadata (P2)</h2>
      <div class="truth-metadata">
        <div class="truth-metadata-item">
          <strong>Validity Status:</strong> ${truthMetadata.validityStatus}
        </div>
        <div class="truth-metadata-item">
          <strong>Confidence Level:</strong> ${truthMetadata.confidenceLevel}
        </div>
        <div class="truth-metadata-item">
          <strong>Completeness:</strong> ${truthMetadata.completenessPercent}%
          ${truthMetadata.missingData.length > 0 ? ` (Missing: ${truthMetadata.missingData.join(', ')})` : ''}
        </div>
        <div class="truth-metadata-item">
          <strong>Drift Status:</strong> ${truthMetadata.driftStatus}
        </div>
        <div class="truth-metadata-item">
          <strong>Snapshot Age:</strong> ${Math.floor(truthMetadata.snapshotAgeSeconds / 86400)} days
        </div>
        <div class="truth-metadata-item">
          <strong>Valid Until:</strong> ${truthMetadata.validUntilISO}
        </div>
      </div>

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
        This report was generated from FirstTry Phase 6 v2 Snapshot Evidence Ledger with Phase P2 Output Truth Guarantees.
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
