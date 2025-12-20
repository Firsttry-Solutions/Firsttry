/**
 * PHASE 5 SECTION HEADINGS — SINGLE SOURCE OF TRUTH
 * 
 * These headings are used in:
 * 1. Admin UI (phase5_admin_page.ts)
 * 2. PDF export (phase5_export_pdf.ts)
 * 3. Tests (phase5_export.test.ts and elsewhere)
 * 4. Report contract (phase5_report_contract.ts)
 * 
 * By centralizing them here, we enforce that:
 * - No one can accidentally rename a heading in UI without breaking PDF tests
 * - No accidental editorialization ("Insights", "Summary", etc.)
 * - Parity is mechanically enforced, not by convention
 * 
 * CRITICAL: These are literal strings that appear in the Phase5Report contract.
 * If you change them here, you MUST update the report contract as well.
 */

export const PHASE5_SECTION_HEADINGS = {
  A: 'A) WHAT WE COLLECTED',
  B: 'B) COVERAGE DISCLOSURE',
  C: 'C) PRELIMINARY OBSERVATIONS',
  D: 'D) FORECAST',
} as const;

/**
 * Type-safe way to reference headings in code.
 * This ensures you can't typo a heading name.
 */
export type Phase5SectionKey = keyof typeof PHASE5_SECTION_HEADINGS;

/**
 * Helper: Get heading by section letter.
 * 
 * @param section - 'A', 'B', 'C', or 'D'
 * @returns The heading string
 * @throws if section is invalid
 */
export function getPhase5SectionHeading(section: Phase5SectionKey): string {
  return PHASE5_SECTION_HEADINGS[section];
}

/**
 * Helper: Verify a heading is valid.
 * 
 * @param heading - The heading string to check
 * @returns true if heading is in PHASE5_SECTION_HEADINGS
 */
export function isValidPhase5Heading(heading: string): boolean {
  return Object.values(PHASE5_SECTION_HEADINGS).includes(heading as any);
}

/**
 * Helper: Get all headings as an array.
 * Useful for tests that iterate over all sections.
 * 
 * @returns Array of heading strings: ['A) WHAT WE COLLECTED', 'B) COVERAGE DISCLOSURE', ...]
 */
export function getAllPhase5Headings(): string[] {
  return Object.values(PHASE5_SECTION_HEADINGS);
}
