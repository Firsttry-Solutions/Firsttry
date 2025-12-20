/**
 * PHASE 7 v2: FORBIDDEN LANGUAGE TEST
 * 
 * Enforces that forbidden text does not appear in Phase 7 code, UI, or documentation.
 * This test MUST FAIL the build if any forbidden strings are detected.
 * 
 * Forbidden words (violations indicate violation of Phase-7 principles):
 * - "impact" (claim causality)
 * - "hygiene" (quality judgment)
 * - "improve" (prescriptive)
 * - "fix" (prescriptive)
 * - "recommend" (prescriptive)
 * - "should" (prescriptive)
 * - "sudden drop" (causality)
 * - "root cause" (causality)
 * - "prevent" (prescriptive)
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const FORBIDDEN_STRINGS = [
  'impact',
  'hygiene',
  'improve',
  'fix',
  'recommend',
  'should',
  'sudden drop',
  'root cause',
  'prevent',
];

/**
 * Recursively find all files in a directory
 */
function findFilesRecursive(dir: string, pattern: RegExp): string[] {
  let results: string[] = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and .git
      if (file === 'node_modules' || file === '.git' || file === '.next') {
        return;
      }
      results = results.concat(findFilesRecursive(filePath, pattern));
    } else if (pattern.test(filePath)) {
      results.push(filePath);
    }
  });

  return results;
}

describe('Phase 7 v2: Forbidden Language Enforcement', () => {
  const phaseDir = path.join(__dirname, '../../src/phase7');
  const exportsDir = path.join(__dirname, '../../src/exports');
  const docsDir = path.join(__dirname, '../../docs');

  it('should have no forbidden strings in phase7 module', () => {
    const files = findFilesRecursive(phaseDir, /\.(ts|tsx)$/);
    const violations: string[] = [];

    files.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');

      FORBIDDEN_STRINGS.forEach((forbidden) => {
        // Case-insensitive search, but exclude comments that document the prohibition
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          // Skip comments that explain the rule
          if (line.includes('Forbidden') || line.includes('forbidden')) {
            return;
          }

          const regex = new RegExp(`\\b${forbidden}\\b`, 'gi');
          if (regex.test(line)) {
            violations.push(
              `${path.relative(process.cwd(), filePath)}:${index + 1} - "${forbidden}"`
            );
          }
        });
      });
    });

    if (violations.length > 0) {
      throw new Error(
        `Phase 7 Forbidden Language Violations:\n${violations.join('\n')}\n\n` +
          `Forbidden words: ${FORBIDDEN_STRINGS.join(', ')}`
      );
    }

    expect(violations.length).toBe(0);
  });

  it('should have no forbidden strings in drift_export', () => {
    const files = findFilesRecursive(exportsDir, /drift_export\.(ts|tsx)$/);
    const violations: string[] = [];

    files.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');

      FORBIDDEN_STRINGS.forEach((forbidden) => {
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (line.includes('Forbidden') || line.includes('forbidden')) {
            return;
          }

          const regex = new RegExp(`\\b${forbidden}\\b`, 'gi');
          if (regex.test(line)) {
            violations.push(
              `${path.relative(process.cwd(), filePath)}:${index + 1} - "${forbidden}"`
            );
          }
        });
      });
    });

    if (violations.length > 0) {
      throw new Error(
        `Drift Export Forbidden Language Violations:\n${violations.join('\n')}`
      );
    }

    expect(violations.length).toBe(0);
  });

  it('should have no forbidden strings in Phase 7 documentation', () => {
    const files = findFilesRecursive(docsDir, /PHASE_7.*\.(md|markdown)$/);
    const violations: string[] = [];

    files.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');

      FORBIDDEN_STRINGS.forEach((forbidden) => {
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          // Allow in code blocks and examples
          if (line.startsWith('```') || line.startsWith('    ')) {
            return;
          }

          // Allow in literal string explanations
          if (line.includes('Forbidden') || line.includes('forbidden')) {
            return;
          }

          const regex = new RegExp(`\\b${forbidden}\\b`, 'gi');
          if (regex.test(line)) {
            violations.push(
              `${path.relative(process.cwd(), filePath)}:${index + 1} - "${forbidden}"`
            );
          }
        });
      });
    });

    if (violations.length > 0) {
      throw new Error(
        `Phase 7 Documentation Forbidden Language Violations:\n${violations.join('\n')}`
      );
    }

    expect(violations.length).toBe(0);
  });

  it('should document the forbidden language rules', () => {
    const specPath = path.join(docsDir, 'PHASE_7_V2_SPEC.md');
    if (fs.existsSync(specPath)) {
      const content = fs.readFileSync(specPath, 'utf-8');
      expect(content.toLowerCase()).toContain('forbidden');
      expect(content.toLowerCase()).toContain('impact');
      expect(content.toLowerCase()).toContain('cause');
    }
  });
});
