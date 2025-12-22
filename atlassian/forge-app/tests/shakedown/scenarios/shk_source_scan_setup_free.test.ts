/**
 * SHK-091: SOURCE_SCAN_SETUP_FREE
 *
 * Credibility Hardening Test: Source code has ZERO setup/config logic.
 *
 * Claim: "Production source code contains no setup, configure, or isConfigured
 * logic gates. All paths are zero-touch."
 *
 * Test: Scan src/ directory for setup-related keywords in critical contexts:
 * - setup, configure, onboarding, wizard, isConfigured, setupComplete
 * - Look for these in function names and conditionals
 * - Flag matches that are actual logic gates (if/switch), skip comments/strings
 *
 * Evidence: Filesystem scan of src files
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('SHK-091: Source Code Setup-Free Proof', () => {
  function scanDirectory(dirPath: string): string[] {
    const files: string[] = [];

    function walk(dir: string) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (!['.git', 'node_modules', 'dist', 'build', '.next'].includes(entry.name)) {
              walk(fullPath);
            }
          } else if (entry.isFile() && entry.name.endsWith('.ts')) {
            files.push(fullPath);
          }
        }
      } catch (err) {
        // Skip unreadable directories
      }
    }

    walk(dirPath);
    return files;
  }

  function hasSetupLogic(filePath: string): boolean {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      // Check for setup in function names or logic
      return (
        /function\s+\w*setup\w*\s*\(|const\s+\w*setup\w*\s*=|if\s*\([^)]*setup\w*[^)]*\)/i.test(
          content
        ) ||
        /function\s+\w*configure\w*\s*\(|const\s+\w*configure\w*\s*=|if\s*\([^)]*configure\w*[^)]*\)/i.test(
          content
        )
      );
    } catch (err) {
      return false;
    }
  }

  it('should scan src/ directory for TypeScript files', () => {
    const srcRoot = '/workspaces/Firstry/atlassian/forge-app/src';
    const files = scanDirectory(srcRoot);

    console.log('[SHK-091] Found', files.length, 'TypeScript files in src/');

    expect(files.length).toBeGreaterThan(0);
  });

  it('should verify NO "setup" patterns in production code critical paths', () => {
    const srcRoot = '/workspaces/Firstry/atlassian/forge-app/src';
    const files = scanDirectory(srcRoot);

    const filesWithSetup = files.filter((f) => {
      const content = fs.readFileSync(f, 'utf-8');
      return /function\s+\w*setup\w*|const\s+\w*setup\w*\s*=/i.test(content);
    });

    console.log('[SHK-091] Files with "setup" pattern:', filesWithSetup.length);

    expect(filesWithSetup.length).toBe(0);
  });

  it('should verify NO "configure" patterns in production code critical paths', () => {
    const srcRoot = '/workspaces/Firstry/atlassian/forge-app/src';
    const files = scanDirectory(srcRoot);

    const filesWithConfigure = files.filter((f) => {
      const content = fs.readFileSync(f, 'utf-8');
      return /function\s+\w*configure\w*|const\s+\w*configure\w*\s*=/i.test(content);
    });

    console.log('[SHK-091] Files with "configure" pattern:', filesWithConfigure.length);

    expect(filesWithConfigure.length).toBe(0);
  });

  it('should verify NO "isConfigured" or "setupComplete" guards', () => {
    const srcRoot = '/workspaces/Firstry/atlassian/forge-app/src';
    const files = scanDirectory(srcRoot);

    let matchCount = 0;

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('isConfigured') || content.includes('setupComplete')) {
        matchCount++;
      }
    }

    console.log('[SHK-091] Files with isConfigured/setupComplete:', matchCount);

    expect(matchCount).toBe(0);
  });

  it('should verify NO "onboarding" or "wizard" patterns in production code', () => {
    const srcRoot = '/workspaces/Firstry/atlassian/forge-app/src';
    const files = scanDirectory(srcRoot);

    const filesWithOnboarding = files.filter((f) => {
      const content = fs.readFileSync(f, 'utf-8');
      return /onboarding|wizard/i.test(content);
    });

    console.log('[SHK-091] Files with onboarding/wizard:', filesWithOnboarding.length);

    expect(filesWithOnboarding.length).toBe(0);
  });

  it('should verify storage.ts key builders do NOT have setup guards', () => {
    const storagePath = '/workspaces/Firstry/atlassian/forge-app/src/storage.ts';

    if (!fs.existsSync(storagePath)) {
      console.log('[SHK-091] storage.ts not found, skipping');
      return;
    }

    const content = fs.readFileSync(storagePath, 'utf-8');

    const hasSetupGuard = /if\s*\([^)]*setup[^)]*\)|if\s*\([^)]*config[^)]*\)/i.test(content);

    console.log('[SHK-091] storage.ts setup guard check:', hasSetupGuard ? 'FOUND (violation!)' : 'CLEAN');

    expect(hasSetupGuard).toBe(false);
  });

  it('should produce audit entry with scan results', () => {
    const srcRoot = '/workspaces/Firstry/atlassian/forge-app/src';
    const files = scanDirectory(srcRoot);

    const auditEntry = {
      claim: 'Production code contains no setup/config logic in critical paths',
      evidence: {
        scanScope: 'src/**/*.ts (TypeScript production code)',
        forbiddenPatterns: ['setup', 'configure', 'isConfigured', 'setupComplete', 'onboarding', 'wizard'],
      },
      filesScanned: files.length,
      timestamp: new Date().toISOString(),
    };

    console.log('[SHK-091] Source Code Scan Results:', JSON.stringify(auditEntry, null, 2));

    expect(files.length).toBeGreaterThan(0);
  });
});
