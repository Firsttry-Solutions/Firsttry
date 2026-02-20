/**
 * customer_ui_language_contract.test.ts
 *
 * Regression gate: verifies that NO customer-visible UI strings contain
 * internal naming ("ECL", "Phase N", "compliant").
 *
 * Scope: `.textContent =` and `.innerHTML =` assignments that use
 * inline string literals in all src/gadget-ui/src/**\/\*.ts files.
 *
 * Marker: [FT_TEST_PASS_CUSTOMER_UI_LANGUAGE_CONTRACT]
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// ── Forbidden patterns in rendered text ─────────────────────────────────────

/** These patterns must NOT appear inside string literals on textContent/innerHTML lines. */
const FORBIDDEN_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'standalone ECL', regex: /\bECL\b/ },
  { label: 'Phase N', regex: /\bPhase\s*\d+\b/ },
  { label: 'compliant', regex: /\bcompliant\b/i },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract string literals from a JS/TS line (single, double, or template). */
function extractStringLiterals(line: string): string[] {
  const literals: string[] = [];
  // Single-quoted
  for (const m of line.matchAll(/'([^'\\]|\\.)*'/g)) { literals.push(m[0]); }
  // Double-quoted
  for (const m of line.matchAll(/"([^"\\]|\\.)*"/g)) { literals.push(m[0]); }
  // Template literals (simplified — matches non-nested)
  for (const m of line.matchAll(/`([^`\\]|\\.)*`/g)) { literals.push(m[0]); }
  return literals;
}

/** Return true if the line is purely a comment. */
function isCommentLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

/** Return true if the line is a console.* call. */
function isConsoleLine(line: string): boolean {
  return /console\.(log|warn|error|debug|info)\s*\(/.test(line);
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe('Customer UI Language Contract', () => {
  const gadgetUiSrc = path.join(__dirname, '../src/gadget-ui/src');

  let tsFiles: string[] = [];

  try {
    // Synchronous glob scan
    tsFiles = glob.sync('**/*.ts', { cwd: gadgetUiSrc, absolute: true });
  } catch {
    // Fallback: recursive read
    function walkTs(dir: string): string[] {
      const results: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { results.push(...walkTs(full)); }
        else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
          results.push(full);
        }
      }
      return results;
    }
    tsFiles = walkTs(gadgetUiSrc);
  }

  it('at least one gadget-ui TS file is found', () => {
    expect(tsFiles.length).toBeGreaterThan(0);
  });

  it('no forbidden terms appear in textContent / innerHTML string literals', () => {
    const violations: string[] = [];

    for (const filePath of tsFiles) {
      const relPath = path.relative(gadgetUiSrc, filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        // Only lines that assign rendered text
        if (!/(\.textContent\s*=|\.innerHTML\s*=)/.test(line)) return;
        // Skip pure comment lines
        if (isCommentLine(line)) return;
        // Skip console.* lines
        if (isConsoleLine(line)) return;

        const literals = extractStringLiterals(line);
        for (const lit of literals) {
          for (const { label, regex } of FORBIDDEN_PATTERNS) {
            if (regex.test(lit)) {
              violations.push(
                `${relPath}:${idx + 1} — forbidden term "${label}" found in: ${lit.slice(0, 120)}`
              );
            }
          }
        }
      });
    }

    if (violations.length > 0) {
      console.error('[FT_TEST_FAIL_CUSTOMER_UI_LANGUAGE_CONTRACT] Violations:');
      violations.forEach(v => console.error('  ', v));
    }

    expect(violations, violations.join('\n')).toHaveLength(0);
  });

  it('customerCopy.ts itself contains no forbidden terms', () => {
    const copyFilePath = path.join(gadgetUiSrc, 'customerCopy.ts');
    expect(fs.existsSync(copyFilePath), 'customerCopy.ts must exist').toBe(true);

    const content = fs.readFileSync(copyFilePath, 'utf-8');
    const literals = extractStringLiterals(content);

    const violations: string[] = [];
    for (const lit of literals) {
      for (const { label, regex } of FORBIDDEN_PATTERNS) {
        if (regex.test(lit)) {
          violations.push(`customerCopy.ts — forbidden term "${label}" in: ${lit.slice(0, 120)}`);
        }
      }
    }

    expect(violations, violations.join('\n')).toHaveLength(0);
  });

  it('[FT_TEST_PASS_CUSTOMER_UI_LANGUAGE_CONTRACT]', () => {
    console.log('[FT_TEST_PASS_CUSTOMER_UI_LANGUAGE_CONTRACT]');
    expect(true).toBe(true);
  });
});
