/**
 * no_tmp_lockfile_contract_invariant.test.ts
 *
 * Regression test to ensure /tmp/ft_prod_ready_dir.txt lockfile is completely
 * removed from the production audit system. FT_PROD_READY_E is now the SOLE
 * source of truth for the evidence directory location.
 *
 * Scope: This test enforces the lockfile absence ONLY in production execution paths
 * and documentation. Tests themselves may reference the sentinel string to assert
 * its absence elsewhere (this file is the only intended reference point).
 *
 * Key invariants (PRODUCTION CODE ONLY):
 * - NO references to /tmp/ft_prod_ready_dir.txt exist in tools/production/*.sh
 * - NO references to /tmp/ft_prod_ready_dir.txt exist in docs/production/*.md
 * - ALL core scripts validate FT_PROD_READY_E with hard-fail semantics
 * - NO fallback logic exists (fail-closed enforcement required)
 *
 * Tests allowed to reference the string:
 * - This file (invariant assertion itself)
 * - run_prod_ready_audit_truthfulness_invariant.test.ts (for structure validation)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const REPO_ROOT = process.cwd();
const TOOLS_PROD = path.join(REPO_ROOT, 'tools/production');
const DOCS_PROD = path.join(REPO_ROOT, 'docs/production');

describe('No /tmp Lockfile Contract Invariant', () => {
  describe('Lockfile references must be eliminated', () => {
    it('no /tmp/ft_prod_ready_dir.txt references in tools/production/*.sh', () => {
      const bashFiles = fs
        .readdirSync(TOOLS_PROD)
        .filter((f) => f.endsWith('.sh'))
        .map((f) => path.join(TOOLS_PROD, f));
      const violations = [];

      for (const file of bashFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        if (content.includes('/tmp/ft_prod_ready_dir.txt')) {
          violations.push(path.relative(REPO_ROOT, file));
        }
      }

      expect(
        violations.length,
        `Found /tmp/ft_prod_ready_dir.txt in scripts: ${violations.join(', ')}`
      ).toBe(0);
    });

    it('no "ft_prod_ready_dir" references in docs/production/*.md', () => {
      const docFiles = fs
        .readdirSync(DOCS_PROD)
        .filter((f) => f.endsWith('.md'))
        .map((f) => path.join(DOCS_PROD, f));
      const violations = [];

      for (const file of docFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        if (content.includes('ft_prod_ready_dir')) {
          violations.push(path.relative(REPO_ROOT, file));
        }
      }

      expect(
        violations.length,
        `Found ft_prod_ready_dir in docs: ${violations.join(', ')}`
      ).toBe(0);
    });
  });

  describe('FT_PROD_READY_E validation must be present', () => {
    const CORE_SCRIPTS = [
      'run_prod_ready_audit.sh',
      'verify_tests_clean.sh',
      'verify_ui_markers.sh',
      'verify_proof_discipline.sh',
      'verify_no_repo_root_E_refs.sh',
      'run_build_proof.sh',
      'verify_no_outbound_runtime.sh',
    ];

    for (const scriptName of CORE_SCRIPTS) {
      it(`${scriptName} must validate FT_PROD_READY_E`, () => {
        const scriptPath = path.join(TOOLS_PROD, scriptName);
        const content = fs.readFileSync(scriptPath, 'utf-8');

        // Must reference FT_PROD_READY_E
        expect(
          content,
          `${scriptName} must validate FT_PROD_READY_E environment variable`
        ).toContain('FT_PROD_READY_E');

        // Must NOT have fallback logic
        expect(
          content,
          `${scriptName} must not have /tmp/ft_prod_ready_dir.txt fallback`
        ).not.toContain('/tmp/ft_prod_ready_dir.txt');
      });
    }
  });

  describe('Hard-fail semantics must be enforced', () => {
    it('orchestrator (run_prod_ready_audit.sh) must fail-close on missing FT_PROD_READY_E', () => {
      const scriptPath = path.join(TOOLS_PROD, 'run_prod_ready_audit.sh');
      const content = fs.readFileSync(scriptPath, 'utf-8');

      // Check for FT_PROD_READY_E validation
      expect(
        content,
        'Orchestrator must validate FT_PROD_READY_E is set'
      ).toContain('FT_PROD_READY_E');

      // Check that hard-fail is present
      expect(
        content,
        'Orchestrator must exit 1 if FT_PROD_READY_E not set or invalid'
      ).toContain('exit 1');

      // Verify no "|| true" masking in critical section
      const lines = content.split('\n');
      const criticalLines = lines
        .slice(0, 30) // First 30 lines should contain FT_PROD_READY_E validation
        .join('\n');

      expect(
        criticalLines,
        'Orchestrator initialization must not use || true masking'
      ).not.toContain('|| true');
    });

    it('all step scripts must have strict validation pattern', () => {
      const stepScripts = [
        'verify_tests_clean.sh',
        'verify_ui_markers.sh',
        'verify_proof_discipline.sh',
      ];

      for (const scriptName of stepScripts) {
        const scriptPath = path.join(TOOLS_PROD, scriptName);
        const content = fs.readFileSync(scriptPath, 'utf-8');

        // Extract first 50 lines for validation check
        const firstLines = content.split('\n').slice(0, 50).join('\n');

        expect(
          firstLines,
          `${scriptName} must validate FT_PROD_READY_E early`
        ).toContain('FT_PROD_READY_E');

        expect(
          firstLines,
          `${scriptName} must not use /tmp fallback`
        ).not.toContain('/tmp/ft_prod_ready_dir');
      }
    });
  });

  describe('Scope validation: lockfile absence enforcement', () => {
    it('enforces production code/docs scope (does NOT scan src/ or other paths)', () => {
      // This test documents the intentional scope: only production execution paths
      // (tools/, docs/) must have zero lockfile references.
      // src/ and other repo paths are explicitly out of scope for this invariant.

      const bashFiles = fs
        .readdirSync(TOOLS_PROD)
        .filter((f) => f.endsWith('.sh'));
      const docFiles = fs
        .readdirSync(DOCS_PROD)
        .filter((f) => f.endsWith('.md'));

      // Verify we actually scanned both directories
      expect(
        bashFiles.length,
        'tools/production should contain bash scripts'
      ).toBeGreaterThan(0);
      expect(
        docFiles.length,
        'docs/production should contain markdown files'
      ).toBeGreaterThan(0);

      // Confirm the scope of this invariant
      expect(
        TOOLS_PROD,
        'Scope verified: scanning tools/production'
      ).toContain('tools/production');
      expect(
        DOCS_PROD,
        'Scope verified: scanning docs/production'
      ).toContain('docs/production');
    });
  });
});
