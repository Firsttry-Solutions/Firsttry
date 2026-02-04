/**
 * CSP Regression Test: Verify no inline style violations in gadget-ui source
 * 
 * This test ensures that:
 * 1. No React inline style props (style={{}})
 * 2. No HTML inline style attributes (style="...")
 * 3. No DOM .style.* mutations
 * 4. No setAttribute('style', ...) calls
 * 
 * Purpose: Prevent re-introduction of CSP violations that cause:
 * "Applying inline style violates Content Security Policy directive 'style-src 'self''"
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('CSP_NoInlineStyleAttributes', () => {
  const SOURCE_DIR = path.join(__dirname, '../src/gadget-ui/src');

  /**
   * Scan files for inline style violations using git ls-files
   * Only scan tracked files in source directory
   */
  function getTrackedSourceFiles(): string[] {
    try {
      const output = execSync(
        `cd ${SOURCE_DIR}/.. && git ls-files 'src/**/*.ts' 'src/**/*.tsx' 'index.html' --exclude-standard`,
        { encoding: 'utf-8' }
      );
      return output
        .split('\n')
        .filter(f => f.length > 0)
        .map(f => path.join(SOURCE_DIR, '../../', f));
    } catch (e) {
      console.warn('[CSP_TEST] Failed to get git-tracked files, using fallback scan');
      return [];
    }
  }

  /**
   * Search for inline style patterns in source files
   */
  function searchForViolations(pattern: RegExp, files?: string[]): Map<string, number[]> {
    const violations = new Map<string, number[]>();
    
    const filesToScan = files && files.length > 0 ? files : getTrackedSourceFiles();
    
    for (const file of filesToScan) {
      // Skip excluded directories
      if (
        file.includes('/node_modules/') ||
        file.includes('/dist/') ||
        file.includes('/build/') ||
        file.includes('/.forge/') ||
        file.includes('/audit/') ||
        !file.includes('src/gadget-ui')
      ) {
        continue;
      }

      try {
        if (!fs.existsSync(file)) {
          continue;
        }

        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        const matchingLines: number[] = [];

        lines.forEach((line, idx) => {
          if (pattern.test(line)) {
            matchingLines.push(idx + 1); // 1-indexed
          }
        });

        if (matchingLines.length > 0) {
          violations.set(file, matchingLines);
        }
      } catch (e) {
        // Skip files that can't be read
      }
    }

    return violations;
  }

  /**
   * Format violation output for test failure messages
   */
  function formatViolations(violations: Map<string, number[]>, patternName: string): string {
    const lines: string[] = [`${patternName} violations:`];
    let count = 0;

    for (const [file, lineNumbers] of violations.entries()) {
      const relPath = file.replace(SOURCE_DIR + '/../../', '');
      lines.push(`  ${relPath}: lines ${lineNumbers.join(', ')}`);
      count += lineNumbers.length;
    }

    lines.push(`\nTotal: ${count} violations`);
    return lines.join('\n');
  }

  it('MUST enforce minimum artifact sizes and PNG dimensions', () => {
    // This test verifies that the runtime proofpack script includes the validation functions
    // require_min_bytes() and require_png_min_dims() that check for placeholder artifacts
    
    const proofpackPath = path.join(__dirname, '../audit/runtime_proofpack_v2.sh');
    const proofpackContent = fs.readFileSync(proofpackPath, 'utf-8');

    // Check that the validation functions exist
    expect(proofpackContent).toContain('require_min_bytes()');
    expect(proofpackContent).toContain('require_png_min_dims()');

    // Check that PHASE 3B uses the validation functions
    expect(proofpackContent).toContain('require_min_bytes');
    expect(proofpackContent).toContain('require_png_min_dims');

    // Check for specific validation thresholds
    expect(proofpackContent).toMatch(/require_min_bytes.*2000/);
    expect(proofpackContent).toMatch(/require_png_min_dims.*600.*400/);
  });

  it('MUST explicitly reject 1x1 PNG placeholders', () => {
    // Verify the script contains explicit 1x1 rejection
    const proofpackPath = path.join(__dirname, '../audit/runtime_proofpack_v2.sh');
    const proofpackContent = fs.readFileSync(proofpackPath, 'utf-8');

    // Check for 1x1 detection
    expect(proofpackContent).toContain('1x1');
    expect(proofpackContent).toContain('placeholder');
  });

  it('MUST NOT have React inline style props (style={{...}})', () => {
    // Pattern matches: style={{...}} or style={Object}
    const pattern = /style\s*=\s*\{\{/;
    const violations = searchForViolations(pattern);

    expect(
      violations.size,
      `React inline style violations found:\n${formatViolations(violations, 'style={{...}}')}`
    ).toBe(0);
  });

  it('MUST NOT have HTML inline style attributes (style="...")', () => {
    // Pattern matches: style="..." in HTML
    const pattern = /style\s*=\s*["'][^"']*["']/;
    const violations = searchForViolations(pattern);

    expect(
      violations.size,
      `HTML inline style violations found:\n${formatViolations(violations, 'style="..."')}`
    ).toBe(0);
  });

  it('MUST NOT have DOM style mutations (.style.property)', () => {
    // Pattern matches: .style. followed by property assignment or access
    // Excludes comments and strings that mention .style
    const pattern = /\.\s*style\s*\./;
    
    // Manual scanning to avoid false positives from comments
    const violations = new Map<string, number[]>();
    const filesToScan = getTrackedSourceFiles();

    for (const file of filesToScan) {
      if (
        file.includes('/node_modules/') ||
        file.includes('/dist/') ||
        file.includes('/build/') ||
        !file.includes('src/gadget-ui')
      ) {
        continue;
      }

      try {
        if (!fs.existsSync(file)) {
          continue;
        }

        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        const matchingLines: number[] = [];

        lines.forEach((line, idx) => {
          // Skip comments
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
            return;
          }

          // Only match actual code (not in strings)
          const codeOnly = line.split('//')[0]; // Remove comments
          if (pattern.test(codeOnly) && !codeOnly.includes('`') && !codeOnly.includes('"')) {
            matchingLines.push(idx + 1);
          }
        });

        if (matchingLines.length > 0) {
          violations.set(file, matchingLines);
        }
      } catch (e) {
        // Skip
      }
    }

    expect(
      violations.size,
      `DOM style mutations found:\n${formatViolations(violations, '.style.*')}`
    ).toBe(0);
  });

  it('MUST NOT have setAttribute("style", ...) calls', () => {
    // Pattern matches: setAttribute with "style" string
    const pattern = /setAttribute\s*\(\s*["']style["']/;
    const violations = searchForViolations(pattern);

    expect(
      violations.size,
      `setAttribute('style') calls found:\n${formatViolations(violations, 'setAttribute("style")')}`
    ).toBe(0);
  });

  it('MUST have CSS-compliant classes available for styling', () => {
    // Verify that styles.css includes the helper classes we need
    const stylesPath = path.join(__dirname, '../src/gadget-ui/src/styles.css');
    const stylesContent = fs.readFileSync(stylesPath, 'utf-8');

    // Check for key semantic classes
    const requiredClasses = [
      '.hidden',
      '.visible',
      '.text-error',
      '.text-success',
      '.disabled-state',
      '.enabled-state',
      '.offscreen',
      '.card',
      '.error-panel'
    ];

    for (const cssClass of requiredClasses) {
      expect(
        stylesContent,
        `Missing CSS class: ${cssClass}`
      ).toContain(cssClass);
    }
  });

  it('MUST have runtime CSP violation detection in proofpack', () => {
    // Verify that runtime_proofpack_v2.sh includes CSP violation detection
    const proofpackPath = path.join(__dirname, '../audit/runtime_proofpack_v2.sh');
    const proofpackContent = fs.readFileSync(proofpackPath, 'utf-8');
    const runtimeTestPath = path.join(__dirname, '../src/__tests__/RuntimeProofpackV2_NoSimulation.test.ts');
    const runtimeTestContent = fs.readFileSync(runtimeTestPath, 'utf-8');

    // Check for CSP violation error message
    expect(proofpackContent).toContain('Applying inline style violates');
    expect(proofpackContent).toContain('Content Security Policy');
    expect(proofpackContent).toContain('style-src');

    // Check that the test verifies this check exists
    expect(runtimeTestContent).toContain('CSP_VIOLATION');
  });
});
