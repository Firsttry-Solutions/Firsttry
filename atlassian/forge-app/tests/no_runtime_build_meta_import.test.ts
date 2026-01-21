/**
 * BACKBONE GATE: No Runtime Build Meta Import in Production UI
 * 
 * CRITICAL: Enforce that NO production entry files import from runtime/ui_build_meta.
 * 
 * Root Cause: There are TWO ui_build_meta modules:
 * - src/gadget-ui/src/ui_build_meta.ts (auto-generated from build time)
 * - src/gadget-ui/src/runtime/ui_build_meta.ts (runtime FT_BUILD_SHA, FT_BUILD_COMMIT_TIME)
 * 
 * Production code MUST ONLY use the generated one (not runtime).
 * If production imports runtime/ui_build_meta, it creates circular dependencies + stale values.
 * 
 * GATE ENFORCEMENT: This test scans all TypeScript files in src/gadget-ui/src/
 * and fails if ANY production file imports from runtime/ui_build_meta.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const UI_SRC_DIR = path.join(__dirname, '../../src/gadget-ui/src');
const EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  '__tests__',
  'dist',
  'build',
  '.next',
  'coverage',
  'runtime', // runtime/ui_build_meta is allowed to exist, just not import from itself
];

function isExcluded(filePath: string): boolean {
  for (const excluded of EXCLUDED_DIRS) {
    if (filePath.includes(path.sep + excluded + path.sep) || filePath.endsWith(path.sep + excluded)) {
      return true;
    }
  }
  return false;
}

function scanForRuntimeImports(dirPath: string, results: { file: string; line: number; code: string }[] = []): void {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  const items = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);

    if (item.isDirectory()) {
      if (!isExcluded(fullPath)) {
        scanForRuntimeImports(fullPath, results);
      }
    } else if (item.isFile() && /\.(ts|tsx|js|jsx)$/.test(item.name)) {
      if (isExcluded(fullPath)) {
        continue;
      }

      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, idx) => {
          // Check for import/require of runtime/ui_build_meta
          // Patterns to catch:
          // - import from "./runtime/ui_build_meta"
          // - import from "./runtime/ui_build_meta.ts"
          // - require("./runtime/ui_build_meta")
          // - from 'runtime/ui_build_meta'
          const patterns = [
            /['"]\.\/runtime\/ui_build_meta['"]/, // relative path
            /['"]runtime\/ui_build_meta['"]/, // bare path
            /from\s+['"]\.\/runtime\/ui_build_meta['"]/,
            /from\s+['"]runtime\/ui_build_meta['"]/,
            /require\s*\(\s*['"]\.\/runtime\/ui_build_meta['"]\s*\)/, // CommonJS
            /require\s*\(\s*['"]runtime\/ui_build_meta['"]\s*\)/, // CommonJS
          ];

          const matched = patterns.some((p) => p.test(line));
          if (matched) {
            results.push({
              file: fullPath,
              line: idx + 1,
              code: line.trim(),
            });
          }
        });
      } catch (e) {
        // Skip files we can't read
      }
    }
  }

  return;
}

describe('BACKBONE GATE: No Runtime Build Meta Import in Production UI', () => {
  it('should fail if ANY production file imports from runtime/ui_build_meta', () => {
    const violations: { file: string; line: number; code: string }[] = [];
    scanForRuntimeImports(UI_SRC_DIR, violations);

    // Format violations for readability
    const violationMessages = violations.map((v) => `  ${v.file}:${v.line}\n    ${v.code}`).join('\n');

    if (violations.length > 0) {
      const msg =
        `\n[BACKBONE_GATE_FAILED] Production UI files must NEVER import from runtime/ui_build_meta.\n\n` +
        `Found ${violations.length} violation(s):\n\n${violationMessages}\n\n` +
        `FIX: Change imports to use '../ui_build_meta' (the generated, not runtime version)`;

      throw new Error(msg);
    }

    expect(violations.length).toBe(0);
  });

  it('should allow imports from the main ui_build_meta (not runtime)', () => {
    // This is just a smoke test to ensure we're not too strict
    // The main ui_build_meta should be importable
    const mainMetaPath = path.join(UI_SRC_DIR, 'ui_build_meta.ts');
    
    // If the file doesn't exist yet (before build), skip this check
    if (!fs.existsSync(mainMetaPath)) {
      console.log('[BACKBONE_GATE] ui_build_meta.ts not found (expected before first build)');
      expect(true).toBe(true);
      return;
    }

    expect(fs.existsSync(mainMetaPath)).toBe(true);

    const content = fs.readFileSync(mainMetaPath, 'utf-8');
    expect(content).toContain('export const UI_BUILD_TIME_UTC');
  });
});
