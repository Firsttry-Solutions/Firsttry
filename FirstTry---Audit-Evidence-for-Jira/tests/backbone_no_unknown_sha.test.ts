/**
 * Regression Test: No "unknown" backend_build_sha in backend
 *
 * This test scans the backend source code for forbidden patterns that would
 * allow "unknown" values for backend_build_sha:
 *
 * Forbidden patterns:
 * - process.env.BUILD_SHA
 * - process.env.BACKEND_BUILD_SHA
 * - backend_build_sha: "unknown" (literal)
 * - || "unknown" on backend_build_sha assignment
 *
 * Allowed exclusions (may contain "unknown"):
 * - src/storage_debug.ts (metrics/debug only)
 * - src/phase9/ (legacy implementation)
 * - src/gadget-ui/ (UI code, not backend)
 *
 * This ensures ALL backend resolver logging uses the injected BACKEND_BUILD_SHA constant.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Helper: read all .ts files recursively
function getAllTypeScriptFiles(dir: string, excludeDirs: Set<string> = new Set()): string[] {
  const files: string[] = [];

  function walkDir(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(dir, fullPath);

      // Skip excluded directories
      if (excludeDirs.has(entry.name) || excludeDirs.has(relativePath.split(path.sep)[0])) {
        continue;
      }

      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        files.push(fullPath);
      }
    }
  }

  walkDir(dir);
  return files;
}

describe('BACKBONE: No "unknown" backend_build_sha', () => {
  
  it('should have no process.env.BUILD_SHA usage in backend resolvers', () => {
    const srcDir = path.join(__dirname, '..', 'src');
    const excludeDirs = new Set(['gadget-ui', 'phase9']);
    const files = getAllTypeScriptFiles(srcDir, excludeDirs);

    const violations: { file: string; line: number; content: string }[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.includes('process.env.BUILD_SHA') && !line.includes('BACKEND_BUILD_SHA')) {
          violations.push({
            file: path.relative(srcDir, file),
            line: index + 1,
            content: line.trim()
          });
        }
      });
    }

    expect(violations, `Found process.env.BUILD_SHA usage:\n${JSON.stringify(violations, null, 2)}`).toHaveLength(0);
  });

  it('should have no process.env.BACKEND_BUILD_SHA fallback to "unknown"', () => {
    const srcDir = path.join(__dirname, '..', 'src');
    const excludeDirs = new Set(['gadget-ui', 'phase9']);
    const files = getAllTypeScriptFiles(srcDir, excludeDirs);

    const violations: { file: string; line: number; content: string }[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Check for patterns like: process.env.BACKEND_BUILD_SHA || "unknown"
        if (
          line.includes('process.env.BACKEND_BUILD_SHA') &&
          (line.includes('|| "unknown"') || line.includes("|| 'unknown'"))
        ) {
          violations.push({
            file: path.relative(srcDir, file),
            line: index + 1,
            content: line.trim()
          });
        }
      });
    }

    expect(violations, `Found process.env.BACKEND_BUILD_SHA || "unknown" pattern:\n${JSON.stringify(violations, null, 2)}`).toHaveLength(0);
  });

  it('should have no backend_build_sha: "unknown" literal construction', () => {
    const srcDir = path.join(__dirname, '..', 'src');
    const excludeDirs = new Set(['gadget-ui', 'phase9', 'storage_debug.ts']);
    const files = getAllTypeScriptFiles(srcDir, excludeDirs);

    const violations: { file: string; line: number; content: string }[] = [];

    for (const file of files) {
      // Skip explicitly excluded files
      if (file.includes('storage_debug.ts')) {
        continue;
      }

      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Check for patterns like: backend_build_sha: "unknown"
        if (/backend_build_sha\s*:\s*["']unknown["']/.test(line)) {
          violations.push({
            file: path.relative(srcDir, file),
            line: index + 1,
            content: line.trim()
          });
        }
      });
    }

    expect(violations, `Found backend_build_sha: "unknown" literal:\n${JSON.stringify(violations, null, 2)}`).toHaveLength(0);
  });

  it('should have no || "unknown" on backendBuildSha assignments in resolvers', () => {
    const srcDir = path.join(__dirname, '..', 'src', 'resolvers');
    const files = getAllTypeScriptFiles(srcDir);

    const violations: { file: string; line: number; content: string }[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Check for backendBuildSha assignments with "unknown" fallback
        if (
          (line.includes('backendBuildSha') || line.includes('backend_build_sha')) &&
          (line.includes('|| "unknown"') || line.includes("|| 'unknown'") || line.includes('|| null'))
        ) {
          // Allow only specific patterns that are known to be safe
          if (!line.includes('// OLD:') && !line.includes('UNKNOWN')) {
            violations.push({
              file: path.relative(srcDir, file),
              line: index + 1,
              content: line.trim()
            });
          }
        }
      });
    }

    expect(violations, `Found backendBuildSha with fallback patterns:\n${JSON.stringify(violations, null, 2)}`).toHaveLength(0);
  });

  it('should verify all resolver backendBuildSha come from BACKEND_BUILD_SHA import', () => {
    const srcDir = path.join(__dirname, '..', 'src', 'resolvers');
    const files = getAllTypeScriptFiles(srcDir);

    const violations: { file: string; message: string }[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const hasBackendBuildShaUsage = content.includes('backendBuildSha') || content.includes('backend_build_sha');
      const hasImport = content.includes('import { BACKEND_BUILD_SHA }') || 
                       content.includes('from "../build/backend_build"');

      // If file uses backendBuildSha but doesn't import BACKEND_BUILD_SHA, it's using env/fallback
      if (hasBackendBuildShaUsage && !hasImport && !file.includes('backbone_error_handling')) {
        const hasProcessEnv = content.includes('process.env.BUILD_SHA') || 
                            content.includes('process.env.BACKEND_BUILD_SHA');
        
        if (hasProcessEnv) {
          violations.push({
            file: path.relative(srcDir, file),
            message: 'Uses backendBuildSha but does not import BACKEND_BUILD_SHA constant'
          });
        }
      }
    }

    expect(violations, `Resolvers not using BACKEND_BUILD_SHA import:\n${JSON.stringify(violations, null, 2)}`).toHaveLength(0);
  });

  it('should not have any "unknown" in production logging paths (resolvers)', () => {
    const srcDir = path.join(__dirname, '..', 'src', 'resolvers');
    const files = getAllTypeScriptFiles(srcDir);

    const violations: { file: string; line: number; content: string }[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Check for "unknown" in JSON.stringify or logging contexts
        if (
          (line.includes('JSON.stringify') || line.includes('console.')) &&
          (line.includes('"unknown"') || line.includes("'unknown'"))
        ) {
          // Allow comments and explicit error scenarios
          if (!line.includes('//') && !line.includes('UNKNOWN') && !line.includes('_UNKNOWN_')) {
            violations.push({
              file: path.relative(srcDir, file),
              line: index + 1,
              content: line.trim()
            });
          }
        }
      });
    }

    expect(violations, `Found "unknown" in logging paths:\n${JSON.stringify(violations, null, 2)}`).toHaveLength(0);
  });
});
