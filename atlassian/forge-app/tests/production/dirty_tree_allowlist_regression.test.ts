import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('dirty_tree_allowlist_regression', () => {
  const repoRoot = path.resolve(__dirname, '../../');
  const scriptPath = path.join(repoRoot, 'tools/production/verify_clean_tree_allowlist.sh');

  let scriptContent: string;

  it('should read the allowlist script', () => {
    expect(() => {
      scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    }).not.toThrow();
    expect(scriptContent.length).toBeGreaterThan(0);
  });

  it('should include all 3 required allow patterns', () => {
    const requiredPatterns = [
      'atlassian/forge-app/docs/production/*',
      'atlassian/forge-app/tools/production/*',
      'atlassian/forge-app/tests/production/*',
    ];

    for (const pattern of requiredPatterns) {
      expect(scriptContent).toContain(pattern);
    }
  });

  it('should include exactly 2 exception files (no more, no less)', () => {
    const requiredExceptions = [
      'atlassian/forge-app/src/storage_debug.ts',
      'atlassian/forge-app/tools/verify_dist_invoke_allowlist.sh',
    ];

    for (const exception of requiredExceptions) {
      expect(scriptContent).toContain(exception);
    }

    // Count EXPLICIT_EXCEPTIONS array entries
    // Match lines between EXPLICIT_EXCEPTIONS=( and )
    const exceptionArrayMatch = scriptContent.match(
      /EXPLICIT_EXCEPTIONS=\(([\s\S]*?)\)/
    );
    expect(exceptionArrayMatch).toBeTruthy();

    if (exceptionArrayMatch) {
      const arrayContent = exceptionArrayMatch[1];
      // Count non-empty lines that look like entries (contain /)
      const entries = arrayContent
        .split('\n')
        .filter((line) => line.trim().length > 0 && line.includes('/'));

      expect(entries).toHaveLength(2);
    }
  });

  it('should NOT contain any legacy exception strings', () => {
    const forbiddenStrings = [
      'PHASE_2_HARDENING_COMPLETE',
      'DIRTY_TREE_GATE_FIX_COMPLETE',
      'classification_results',
      'build_evidence',
      'docs/audit/',
    ];

    for (const forbidden of forbiddenStrings) {
      expect(scriptContent).not.toContain(forbidden);
    }
  });

  it('should have set -euo pipefail for strict error handling', () => {
    expect(scriptContent).toContain('set -euo pipefail');
  });

  it('should have fail-closed behavior (exit 1 on violations)', () => {
    expect(scriptContent).toContain('[VIOLATION]');
    expect(scriptContent).toContain('exit 1');
  });
});
