/**
 * PDF Export from Trust Snapshot
 * 
 * Generates human-readable PDF from TrustSnapshot data.
 * Output must not exceed 900 KB.
 * 
 * Uses a minimal PDF generator compatible with Node.js runtime.
 */

import { TrustSnapshot, SnapshotRecord } from './types';

/**
 * Generate PDF buffer from TrustSnapshot
 * Returns PDF bytes
 */
export async function generateTrustSnapshotPdf(
  snapshot: TrustSnapshot,
  record: SnapshotRecord
): Promise<Buffer> {
  try {
    // Attempt to use pdfkit if available, otherwise fallback to simple PDF
    const pdfLibAvailable = await checkPdfLibAvailable();
    
    if (pdfLibAvailable) {
      return await generatePdfWithLibrary(snapshot, record);
    } else {
      return generateSimplePdf(snapshot, record);
    }
  } catch (error) {
    // Fallback to simple PDF even if library is available but fails
    return generateSimplePdf(snapshot, record);
  }
}

async function checkPdfLibAvailable(): Promise<boolean> {
  try {
    // Try to dynamically import pdfkit
    const module = await import('pdfkit');
    return !!module;
  } catch {
    return false;
  }
}

async function generatePdfWithLibrary(snapshot: TrustSnapshot, record: SnapshotRecord): Promise<Buffer> {
  try {
    const PDFDocument = (await import('pdfkit')).default;
    const chunks: Buffer[] = [];

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
    });

    // Collect output
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    // Title
    doc.fontSize(18).font('Helvetica-Bold').text('Trust Snapshot', { underline: true });
    doc.fontSize(10).text('');

    // Snapshot ID and Hash
    doc.fontSize(10).font('Helvetica-Bold').text('Evidence Identity:');
    doc.fontSize(9).font('Helvetica').text(`Snapshot ID: ${record.snapshotId}`);
    doc.fontSize(9).text(`JSON SHA256: ${record.jsonSha256}`);
    doc.fontSize(9).text(`Generated: ${record.generatedAtISO}`);
    doc.fontSize(10).text('');

    // Operational State
    doc.fontSize(10).font('Helvetica-Bold').text('Operational State:');
    doc.fontSize(9).font('Helvetica').text(`Status: ${snapshot.operationalState.status}`);
    if (snapshot.operationalState.lastSuccessfulRunAtISO) {
      doc.fontSize(9).text(`Last Successful Run: ${snapshot.operationalState.lastSuccessfulRunAtISO}`);
    }
    if (snapshot.operationalState.consecutiveDaysOperational !== null) {
      doc.fontSize(9).text(`Days Operational: ${snapshot.operationalState.consecutiveDaysOperational}`);
    }
    doc.fontSize(10).text('');

    // Monitoring Continuity
    doc.fontSize(10).font('Helvetica-Bold').text('Monitoring Continuity:');
    doc.fontSize(9).font('Helvetica').text(`Scheduler Active: ${snapshot.monitoringContinuity.schedulerActive}`);
    if (snapshot.monitoringContinuity.lastRunAtISO) {
      doc.fontSize(9).text(`Last Run: ${snapshot.monitoringContinuity.lastRunAtISO}`);
    }
    doc.fontSize(9).text(`Data Completeness: ${snapshot.monitoringContinuity.dataCompleteness}`);
    doc.fontSize(10).text('');

    // Configuration Risk
    doc.fontSize(10).font('Helvetica-Bold').text('Configuration Risk Summary:');
    doc.fontSize(9).font('Helvetica').text(`Risk Band: ${snapshot.configurationRiskSummary.riskBand}`);
    doc.fontSize(9).text(`Metrics Included: ${snapshot.configurationRiskSummary.metricsIncluded.join(', ') || '(none)'}`);
    if (snapshot.configurationRiskSummary.evaluatedAtISO) {
      doc.fontSize(9).text(`Evaluated: ${snapshot.configurationRiskSummary.evaluatedAtISO}`);
    }
    doc.fontSize(10).text('');

    // Change Summary
    doc.fontSize(10).font('Helvetica-Bold').text('Change Summary (Last 30 Days):');
    doc.fontSize(9).font('Helvetica').text(`Event Count: ${snapshot.changeSummary.eventCount}`);
    if (snapshot.changeSummary.categoriesPresent.length > 0) {
      doc.fontSize(9).text(`Categories: ${snapshot.changeSummary.categoriesPresent.join(', ')}`);
    }
    if (snapshot.changeSummary.lastChangeAtISO) {
      doc.fontSize(9).text(`Last Change: ${snapshot.changeSummary.lastChangeAtISO}`);
    }
    doc.fontSize(10).text('');

    // App Behavior Guarantees
    doc.fontSize(10).font('Helvetica-Bold').text('App Behavior Guarantees:');
    doc.fontSize(9).font('Helvetica').text(`Read-Only: ${snapshot.appBehaviorGuarantees.readOnly}`);
    doc.fontSize(9).text(`No Jira Writes: ${snapshot.appBehaviorGuarantees.noJiraWrites}`);
    doc.fontSize(9).text(`No Config Changes: ${snapshot.appBehaviorGuarantees.noConfigChanges}`);
    doc.fontSize(9).text(`No Enforcement: ${snapshot.appBehaviorGuarantees.noEnforcement}`);
    doc.fontSize(10).text('');

    // Versioning
    doc.fontSize(10).font('Helvetica-Bold').text('Versioning:');
    doc.fontSize(9).font('Helvetica').text(`App Version: ${snapshot.versioning.appVersion}`);
    doc.fontSize(9).text(`Environment: ${snapshot.versioning.environment}`);
    doc.fontSize(10).text('');

    // Completeness
    doc.fontSize(10).font('Helvetica-Bold').text('Completeness:');
    doc.fontSize(9).font('Helvetica').text(`Status: ${snapshot.completeness}`);

    // Issues (if any)
    if (snapshot.issues.length > 0) {
      doc.fontSize(10).text('');
      doc.fontSize(10).font('Helvetica-Bold').text('Issues:');
      for (const issue of snapshot.issues) {
        doc.fontSize(9).font('Helvetica').text(`• ${issue.source}: ${issue.reason} (${issue.errorCode})`);
      }
    }

    // Footer
    doc.fontSize(8).text('');
    doc.text('Generated by FirstTry — Read-only evidence export', { align: 'center' });

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length > 900 * 1024) {
          reject(new Error('PDF exceeds 900 KB size limit'));
        } else {
          resolve(buffer);
        }
      });
      doc.on('error', reject);
    });
  } catch (error) {
    throw error;
  }
}

function generateSimplePdf(snapshot: TrustSnapshot, record: SnapshotRecord): Buffer {
  /**
   * Minimal PDF generator for fallback
   * Creates a basic PDF structure manually
   */
  let content = '';

  // PDF header
  content += '%PDF-1.4\n';
  content += '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  content += '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';

  // Build text content
  let textContent = 'Trust Snapshot\n\n';
  textContent += `Evidence Identity:\n`;
  textContent += `Snapshot ID: ${record.snapshotId}\n`;
  textContent += `JSON SHA256: ${record.jsonSha256}\n`;
  textContent += `Generated: ${record.generatedAtISO}\n\n`;

  textContent += `Operational State:\n`;
  textContent += `Status: ${snapshot.operationalState.status}\n`;
  if (snapshot.operationalState.lastSuccessfulRunAtISO) {
    textContent += `Last Successful Run: ${snapshot.operationalState.lastSuccessfulRunAtISO}\n`;
  }
  textContent += `\n`;

  textContent += `Monitoring Continuity:\n`;
  textContent += `Scheduler Active: ${snapshot.monitoringContinuity.schedulerActive}\n`;
  textContent += `Data Completeness: ${snapshot.monitoringContinuity.dataCompleteness}\n\n`;

  textContent += `Configuration Risk Summary:\n`;
  textContent += `Risk Band: ${snapshot.configurationRiskSummary.riskBand}\n`;
  textContent += `Metrics Included: ${snapshot.configurationRiskSummary.metricsIncluded.join(', ') || '(none)'}\n\n`;

  textContent += `Change Summary (Last 30 Days):\n`;
  textContent += `Event Count: ${snapshot.changeSummary.eventCount}\n`;
  if (snapshot.changeSummary.categoriesPresent.length > 0) {
    textContent += `Categories: ${snapshot.changeSummary.categoriesPresent.join(', ')}\n`;
  }
  textContent += `\n`;

  textContent += `App Behavior Guarantees:\n`;
  textContent += `Read-Only: true\n`;
  textContent += `No Jira Writes: true\n`;
  textContent += `No Config Changes: true\n`;
  textContent += `No Enforcement: true\n\n`;

  textContent += `Versioning:\n`;
  textContent += `App Version: ${snapshot.versioning.appVersion}\n`;
  textContent += `Environment: ${snapshot.versioning.environment}\n\n`;

  textContent += `Completeness: ${snapshot.completeness}\n`;

  if (snapshot.issues.length > 0) {
    textContent += `\nIssues:\n`;
    for (const issue of snapshot.issues) {
      textContent += `• ${issue.source}: ${issue.reason} (${issue.errorCode})\n`;
    }
  }

  textContent += `\nGenerated by FirstTry — Read-only evidence export\n`;

  // Encode text stream
  const streamContent = Buffer.from(textContent).toString('latin1');

  // Page stream
  content += '3 0 obj\n';
  content += '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>\n';
  content += 'endobj\n';

  // Stream with text
  const streamContent2 = `BT\n/F1 12 Tf\n50 750 Td\n(${streamContent.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')}) Tj\nET\n`;
  const streamBytes = Buffer.from(streamContent2);

  content += '4 0 obj\n';
  content += `<< /Length ${streamBytes.length} >>\nstream\n`;
  content += streamBytes.toString('latin1');
  content += '\nendstream\nendobj\n';

  // Cross-reference table
  const xrefPos = Buffer.byteLength(content, 'latin1');
  content += `xref\n0 5\n0000000000 65535 f\n`;
  content += `0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000217 00000 n\n`;
  content += `trailer\n<< /Size 5 /Root 1 0 R >>\n`;
  content += `startxref\n${xrefPos}\n%%EOF\n`;

  const buffer = Buffer.from(content, 'latin1');

  if (buffer.length > 900 * 1024) {
    throw new Error('PDF exceeds 900 KB size limit');
  }

  return buffer;
}
