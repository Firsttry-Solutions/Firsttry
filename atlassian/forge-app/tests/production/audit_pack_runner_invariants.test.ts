/**
 * audit_pack_runner_invariants.test.ts
 *
 * Regression test to ensure the one-shot audit pack runner is logically sound:
 * - Properly validates FT_PROD_READY_E contract (fail-closed)
 * - Generates 4 required top-level evidence files
 * - Contains no banned patterns that would violate determinism
 * - Uses deterministic ordering for manifest generation
 * - Never references the old /tmp lockfile contract
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const REPO_ROOT = process.cwd();
const SCRIPT_PATH = path.join(REPO_ROOT, 'tools/production/run_audit_pack.sh');

describe('Audit Pack Runner Invariants', () => {
  describe('Script structure validation', () => {
    it('script exists and is executable', () => {
      expect(fs.existsSync(SCRIPT_PATH), 'Script must exist').toBe(true);

      try {
        fs.accessSync(SCRIPT_PATH, fs.constants.X_OK);
      } catch (e) {
        throw new Error('Script must be executable');
      }
    });

    it('uses set -euo pipefail for fail-closed semantics', () => {
      const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
      expect(content).toContain('set -euo pipefail');
    });
  });

  describe('FT_PROD_READY_E contract enforcement', () => {
    it('validates FT_PROD_READY_E is set', () => {
      const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');

      expect(
        content,
        'Must check FT_PROD_READY_E is not empty'
      ).toContain('FT_PROD_READY_E:-');

      expect(
        content,
        'Must hard-exit if FT_PROD_READY_E is empty'
      ).toContain('exit 1');
    });

    it('validates FT_PROD_READY_E directory exists', () => {
      const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');

      expect(
        content,
        'Must check if directory exists'
      ).toContain('! -d "$E"');

      expect(
        content,
        'Must hard-exit if directory missing'
      ).toContain('exit 1');
    });

    it('does not use /tmp/ft_prod_ready_dir.txt fallback', () => {
      const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');

      expect(
        content,
        'Must not reference old lockfile contract'
      ).not.toContain('/tmp/ft_prod_ready_dir.txt');
    });
  });

  describe('Required output files', () => {
    it('writes AUDIT_PACK_VERDICT.txt at root of $E', () => {
      const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
      expect(content).toContain('AUDIT_PACK_VERDICT.txt');
      expect(content).toContain('VERDICT_FILE="$E/AUDIT_PACK_VERDICT.txt"');
    });

    it('writes AUDIT_PACK_SUMMARY.md at root of $E', () => {
      const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
      expect(content).toContain('AUDIT_PACK_SUMMARY.md');
      expect(content).toContain('SUMMARY_FILE="$E/AUDIT_PACK_SUMMARY.md"');
    });

    it('writes AUDIT_PACK_MANIFEST.sha256 at root of $E', () => {
      const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
      expect(content).toContain('AUDIT_PACK_MANIFEST.sha256');
      expect(content).toContain('MANIFEST_FILE="$E/AUDIT_PACK_MANIFEST.sha256"');
    });

    it('writes AUDIT_PACK_VERIFY.sh at root of $E', () => {
      const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
      expect(content).toContain('AUDIT_PACK_VERIFY.sh');
      expect(content).toContain('VERIFIER_FILE="$E/AUDIT_PACK_VERIFY.sh"');
    });
  });

  describe('Deterministic execution', () => {
    it('does not use || true masking patterns', () => {
      const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
      expect(content, 'Must not use || true').not.toContain('|| true');
    });

    it('does not use timeout command', () => {
      const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
      expect(content, 'Must not use timeout').not.toContain('timeout');
    });

    it('does not use sleep command', () => {
      const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
      expect(content, 'Must not use sleep').not.toContain('sleep');
    });

    it('does not use background execution (&)', () => {
      const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
      const lines = content.split('\n');
      const backgroundLines = lines.filter((line) => {
        // Ignore comments and lines with & in strings
        if (line.trim().startsWith('#')) return false;
        // Look for dangerous patterns like "command &" at end of line
        return /[^#]*\s&\s*$/.test(line) || /[^#]*\s&\s*#/.test(line);
      });

      expect(
        backgroundLines.length,
        'Must not use background execution'
      ).toBe(0);
    });

    it('uses deterministic file ordering (LC_ALL=C sort)', () => {
      const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
      expect(
        content,
        'Must use LC_ALL=C sort for deterministic ordering'
      ).toContain('LC_ALL=C sort');
    });

    it('excludes metadata files from manifest generation', () => {
      const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');

      expect(
        content,
        'Must exclude AUDIT_PACK_MANIFEST.sha256 from manifest'
      ).toContain('! -name "AUDIT_PACK_MANIFEST.sha256"');

      expect(
        content,
        'Must exclude AUDIT_PACK_VERIFY.sh from manifest'
      ).toContain('! -name "AUDIT_PACK_VERIFY.sh"');

      expect(
        content,
        'Must exclude AUDIT_PACK_SUMMARY.md from manifest'
      ).toContain('! -name "AUDIT_PACK_SUMMARY.md"');

      expect(
        content,
        'Must exclude AUDIT_PACK_VERDICT.txt from manifest'
      ).toContain('! -name "AUDIT_PACK_VERDICT.txt"');
    });
  });

  describe('Subprocess orchestration', () => {
    it('runs prod-ready audit via FT_PROD_READY_E export', () => {
      const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
      expect(
        content,
        'Must run prod-ready audit'
      ).toContain('run_prod_ready_audit.sh');
    });

    it('runs enterprise audit via FT_PROD_READY_E export', () => {
      const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
      expect(
        content,
        'Must run enterprise audit'
      ).toContain('run_enterprise_audit.sh');
    });

    it('captures exit codes from both audits', () => {
      const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');

      expect(
        content,
        'Must capture prod-ready exit code'
      ).toContain('PROD_READY_EXIT');

      expect(
        content,
        'Must capture enterprise exit code'
      ).toContain('ENTERPRISE_AUDIT_EXIT');
    });

    it('determinines verdict based on both exit codes', () => {
      const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');

      expect(
        content,
        'Must check PROD_READY_EXIT'
      ).toContain('$PROD_READY_EXIT" -eq 0');

      expect(
        content,
        'Must check ENTERPRISE_AUDIT_EXIT'
      ).toContain('$ENTERPRISE_AUDIT_EXIT" -eq 0');

      expect(
        content,
        'Must use && (and) logic for both checks'
      ).toContain(']] && [[');
    });
  });

  describe('Repository safety', () => {
    it('validates repo remains clean after audit', () => {
      const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');

      expect(
        content,
        'Must check git status --porcelain'
      ).toContain('git status --porcelain');

      expect(
        content,
        'Must fail if repo is dirty'
      ).toContain('Repository was mutated during audit pack generation');
    });

    it('exits with verdict code (0=PASS, 1=FAIL)', () => {
      const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');

      const lines = content.split('\n');
      const lastExit = lines
        .reverse()
        .find((line) => line.trim().match(/^exit\s+/));

      expect(
        lastExit,
        'Must exit with AUDIT_PACK_EXIT code'
      ).toMatch(/exit.*AUDIT_PACK_EXIT/);
    });
  });

  describe('Evidence directory structure', () => {
    it('creates required subdirectories under $E', () => {
      const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');

      expect(
        content,
        'Must create 09_release directory'
      ).toContain('$E/09_release');

      expect(
        content,
        'Must create 14_enterprise_audit directory'
      ).toContain('$E/14_enterprise_audit');
    });

    it('pre-creates directories with mkdir -p (fail-closed)', () => {
      const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');

      expect(
        content,
        'Must use mkdir -p to ensure idempotent directory creation'
      ).toContain('mkdir -p "$E/09_release" "$E/14_enterprise_audit"');
    });
  });
});
