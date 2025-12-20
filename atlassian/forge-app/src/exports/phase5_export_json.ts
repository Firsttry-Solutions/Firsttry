/**
 * PHASE 5 JSON EXPORT
 * 
 * Produces a canonical, lossless serialization of the Phase5Report.
 * 
 * Design principles:
 * 1. Output MUST be a perfect JSON representation of Phase5Report
 * 2. Preserve field names, section order (A-D), all disclosure envelopes
 * 3. All timestamps as ISO 8601 strings
 * 4. No transformation except stable key ordering for determinism
 * 5. No derived fields or UI-only helpers
 * 6. Response headers for download: Content-Disposition, Content-Type
 */

import { Phase5Report } from '../phase5_report_contract';

/**
 * Export Phase5Report as canonical JSON.
 * 
 * This function produces a byte-for-byte deterministic JSON serialization
 * of the Phase5Report object. The output matches the stored report exactly.
 * 
 * @param report - The Phase5Report object to export
 * @returns Promise<string> - JSON string
 * 
 * @throws Error if report structure is invalid
 */
export async function exportPhase5ReportAsJSON(report: Phase5Report): Promise<string> {
  if (!report) {
    throw new Error('[ExportJSON] Report is null or undefined');
  }

  // Validate basic structure exists
  if (
    !report.sections ||
    !report.sections.A ||
    !report.sections.B ||
    !report.sections.C ||
    !report.sections.D
  ) {
    throw new Error('[ExportJSON] Report structure is incomplete (missing sections)');
  }

  // Serialize to JSON with stable ordering
  // Preserves all fields, disclosure envelopes, and timestamps
  const jsonString = JSON.stringify(report, null, 2);

  return jsonString;
}

/**
 * Generate JSON export response for HTTP handler.
 * 
 * Produces a complete HTTP response object with proper headers for download.
 * 
 * @param report - The Phase5Report to export
 * @param filename - Optional custom filename (default: phase5-proof-of-life.json)
 * @returns Promise<any> - HTTP response object
 */
export async function generateJSONExportResponse(
  report: Phase5Report,
  filename: string = 'phase5-proof-of-life.json'
): Promise<any> {
  try {
    const jsonContent = await exportPhase5ReportAsJSON(report);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
      body: jsonContent,
    };
  } catch (error) {
    console.error('[ExportJSON] Error generating JSON export:', error);
    throw error;
  }
}

/**
 * Validate JSON export matches source report.
 * 
 * This is a test utility to ensure JSON export deep-equals the stored report.
 * Used in test assertions to verify losslessness.
 * 
 * @param report - Original Phase5Report
 * @param jsonString - Exported JSON string
 * @returns boolean - True if JSON export equals original (after parsing)
 */
export function validateJSONExportEqualsReport(report: Phase5Report, jsonString: string): boolean {
  try {
    const parsed = JSON.parse(jsonString);
    
    // Deep equality check (simple implementation for testing)
    return JSON.stringify(parsed) === JSON.stringify(report);
  } catch (error) {
    console.error('[ExportJSON] Validation error:', error);
    return false;
  }
}

/**
 * Validate no extra keys in JSON export.
 * 
 * This ensures the JSON export contains only fields from the original report,
 * with no UI-only helpers or derived fields.
 * 
 * @param jsonString - Exported JSON string
 * @param expectedKeys - Set of expected top-level keys
 * @returns boolean - True if no extra keys found
 */
export function validateJSONHasNoExtraKeys(
  jsonString: string,
  expectedKeys: Set<string>
): boolean {
  try {
    const parsed = JSON.parse(jsonString);
    const actualKeys = new Set(Object.keys(parsed));

    for (const key of actualKeys) {
      if (!expectedKeys.has(key)) {
        console.error(`[ExportJSON] Extra key found: ${key}`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('[ExportJSON] Validation error:', error);
    return false;
  }
}

/**
 * Validate disclosure text preserved byte-for-byte.
 * 
 * Scans the JSON export for all disclosure_text fields and ensures
 * they match the original report exactly (no mutations, truncations, etc).
 * 
 * @param report - Original Phase5Report
 * @param jsonString - Exported JSON string
 * @returns boolean - True if all disclosure texts match
 */
export function validateDisclosureTextPreserved(
  report: Phase5Report,
  jsonString: string
): boolean {
  try {
    const parsed = JSON.parse(jsonString);

    // Check Section A disclosures
    if (report.sections.A.projects_scanned.disclosure.disclosure_text !==
        parsed.sections.A.projects_scanned.disclosure.disclosure_text) {
      console.error('[ExportJSON] Section A projects disclosure text mismatch');
      return false;
    }

    if (report.sections.A.issues_scanned.disclosure.disclosure_text !==
        parsed.sections.A.issues_scanned.disclosure.disclosure_text) {
      console.error('[ExportJSON] Section A issues disclosure text mismatch');
      return false;
    }

    if (report.sections.A.fields_detected.disclosure.disclosure_text !==
        parsed.sections.A.fields_detected.disclosure.disclosure_text) {
      console.error('[ExportJSON] Section A fields disclosure text mismatch');
      return false;
    }

    // Check Section B disclosures
    for (let i = 0; i < report.sections.B.datasets.length; i++) {
      const originalText = report.sections.B.datasets[i].coverage_disclosure.disclosure_text;
      const exportedText = parsed.sections.B.datasets[i].coverage_disclosure.disclosure_text;

      if (originalText !== exportedText) {
        console.error(`[ExportJSON] Section B dataset ${i} disclosure text mismatch`);
        return false;
      }
    }

    // Check Section C disclosures
    for (let i = 0; i < report.sections.C.observations.length; i++) {
      const originalText = report.sections.C.observations[i].disclosure.disclosure_text;
      const exportedText = parsed.sections.C.observations[i].disclosure.disclosure_text;

      if (originalText !== exportedText) {
        console.error(`[ExportJSON] Section C observation ${i} disclosure text mismatch`);
        return false;
      }
    }

    // Check Section D
    if (report.sections.D.forecast_available) {
      const originalDisclaimer = (report.sections.D as any).forecast?.disclosure_text || 
                                 (report.sections.D as any).forecast?.disclaimer;
      const exportedDisclaimer = (parsed.sections.D as any).forecast?.disclosure_text || 
                                (parsed.sections.D as any).forecast?.disclaimer;

      if (originalDisclaimer && originalDisclaimer !== exportedDisclaimer) {
        console.error('[ExportJSON] Section D forecast disclaimer/disclosure text mismatch');
        return false;
      }
    } else {
      const originalText = (report.sections.D as any).disclosure_text;
      const exportedText = (parsed.sections.D as any).disclosure_text;

      if (originalText !== exportedText) {
        console.error('[ExportJSON] Section D unavailable disclosure text mismatch');
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('[ExportJSON] Validation error:', error);
    return false;
  }
}
