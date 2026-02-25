/**
 * run_prod_ready_audit_truthfulness_invariant.test.ts
 *
 * Regression test to ensure the production readiness orchestrator's verdict
 * is ALWAYS truthful and matches the actual exit code.
 *
 * Key invariants:
 * - EXIT_FILE is initialized to "1" (fail-closed) at start
 * - VERDICT_FILE is overwritten deterministically based on OVERALL_EXIT
 * - All required subdirectories are pre-created
 * - FT_PROD_READY_E is the SOLE source of truth for evidence directory
 * - No /tmp/ft_prod_ready_dir.txt fallback exists (removed)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const REPO_ROOT = process.cwd();
const SCRIPT_PATH = path.join(REPO_ROOT, 'tools/production/run_prod_ready_audit.sh');

describe('Production Readiness Orchestrator Truthfulness Invariant', () => {
  describe('Script structure validation', () => {
    it('orchestrator must initialize exit code file to 1 (fail-closed)', () => {
      const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf-8');

      // Check for fail-closed initialization
      expect(
        scriptContent,
        'Script must initialize EXIT_FILE to "1" (fail-closed)'
      ).toContain('echo "1" > "$EXIT_FILE"');
    });

    it('orchestrator must create all required subdirectories upfront', () => {
      const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf-8');

      // Check for directory creation
      expect(
        scriptContent,
        'Script must pre-create all required directories'
      ).toContain('mkdir -p "$E/03_tests" "$E/04_build" "$E/05_ui" "$E/09_release" "$E/13_repo_scans"');
    });

    it('orchestrator must validate FT_PROD_READY_E as sole source of truth', () => {
      const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf-8');

      // Check for FT_PROD_READY_E validation
      expect(
        scriptContent,
        'Script must validate FT_PROD_READY_E is set'
      ).toContain('FT_PROD_READY_E');

      // Check that /tmp/ft_prod_ready_dir.txt fallback is REMOVED
      expect(
        scriptContent,
        'Script must NOT have /tmp/ft_prod_ready_dir.txt fallback'
      ).not.toContain('ft_prod_ready_dir.txt');
    });

    it('orchestrator must set verdict based ONLY on OVERALL_EXIT', () => {
      const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf-8');

      // Check that verdict is derived from OVERALL_EXIT, not inferred
      expect(
        scriptContent,
        'Script must check OVERALL_EXIT to set verdict'
      ).toContain('if [ "$OVERALL_EXIT" -eq 0 ]');

      expect(
        scriptContent,
        'Script must write PASS only when OVERALL_EXIT is 0'
      ).toContain('echo "PASS" > "$VERDICT_FILE"');

      expect(
        scriptContent,
        'Script must write FAIL when OVERALL_EXIT is not 0'
      ).toContain('echo "FAIL" > "$VERDICT_FILE"');
    });

    it('orchestrator must overwrite exit code file deterministically', () => {
      const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf-8');

      // Check that exit code file is overwritten based on OVERALL_EXIT
      expect(
        scriptContent,
        'Script must set exit code file to 0 on success'
      ).toContain('echo "0" > "$EXIT_FILE"');

      expect(
        scriptContent,
        'Script must set exit code file to 1 on failure'
      ).toContain('echo "1" > "$EXIT_FILE"');
    });

    it('orchestrator must exit with OVERALL_EXIT, not 0', () => {
      const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf-8');

      // Check final exit uses OVERALL_EXIT
      expect(
        scriptContent,
        'Script must exit with $OVERALL_EXIT'
      ).toContain('exit "$OVERALL_EXIT"');
    });

    it('orchestrator must print verdict to stdout', () => {
      const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf-8');

      // Check that verdict is printed to user
      expect(
        scriptContent,
        'Script must print verdict message'
      ).toContain('VERDICT:');
    });
  });

  describe('No stale verdict files', () => {
    it('verdict file must be overwritten with > (not >>)', () => {
      const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf-8');

      // Count how many times we write to VERDICT_FILE
      // Should use > (overwrite) not >> (append)
      const verdictWrites = scriptContent.match(/> "\$VERDICT_FILE"/g) || [];
      const verdictAppends = scriptContent.match(/>> "\$VERDICT_FILE"/g) || [];

      expect(
        verdictWrites.length > 0,
        'Script must use > to overwrite VERDICT_FILE'
      ).toBe(true);

      expect(
        verdictAppends.length === 0,
        'Script must not append >> to VERDICT_FILE (use > to overwrite)'
      ).toBe(true);
    });
  });

  describe('Fail-closed semantics', () => {
    it('script must use set -uo pipefail', () => {
      const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf-8');

      const lines = scriptContent.split('\n');
      expect(
        lines[0],
        'Script must start with #!/bin/bash'
      ).toBe('#!/bin/bash');

      expect(
        lines[1],
        'Script must have set -uo pipefail as second line'
      ).toBe('set -uo pipefail');
    });

    it('script must not contain || true patterns', () => {
      const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf-8');

      // Count forbidden patterns
      const badPatterns = [
        '|| true',
        '|| :',
      ];

      for (const pattern of badPatterns) {
        expect(
          scriptContent.includes(pattern),
          `Script must not contain ${pattern} (weakens fail-closed semantics)`
        ).toBe(false);
      }
    });

    it('script must not contain timeout/sleep/background patterns', () => {
      const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf-8');

      // Check that dangerous patterns are not in executable code
      expect(
        scriptContent.includes('timeout') &&
          !scriptContent.includes('# timeout'),
        'Script must not use timeout command'
      ).toBe(false);

      expect(
        scriptContent.includes('sleep') &&
          !scriptContent.includes('# sleep'),
        'Script must not use sleep command'
      ).toBe(false);
    });
  });

  describe('Evidence path contract', () => {
    it('orchestrator must use FT_PROD_READY_E contract only', () => {
      const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf-8');

      // Should reference FT_PROD_READY_E
      expect(
        scriptContent,
        'Script must use FT_PROD_READY_E environment variable'
      ).toContain('FT_PROD_READY_E');

      // Should not create repo-root E/ directory
      expect(
        scriptContent.includes('mkdir -p E/'),
        'Script must not create repo-root E/ directory'
      ).toBe(false);

      expect(
        scriptContent.includes('/E/'),
        'Script must not hardcode absolute paths to repo E/'
      ).toBe(false);
    });
  });
});

