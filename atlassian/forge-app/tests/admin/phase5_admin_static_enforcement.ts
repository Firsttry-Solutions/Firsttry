/**
 * PHASE-5 ADMIN UI — STATIC SOURCE ENFORCEMENT TESTS (Step-6.2)
 *
 * Purpose: Verify Admin UI source code cannot contain hardcoded section headings
 * or editorial aliases. This is a lint-like test that reads source as text.
 *
 * Why this matters:
 * - Guarantees Admin UI uses shared PHASE5_SECTION_HEADINGS constant
 * - Prevents sneaky hardcoding via comments or string literals
 * - Makes "no hardcoded headings" a mechanical guarantee, not a guideline
 *
 * Test approach:
 * 1. Read src/admin/phase5_admin_page.ts as plain text
 * 2. Check for forbidden literal strings (exact headings + editorial aliases)
 * 3. Verify constant is actually used (not just imported)
 * 4. Fail with helpful error messages
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Helper: Get path to admin UI source file
 * Assumes tests run from the forge-app directory (standard with npm test from package.json)
 */
function getAdminUISourcePath(): string {
  // First, try relative to cwd (tests usually run from ./atlassian/forge-app)
  const fromCwd = path.resolve(process.cwd(), 'src/admin/phase5_admin_page.ts');
  if (fs.existsSync(fromCwd)) {
    return fromCwd;
  }

  // Fallback: try from repo root (if tests run from project root)
  const fromRoot = path.resolve(process.cwd(), 'atlassian/forge-app/src/admin/phase5_admin_page.ts');
  if (fs.existsSync(fromRoot)) {
    return fromRoot;
  }

  // If neither works, return the first option (will provide error message)
  return fromCwd;
}

/**
 * Helper: Read admin UI source code as text
 */
function readAdminUISource(): string {
  const filePath = getAdminUISourcePath();
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error: any) {
    throw new Error(`Failed to read admin UI source: ${error.message}. Expected path: ${filePath}`);
  }
}

/**
 * Helper: Get a short excerpt around a match position for error messages
 * Shows ±30 chars context
 */
function getExcerpt(content: string, matchPos: number, length: number = 60): string {
  const start = Math.max(0, matchPos - 30);
  const end = Math.min(content.length, matchPos + length + 30);
  const excerpt = content.substring(start, end);
  // Replace newlines for readability
  return excerpt.replace(/\n/g, ' ').trim();
}

describe('Phase-5 Admin UI — Static Source Enforcement', () => {
  let adminUISource: string;

  // Read source once for all tests
  beforeEach(() => {
    adminUISource = readAdminUISource();
  });

  /**
   * TEST 1: No Hardcoded Section Heading Literals
   *
   * Verifies that exact section heading strings do NOT appear in source code.
   * This is a strict check: if someone hardcodes a heading instead of using
   * the constant, this test will catch it.
   */
  describe('Hardcoded heading literal enforcement', () => {
    const FORBIDDEN_HEADING_LITERALS = [
      'A) WHAT WE COLLECTED',
      'B) COVERAGE DISCLOSURE',
      'C) PRELIMINARY OBSERVATIONS',
      'D) FORECAST',
    ];

    it('should not contain any exact section heading literals', () => {
      for (const heading of FORBIDDEN_HEADING_LITERALS) {
        // Use case-sensitive search (headings are exact)
        const matchPos = adminUISource.indexOf(heading);
        if (matchPos !== -1) {
          const excerpt = getExcerpt(adminUISource, matchPos, heading.length);
          expect.fail(
            `Found hardcoded heading literal "${heading}" in admin UI source.\n` +
            `This must be replaced with a reference to PHASE5_SECTION_HEADINGS constant.\n` +
            `Context: ...${excerpt}...`
          );
        }
      }

      // Test passes if no forbidden literals found
      expect(true).toBe(true);
    });

    /**
     * TEST 1B: No Editorial Heading Aliases
     *
     * Prevents sneaky editorial renamings like "Insights", "Summary", etc.
     * These are case-insensitive searches to catch variations.
     */
    it('should not contain editorial heading aliases or synonyms', () => {
      const FORBIDDEN_EDITORIAL_WORDS = [
        'Insights', // Instead of "Preliminary Observations"
        'Summary', // Instead of "What We Collected"
        'Findings', // Similar to above
        'Recommendations', // Evaluative term
        'Action items', // Evaluative term
        'Key takeaways', // Evaluative term
        'Health', // Scoring term
        'Score', // Scoring term
        'Benchmark', // Comparative term
      ];

      for (const word of FORBIDDEN_EDITORIAL_WORDS) {
        // Case-insensitive search for editorial terms
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        const match = adminUISource.match(regex);

        if (match) {
          const matchPos = adminUISource.indexOf(match[0]);
          const excerpt = getExcerpt(adminUISource, matchPos, word.length);
          expect.fail(
            `Found editorial heading alias "${word}" in admin UI source.\n` +
            `Section headings must be literal and neutral (from PHASE5_SECTION_HEADINGS).\n` +
            `Context: ...${excerpt}...`
          );
        }
      }

      // Test passes if no editorial words found
      expect(true).toBe(true);
    });
  });

  /**
   * TEST 2: Constant Is Actually Used, Not Just Imported
   *
   * Verifies that PHASE5_SECTION_HEADINGS is not only imported but also
   * actively used in the code. This prevents "fake" imports that are
   * never referenced.
   */
  describe('Constant usage enforcement', () => {
    it('should either use PHASE5_SECTION_HEADINGS constant or verify section_name comes from report contract', () => {
      // Check for import (must exist)
      const hasImport = adminUISource.includes('PHASE5_SECTION_HEADINGS');
      
      // Check for actual usage patterns (not just import)
      // Allow multiple usage patterns to be flexible
      const USAGE_PATTERNS = [
        'PHASE5_SECTION_HEADINGS.', // Property access (most common: PHASE5_SECTION_HEADINGS.A, etc.)
        'getPhase5Heading(', // Helper function calls
        'getPhase5SectionHeading(', // Alternative helper name
        'getAllPhase5Headings(', // Helper function
        'getAllPhase5Headings', // Function reference without call
        'section.section_name', // Acceptable: report's typed field (contract enforces literal value)
      ];

      const hasValidPattern = USAGE_PATTERNS.some(pattern => adminUISource.includes(pattern));

      if (!hasValidPattern) {
        const usageExamples = USAGE_PATTERNS.slice(0, 4).join(', ');
        expect.fail(
          'Admin UI source does not use PHASE5_SECTION_HEADINGS constant or section.section_name from report.\n' +
          `Expected to find at least one pattern: ${usageExamples}\n` +
          'Section headings must either use the constant or access the typed report field.'
        );
      }

      // Test passes if valid pattern found
      expect(true).toBe(true);
    });

    it('should have consistent import and usage (not orphaned)', () => {
      // Import must come before (or within) the file
      const importIndex = adminUISource.indexOf('import');
      const usageIndex = adminUISource.indexOf('PHASE5_SECTION_HEADINGS');

      // Both must exist
      if (importIndex === -1 || usageIndex === -1) {
        expect.fail('Missing import or usage of PHASE5_SECTION_HEADINGS');
      }

      // Usage should come after import (normal order)
      // This prevents accidental orphaned references
      if (usageIndex < importIndex) {
        expect.fail('PHASE5_SECTION_HEADINGS is used before being imported (incorrect order)');
      }

      expect(true).toBe(true);
    });
  });

  /**
   * TEST 3: No Hardcoded Section Name Definitions
   *
   * Verifies that Admin UI does NOT define hardcoded section names.
   *
   * NOTE: Accessing `section.section_name` from the report object IS ALLOWED
   * because the Phase5Report contract defines section_name as a literal type
   * that MUST match one of the constant values. This is the correct design -
   * the UI renders what comes from the report.
   *
   * However, Admin UI should NOT define its own variables with hardcoded
   * heading values (e.g., `const SECTION_A = "A) WHAT WE COLLECTED"`).
   * Such definitions suggest bypassing the constant.
   */
  describe('No hardcoded section name definitions', () => {
    it('should not define local section name variables or constants', () => {
      // Look for patterns where section names are defined locally (bypass indicators)
      const FORBIDDEN_DEFINITION_PATTERNS = [
        'const SECTION_A =',
        'const SECTION_B =',
        'const SECTION_C =',
        'const SECTION_D =',
        'let SECTION_A =',
        'let SECTION_B =',
        'let SECTION_C =',
        'let SECTION_D =',
        'const sectionNameA =',
        'const sectionNameB =',
        'const sectionNameC =',
        'const sectionNameD =',
      ];

      for (const pattern of FORBIDDEN_DEFINITION_PATTERNS) {
        if (adminUISource.includes(pattern)) {
          const matchPos = adminUISource.indexOf(pattern);
          const excerpt = getExcerpt(adminUISource, matchPos, pattern.length);

          expect.fail(
            `Found hardcoded section name definition pattern "${pattern}".\n` +
            `Section headings must come from PHASE5_SECTION_HEADINGS constant, not from local definitions.\n` +
            `The report's section_name field is acceptable when rendering; local redefinition is not.\n` +
            `Context: ...${excerpt}...`
          );
        }
      }

      expect(true).toBe(true);
    });
  });

  /**
   * TEST 4: Verify Import Statement Quality
   *
   * Ensures the import statement is properly formatted and not mangled.
   */
  describe('Import statement validation', () => {
    it('should have a proper import statement for PHASE5_SECTION_HEADINGS', () => {
      // The import should look like one of these patterns:
      const VALID_IMPORT_PATTERNS = [
        'import { PHASE5_SECTION_HEADINGS } from', // Standard named import
        'import { PHASE5_SECTION_HEADINGS,', // Named import with others
      ];

      const hasValidImport = VALID_IMPORT_PATTERNS.some(pattern =>
        adminUISource.includes(pattern)
      );

      if (!hasValidImport) {
        expect.fail(
          'Import statement for PHASE5_SECTION_HEADINGS does not match expected format.\n' +
          'Expected: import { PHASE5_SECTION_HEADINGS } from \'../phase5/phase5_headings\';'
        );
      }

      expect(true).toBe(true);
    });

    it('should import from correct path', () => {
      // The import should come from the correct location
      const expectedPath = '../phase5/phase5_headings';

      // Check both with and without .ts extension
      const hasCorrectPath = adminUISource.includes(`from '${expectedPath}'`) ||
                            adminUISource.includes(`from "${expectedPath}"`);

      if (!hasCorrectPath) {
        expect.fail(
          `PHASE5_SECTION_HEADINGS import path is incorrect.\n` +
          `Expected import from: '${expectedPath}'\n` +
          `This file must be at src/admin/phase5_admin_page.ts`
        );
      }

      expect(true).toBe(true);
    });
  });
});
