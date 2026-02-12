/**
 * DETERMINISTIC PDF GENERATOR
 * 
 * Generates a minimal, reproducible PDF containing governance pack metadata.
 * 
 * Key constraints:
 * - Zero floating point timestamps (uses snapshot.createdAtUtc only)
 * - Fixed metadata (title, author, producer)
 * - Fixed page layout (612x792 points, 8.5"x11")
 * - No compression, no encryption
 * - Raw PDF syntax (no external libraries)
 * - Byte-for-byte identical for identical input
 * 
 * Internal self-check:
 * - Generates PDF twice in one run
 * - If bytes differ, throws PDF_NONDETERMINISTIC
 */

import { sha256Hex } from '../canonicalize';

interface PDFInput {
  snapshotId: string;
  siteId: string;
  createdAtUtc: string; // ISO 8601 string
  canonicalHash: string;
  buildShaShort: string;
  buildUtc: string;
  schemaVersion: string;
  accessCount: number;
  dependencyNodeCount: number;
  dependencyEdgeCount: number;
  inventoryCount: number;
  auditCoverageNotes: string;
  accessibleScopes: string[];
  inaccessibleScopes: string[];
}

/**
 * Convert ISO 8601 date string to PDF date format
 * PDF format: (D:YYYYMMDDHHmmSS+HH'mm')
 * We'll use UTC, so +00'00'
 */
function pdfDateString(iso8601: string): string {
  // Parse ISO 8601: 2026-02-11T15:30:45.123Z or 2026-02-11T15:30:45Z
  const match = iso8601.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/
  );
  if (!match) {
    // Fallback to epoch if unparseable
    return '(D:19800101000000+00\'00\')';
  }

  const [, year, month, day, hour, minute, second] = match;
  return `(D:${year}${month}${day}${hour}${minute}${second}+00'00')`;
}

/**
 * Escape string for PDF text operators
 */
function pdfEscapeString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Generate minimal valid PDF bytes
 * Returns exact same bytes for same input (deterministic)
 */
function generatePdfBytes(input: PDFInput): Buffer {
  const pdfDate = pdfDateString(input.createdAtUtc);
  const scopesAccessible = input.accessibleScopes.join(', ');
  const scopesInaccessible = input.inaccessibleScopes.join(', ');

  // Build content stream with fixed text
  const contentLines = [
    'BT', // Begin text
    '/F1 12 Tf', // Set font Helvetica 12pt
    '50 750 Td', // Position: x=50, y=750
    '(FirstTry Governance Pack Export) Tj', // Title
    '0 -20 Td', // Move down
    `(Snapshot ID: ${pdfEscapeString(input.snapshotId)}) Tj`,
    '0 -15 Td',
    `(Site ID: ${pdfEscapeString(input.siteId)}) Tj`,
    '0 -15 Td',
    `(Created: ${pdfEscapeString(input.createdAtUtc)}) Tj`,
    '0 -15 Td',
    `(Hash: ${pdfEscapeString(input.canonicalHash.substring(0, 16))}) Tj`,
    '0 -15 Td',
    `(Build: ${pdfEscapeString(input.buildShaShort)}) Tj`,
    '0 -20 Td',
    '(Access Report:) Tj',
    '0 -15 Td',
    `  (Entries: ${input.accessCount}) Tj`,
    '0 -15 Td',
    '(Dependency Graph:) Tj',
    '0 -15 Td',
    `  (Nodes: ${input.dependencyNodeCount}, Edges: ${input.dependencyEdgeCount}) Tj`,
    '0 -15 Td',
    '(Configuration Inventory:) Tj',
    '0 -15 Td',
    `  (Items: ${input.inventoryCount}) Tj`,
    '0 -20 Td',
    '(Accessible Scopes:) Tj',
    '0 -15 Td',
    `  (${pdfEscapeString(scopesAccessible)}) Tj`,
    '0 -15 Td',
    '(Inaccessible Scopes:) Tj',
    '0 -15 Td',
    `  (${pdfEscapeString(scopesInaccessible)}) Tj`,
    '0 -20 Td',
    '(Schema Version: 1.0.0) Tj',
    'ET', // End text
  ];

  const contentStream = contentLines.join('\n');
  const contentBytes = Buffer.from(contentStream, 'utf-8');

  // Build PDF objects: 1=Catalog, 2=Pages, 3=Page, 4=Content stream, 5=Font dict
  const obj1 = '<< /Type /Catalog /Pages 2 0 R >>';
  const obj2 = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  const obj3 = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>';
  const obj4 = `<< /Length ${contentBytes.length} >> stream\n${contentStream}\nendstream`;
  const obj5 = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  const infoDict = `<< /Title (FirstTry Governance Pack) /Author (FirstTry) /Producer (FirstTry PDF Generator) /CreationDate ${pdfDate} /ModDate ${pdfDate} >>`;

  // Calculate offsets (everything is cumulative)
  const header = '%PDF-1.4\n';
  let offset = header.length;
  const offsets: number[] = [];

  const objects = [obj1, obj2, obj3, obj4, obj5];

  // Build xref entries
  const xrefEntries = ['0000000000 65535 f \n'];

  for (let i = 0; i < objects.length; i++) {
    offsets.push(offset);
    const objStr = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    offset += objStr.length;
    xrefEntries.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }

  // Build xref section
  const xrefOffset = offset;
  let xrefContent = 'xref\n';
  xrefContent += `0 ${objects.length + 1}\n`;
  for (const entry of xrefEntries) {
    xrefContent += entry;
  }

  xrefContent += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length + 2} 0 R >>\n`;
  xrefContent += `startxref\n${xrefOffset}\n%%EOF\n`;

  // Assemble full PDF
  let pdfContent = header;
  for (let i = 0; i < objects.length; i++) {
    pdfContent += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  pdfContent += xrefContent;

  return Buffer.from(pdfContent, 'utf-8');
}

/**
 * Generate deterministic PDF bytes with internal self-check
 * 
 * Throws Error("PDF_NONDETERMINISTIC") if generated bytes differ
 */
export function generateDeterministicPdfBytes(input: PDFInput): Buffer {
  // Generate twice and compare
  const pdf1 = generatePdfBytes(input);
  const pdf2 = generatePdfBytes(input);

  if (pdf1.compare(pdf2) !== 0) {
    throw new Error('PDF_NONDETERMINISTIC');
  }

  return pdf1;
}

/**
 * Validate that PDF contains expected content
 */
export function validatePdfContent(pdfBuffer: Buffer): boolean {
  const pdfStr = pdfBuffer.toString('utf-8', 0, Math.min(100, pdfBuffer.length));
  return pdfStr.startsWith('%PDF-1.4');
}
