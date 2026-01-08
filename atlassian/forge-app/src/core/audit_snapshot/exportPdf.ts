/**
 * PDF Export from Trust Snapshot
 * 
 * Generates professional-grade, deterministic PDF from TrustSnapshot data.
 * Uses pdf-lib (pure JavaScript) for maximum Forge runtime compatibility.
 * 
 * Output is deterministic (byte-for-byte identical) for identical input.
 * Output must not exceed 900 KB (FAIL CLOSED if exceeded).
 * 
 * Determinism markers embedded in PDF metadata:
 * - PDF_LAYOUT_VERSION: tracks section layout and formatting
 * - PDF_ENGINE: identifies pdf-lib version
 * - All timestamps are parsed from record.generatedAtISO (no new Date() calls)
 */

import { PDFDocument, PDFPage, rgb, PageSizes, StandardFonts } from 'pdf-lib';
import { TrustSnapshot, SnapshotRecord } from './types';

// ============================================================================
// DETERMINISM MARKERS
// ============================================================================

const PDF_LAYOUT_VERSION = "PDF_LAYOUT_v1";
const PDF_ENGINE = "pdf-lib@1.17.1";

// ============================================================================
// HELPER FUNCTIONS FOR TEXT RENDERING
// ============================================================================

/**
 * Safe text conversion that handles any value
 */
function safeText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  return String(v);
}

/**
 * Wrap text to fit within max width
 * Returns array of lines
 */
function wrapText(
  text: string,
  maxWidth: number,
  fontSizePoints: number,
  characterWidthEstimate: number = 0.5
): string[] {
  if (!text) return [''];

  // Estimate characters that fit per line based on font size
  const avgCharsPerPoint = characterWidthEstimate;
  const maxCharsPerLine = Math.max(1, Math.floor(maxWidth / (fontSizePoints * avgCharsPerPoint)));

  const lines: string[] = [];
  const words = text.split(/\s+/);
  let currentLine = '';

  for (const word of words) {
    if (!word) continue;

    if (currentLine.length === 0) {
      currentLine = word;
    } else if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
      currentLine += ' ' + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}

/**
 * PDF rendering state tracker
 */
interface RenderState {
  pdfDoc: PDFDocument;
  pages: PDFPage[];
  currentPageIndex: number;
  cursorY: number;
  margin: number;
  pageWidth: number;
  pageHeight: number;
  fonts: {
    sans: any;
    sansBold: any;
    mono: any;
  };
}

/**
 * Create new page and redraw header
 */
function ensureSpace(state: RenderState, neededHeight: number): void {
  const minY = state.margin + 40; // Reserve space for footer

  if (state.cursorY - neededHeight < minY) {
    // Add new page
    const newPage = state.pdfDoc.addPage();
    state.pages.push(newPage);
    state.currentPageIndex = state.pages.length - 1;
    state.cursorY = state.pageHeight - state.margin;
    drawHeader(state);
  }
}

/**
 * Draw header on current page
 */
function drawHeader(state: RenderState): void {
  const page = state.pages[state.currentPageIndex];
  const headerY = state.pageHeight - state.margin + 10;

  page.drawText('FirstTry Trust Snapshot', {
    x: state.margin,
    y: headerY,
    size: 11,
    font: state.fonts.sansBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  page.drawText('Read-only evidence export', {
    x: state.pageWidth - state.margin - 200,
    y: headerY,
    size: 8,
    font: state.fonts.sans,
    color: rgb(0.4, 0.4, 0.4),
  });
}

/**
 * Draw footer with page numbers on current page
 * Note: Called at end when total page count is known
 */
function drawFooter(state: RenderState, pageNum: number, totalPages: number): void {
  const page = state.pages[state.currentPageIndex];
  const footerY = state.margin - 10;

  page.drawText(`Page ${pageNum} of ${totalPages}`, {
    x: state.margin,
    y: footerY,
    size: 8,
    font: state.fonts.sans,
    color: rgb(0.5, 0.5, 0.5),
  });

  page.drawText('FirstTry — Read-only evidence export', {
    x: state.pageWidth / 2 - 100,
    y: footerY,
    size: 8,
    font: state.fonts.sans,
    color: rgb(0.5, 0.5, 0.5),
  });
}

/**
 * Draw section title
 */
function sectionTitle(state: RenderState, title: string): void {
  ensureSpace(state, 20);

  const page = state.pages[state.currentPageIndex];
  page.drawText(title, {
    x: state.margin,
    y: state.cursorY,
    size: 12,
    font: state.fonts.sansBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  state.cursorY -= 16;
}

/**
 * Draw key-value table
 */
function kvTable(
  state: RenderState,
  rows: Array<{ label: string; value: string; mono?: boolean }>
): void {
  ensureSpace(state, rows.length * 14 + 10);

  const page = state.pages[state.currentPageIndex];
  const labelWidth = 120;
  const valueX = state.margin + labelWidth + 10;
  const maxValueWidth = state.pageWidth - valueX - state.margin - 10;

  for (const row of rows) {
    // Label (bold)
    page.drawText(safeText(row.label), {
      x: state.margin,
      y: state.cursorY,
      size: 9,
      font: state.fonts.sansBold,
      color: rgb(0.2, 0.2, 0.2),
    });

    // Value (wrapped if needed)
    const valueLines = wrapText(safeText(row.value), maxValueWidth, 9);
    const valueFont = row.mono ? state.fonts.mono : state.fonts.sans;

    page.drawText(valueLines[0] || '', {
      x: valueX,
      y: state.cursorY,
      size: 9,
      font: valueFont,
      color: rgb(0.15, 0.15, 0.15),
    });

    state.cursorY -= 12;

    // Draw wrapped lines
    for (let i = 1; i < valueLines.length; i++) {
      ensureSpace(state, 14);
      page.drawText(valueLines[i], {
        x: valueX,
        y: state.cursorY,
        size: 9,
        font: valueFont,
        color: rgb(0.15, 0.15, 0.15),
      });
      state.cursorY -= 12;
    }
  }

  state.cursorY -= 4; // Extra spacing after table
}

/**
 * Draw bullet list
 */
function bulletList(state: RenderState, title: string, bullets: string[]): void {
  sectionTitle(state, title);

  ensureSpace(state, bullets.length * 14 + 10);

  const page = state.pages[state.currentPageIndex];
  const bulletX = state.margin + 15;
  const textX = bulletX + 12;
  const maxWidth = state.pageWidth - textX - state.margin - 10;

  for (const bullet of bullets) {
    ensureSpace(state, 14);

    // Bullet point
    page.drawCircle({
      x: bulletX,
      y: state.cursorY - 3,
      size: 2,
      color: rgb(0.3, 0.3, 0.3),
    });

    // Text (wrapped)
    const lines = wrapText(safeText(bullet), maxWidth, 9);
    page.drawText(lines[0] || '', {
      x: textX,
      y: state.cursorY,
      size: 9,
      font: state.fonts.sans,
      color: rgb(0.15, 0.15, 0.15),
    });

    state.cursorY -= 12;

    for (let i = 1; i < lines.length; i++) {
      ensureSpace(state, 14);
      page.drawText(lines[i], {
        x: textX,
        y: state.cursorY,
        size: 9,
        font: state.fonts.sans,
        color: rgb(0.15, 0.15, 0.15),
      });
      state.cursorY -= 12;
    }
  }

  state.cursorY -= 4;
}

// ============================================================================
// MAIN PDF GENERATION
// ============================================================================

/**
 * Generate PDF buffer from TrustSnapshot
 * 
 * Returns deterministic PDF bytes.
 * Throws with PDF_TOO_LARGE if buffer exceeds 900 KB.
 * Throws with PDF_INVALID if generated PDF is malformed.
 */
export async function generateTrustSnapshotPdf(
  snapshot: TrustSnapshot,
  record: SnapshotRecord
): Promise<Buffer> {
  // Create PDF document with deterministic settings
  const pdfDoc = await PDFDocument.create();

  // Embed determinism markers in metadata
  pdfDoc.setTitle('FirstTry Trust Snapshot');
  pdfDoc.setSubject('Read-only evidence report');
  pdfDoc.setKeywords([
    'FirstTry Trust Snapshot',
    'Evidence Identity',
    'Operational State',
    'Monitoring Continuity',
    'Configuration Risk Summary',
    'Change Summary',
    'App Behavior Guarantees',
    'Issues',
    PDF_LAYOUT_VERSION,
    PDF_ENGINE,
  ]);
  pdfDoc.setCreator(`FirstTry PDF Generator (${PDF_ENGINE})`);
  pdfDoc.setProducer(`pdf-lib (${PDF_ENGINE}, layout ${PDF_LAYOUT_VERSION})`);

  // Embed creation date from record (deterministic, not from Date.now())
  // Parse timestamp string to get date without timezone variations
  const creationDate = new Date(record.generatedAtISO);
  pdfDoc.setCreationDate(creationDate);

  // Create first page (A4: 595.28 × 841.89 points)
  const pageWidth = PageSizes.A4[0];
  const pageHeight = PageSizes.A4[1];
  const firstPage = pdfDoc.addPage([pageWidth, pageHeight]);

  // Embed fonts for maximum determinism (standard fonts)
  const sansBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const sans = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const mono = await pdfDoc.embedFont(StandardFonts.Courier);

  const margin = 50;

  // Initialize render state
  const state: RenderState = {
    pdfDoc,
    pages: [firstPage],
    currentPageIndex: 0,
    cursorY: pageHeight - margin - 20,
    margin,
    pageWidth,
    pageHeight,
    fonts: {
      sans,
      sansBold,
      mono,
    },
  };

  // Draw header on first page
  drawHeader(state);

  // ========================================================================
  // SECTION 1: Evidence Identity
  // ========================================================================
  sectionTitle(state, 'Evidence Identity');
  kvTable(state, [
    { label: 'Snapshot ID', value: record.snapshotId, mono: true },
    { label: 'JSON SHA256', value: record.jsonSha256, mono: true },
    { label: 'Generated At (UTC)', value: String(record.generatedAtISO).substring(0, 19) },
    { label: 'App Version', value: snapshot.versioning.appVersion },
    { label: 'Environment', value: snapshot.versioning.environment },
  ]);

  // ========================================================================
  // SECTION 2: Operational State
  // ========================================================================
  sectionTitle(state, 'Operational State');
  kvTable(state, [
    { label: 'Status', value: snapshot.operationalState.status },
    {
      label: 'Last Successful Run (UTC)',
      value: snapshot.operationalState.lastSuccessfulRunAtISO
        ? String(snapshot.operationalState.lastSuccessfulRunAtISO).substring(0, 19)
        : 'Not available',
    },
    {
      label: 'Days Operational',
      value:
        snapshot.operationalState.consecutiveDaysOperational !== null
          ? String(snapshot.operationalState.consecutiveDaysOperational)
          : 'Not available',
    },
  ]);

  // ========================================================================
  // SECTION 3: Monitoring Continuity
  // ========================================================================
  sectionTitle(state, 'Monitoring Continuity');
  kvTable(state, [
    { label: 'Scheduler Active', value: String(snapshot.monitoringContinuity.schedulerActive) },
    {
      label: 'Last Run (UTC)',
      value: snapshot.monitoringContinuity.lastRunAtISO
        ? String(snapshot.monitoringContinuity.lastRunAtISO).substring(0, 19)
        : 'Not available',
    },
    { label: 'Data Completeness', value: snapshot.monitoringContinuity.dataCompleteness },
  ]);

  // ========================================================================
  // SECTION 4: Configuration Risk Summary
  // ========================================================================
  sectionTitle(state, 'Configuration Risk Summary');
  kvTable(state, [
    { label: 'Risk Band', value: snapshot.configurationRiskSummary.riskBand },
    {
      label: 'Metrics Included',
      value: snapshot.configurationRiskSummary.metricsIncluded.length > 0
        ? snapshot.configurationRiskSummary.metricsIncluded.join(', ')
        : '(none)',
    },
    {
      label: 'Evaluated At (UTC)',
      value: snapshot.configurationRiskSummary.evaluatedAtISO
        ? String(snapshot.configurationRiskSummary.evaluatedAtISO).substring(0, 19)
        : 'Not available',
    },
  ]);

  // ========================================================================
  // SECTION 5: Change Summary
  // ========================================================================
  sectionTitle(state, 'Change Summary');
  kvTable(state, [
    { label: 'Event Count', value: String(snapshot.changeSummary.eventCount) },
    {
      label: 'Categories',
      value: snapshot.changeSummary.categoriesPresent.length > 0
        ? snapshot.changeSummary.categoriesPresent.join(', ')
        : '(none)',
    },
    {
      label: 'Last Change (UTC)',
      value: snapshot.changeSummary.lastChangeAtISO
        ? String(snapshot.changeSummary.lastChangeAtISO).substring(0, 19)
        : 'Not available',
    },
  ]);

  // ========================================================================
  // SECTION 6: App Behavior Guarantees
  // ========================================================================
  sectionTitle(state, 'App Behavior Guarantees');
  kvTable(state, [
    { label: 'Read-Only', value: String(snapshot.appBehaviorGuarantees.readOnly) },
    { label: 'No Jira Writes', value: String(snapshot.appBehaviorGuarantees.noJiraWrites) },
    { label: 'No Config Changes', value: String(snapshot.appBehaviorGuarantees.noConfigChanges) },
    { label: 'No Enforcement', value: String(snapshot.appBehaviorGuarantees.noEnforcement) },
  ]);

  // ========================================================================
  // SECTION 7: Issues
  // ========================================================================
  if (snapshot.issues.length === 0) {
    sectionTitle(state, 'Issues');
    ensureSpace(state, 14);
    const page = state.pages[state.currentPageIndex];
    page.drawText('No issues recorded.', {
      x: state.margin,
      y: state.cursorY,
      size: 9,
      font: state.fonts.sans,
      color: rgb(0.15, 0.15, 0.15),
    });
    state.cursorY -= 12;
  } else {
    const issueBullets = snapshot.issues.map(
      (issue) => `${issue.source}: ${issue.reason} (${issue.errorCode})`
    );
    bulletList(state, 'Issues', issueBullets);
  }

  // ========================================================================
  // SECTION 8: Evidence Notes
  // ========================================================================
  sectionTitle(state, 'Evidence Notes');
  ensureSpace(state, 28);
  const page = state.pages[state.currentPageIndex];

  const notes = [
    'This PDF is derived from the canonical snapshot JSON identified by JSON SHA256 above.',
    'FirstTry is observational only and performs no Jira writes.',
  ];

  for (const note of notes) {
    const lines = wrapText(note, state.pageWidth - state.margin * 2 - 10, 8);
    for (const line of lines) {
      ensureSpace(state, 12);
      page.drawText(line, {
        x: state.margin,
        y: state.cursorY,
        size: 8,
        font: state.fonts.sans,
        color: rgb(0.3, 0.3, 0.3),
      });
      state.cursorY -= 11;
    }
    state.cursorY -= 2;
  }

  // ========================================================================
  // ADD FOOTERS TO ALL PAGES NOW THAT TOTAL COUNT IS KNOWN
  // ========================================================================
  const totalPages = state.pages.length;
  for (let i = 0; i < totalPages; i++) {
    state.currentPageIndex = i;
    drawFooter(state, i + 1, totalPages);
  }

  // ========================================================================
  // SAVE AND VALIDATE
  // ========================================================================

  // Save with deterministic settings (no object streams to maximize consistency)
  const pdfBytes = await pdfDoc.save({ useObjectStreams: false });

  // Validate PDF structure
  assertPdfLooksValid(pdfBytes);

  return Buffer.from(pdfBytes);
}

/**
 * Validate that the generated PDF is well-formed
 * Throws PDF_INVALID if not valid
 * Throws PDF_TOO_LARGE if buffer exceeds 900 KB
 */
function assertPdfLooksValid(bytes: Uint8Array): void {
  // Check minimum size
  if (bytes.length < 20) {
    throw new Error('PDF_INVALID: buffer too small');
  }

  // Check PDF header
  const header = Buffer.from(bytes.slice(0, 5)).toString('utf8');
  if (header !== '%PDF-') {
    throw new Error('PDF_INVALID: missing PDF header');
  }

  // Check EOF marker
  const tail = Buffer.from(bytes.slice(-20)).toString('utf8');
  if (!tail.includes('%%EOF')) {
    throw new Error('PDF_INVALID: missing EOF marker');
  }

  // Check size limit
  if (bytes.length > 900 * 1024) {
    throw new Error(`PDF_TOO_LARGE: ${bytes.length} bytes (limit 900 KB)`);
  }
}
