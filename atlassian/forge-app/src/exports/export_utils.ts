/**
 * EXPORT UTILITIES
 * 
 * Shared utilities for export handlers.
 * 
 * Includes:
 * - Error handling
 * - Validation helpers
 * - Response builders
 * - Language safety checks
 */

import {
  Phase5Report,
  validatePhase5ReportStructure,
} from '../phase5_report_contract';
import {
  rejectPhase5Signals,
} from '../disclosure_hardening_gaps_a_f';

/**
 * Validate report before export.
 * 
 * Ensures report structure is intact and passes all safety checks.
 * 
 * @param report - Report to validate
 * @throws Error if validation fails
 */
export function validateReportBeforeExport(report: Phase5Report): void {
  if (!report) {
    throw new Error('[ExportUtils] Report is null or undefined');
  }

  // Validate structure
  try {
    validatePhase5ReportStructure(report);
  } catch (error) {
    throw new Error(`[ExportUtils] Report structure validation failed: ${error}`);
  }

  // Reject Phase-5 signals
  try {
    rejectPhase5Signals(report, 'Export validation');
  } catch (error) {
    throw new Error(`[ExportUtils] Phase-5 signal rejection failed: ${error}`);
  }
}

/**
 * Generate error response for failed export.
 * 
 * @param statusCode - HTTP status code (400, 500, etc)
 * @param errorCode - Machine-readable error code
 * @param message - Human-readable error message
 * @returns HTTP response object
 */
export function generateExportErrorResponse(
  statusCode: number,
  errorCode: string,
  message: string
): any {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      error: errorCode,
      message,
      timestamp: new Date().toISOString(),
    }),
  };
}

/**
 * Escape text for safe inclusion in exported documents.
 * 
 * @param text - Text to escape
 * @returns Escaped text
 */
export function escapeExportText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // For JSON, JSON.stringify handles escaping
  // For PDF/text, we just ensure no null bytes
  return text.replace(/\0/g, '');
}

/**
 * Validate export filename.
 * 
 * Ensures filename is safe (no path traversal, no special chars).
 * 
 * @param filename - Filename to validate
 * @returns boolean - True if filename is safe
 */
export function isValidExportFilename(filename: string): boolean {
  if (!filename || typeof filename !== 'string') {
    return false;
  }

  // Must end with valid extension
  if (!filename.match(/\.(json|pdf)$/i)) {
    return false;
  }

  // No path traversal
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return false;
  }

  // No special chars that could break headers
  if (filename.includes('"') || filename.includes('\n') || filename.includes('\r')) {
    return false;
  }

  // Max length
  if (filename.length > 255) {
    return false;
  }

  return true;
}

/**
 * Generate safe export filename from report.
 * 
 * Creates a deterministic filename based on report metadata.
 * Format: phase5-proof-of-life-{trigger}-{timestamp}.{ext}
 * 
 * @param report - Phase5Report
 * @param format - Export format ('json' or 'pdf')
 * @returns string - Safe filename
 */
export function generateExportFilename(report: Phase5Report, format: 'json' | 'pdf'): string {
  const trigger = report.trigger.toLowerCase().replace(/_/g, '-');
  const timestamp = new Date(report.generated_at).toISOString().slice(0, 10); // YYYY-MM-DD
  
  return `phase5-proof-of-life-${trigger}-${timestamp}.${format}`;
}

/**
 * Validate export meets size limits.
 * 
 * @param content - Export content (JSON string or PDF text)
 * @param format - Export format
 * @returns boolean - True if size is acceptable
 */
export function validateExportSize(content: string, format: 'json' | 'pdf'): boolean {
  const sizeInBytes = Buffer.byteLength(content, 'utf-8');
  const maxSize = format === 'json' ? 10 * 1024 * 1024 : 50 * 1024 * 1024; // 10MB JSON, 50MB PDF

  if (sizeInBytes > maxSize) {
    console.error(
      `[ExportUtils] Export exceeds size limit: ${sizeInBytes} bytes > ${maxSize} bytes`
    );
    return false;
  }

  return true;
}

/**
 * Log export action (for audit trail).
 * 
 * @param cloudId - Tenant identifier
 * @param format - Export format
 * @param reportId - Report ID being exported
 * @param success - Whether export succeeded
 * @param error - Error message if failed
 */
export function logExportAction(
  cloudId: string,
  format: 'json' | 'pdf',
  reportId: string,
  success: boolean,
  error?: string
): void {
  const logLevel = success ? 'info' : 'error';
  const timestamp = new Date().toISOString();

  console.log(
    `[ExportLog] ${timestamp} | ${logLevel.toUpperCase()} | ` +
    `Cloud: ${cloudId} | Format: ${format} | Report: ${reportId} | ` +
    `${success ? 'SUCCESS' : `FAILED: ${error}`}`
  );
}

/**
 * Assert export invariants.
 * 
 * Checks that export maintains all required properties.
 * Used in tests to verify correctness.
 * 
 * @param report - Original report
 * @param exportContent - Export content (JSON string or PDF text)
 * @param format - Export format
 * @throws Error if invariants violated
 */
export function assertExportInvariants(
  report: Phase5Report,
  exportContent: string,
  format: 'json' | 'pdf'
): void {
  if (format === 'json') {
    // JSON must parse successfully
    try {
      const parsed = JSON.parse(exportContent);
      // Must have all sections
      if (!parsed.sections || !parsed.sections.A || !parsed.sections.B || 
          !parsed.sections.C || !parsed.sections.D) {
        throw new Error('Parsed JSON missing required sections');
      }
    } catch (error) {
      throw new Error(`[ExportUtils] JSON export invariant violation: ${error}`);
    }
  } else if (format === 'pdf') {
    // PDF must contain section headers
    const requiredHeaders = [
      'A) WHAT WE COLLECTED',
      'B) COVERAGE DISCLOSURE',
      'C) PRELIMINARY OBSERVATIONS',
      'D) FORECAST',
    ];
    for (const header of requiredHeaders) {
      if (!exportContent.includes(header)) {
        throw new Error(`[ExportUtils] PDF missing section header: ${header}`);
      }
    }

    // PDF must contain mandatory footer
    if (!exportContent.includes('Disclosure-first report')) {
      throw new Error('[ExportUtils] PDF missing mandatory footer');
    }
  }
}
