/**
 * enterprise_audit_invariants.test.ts
 * 
 * Regression tests for enterprise audit reproducibility constraints
 * Ensures all scripts follow FT_PROD_READY_E contract and forbidden pattern rules
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const REPO_ROOT = process.cwd();
const TOOLS_PROD = path.join(REPO_ROOT, 'tools/production');

const AUDIT_SCRIPTS = [
  'run_enterprise_audit.sh',
  'audit_requestjira_map.sh',
  'audit_zero_egress.sh',
  'generate_scope_justification.mjs'
];

const FORBIDDEN_PATTERNS = [
  /timeout\s+|sleep\s+|nohup\s+|disown\s+/,  // No async
  /\|\|\s*true|&\s*$/,                       // No masking
  /\|\|\s*:|\|\|\s*exit\s+0|;\s*true/,     // No masking variants
];

const REQUIRED_PATTERNS = {
  'audit_requestjira_map.sh': /FT_PROD_READY_E/,
  'audit_zero_egress.sh': /FT_PROD_READY_E/,
  'run_enterprise_audit.sh': /FT_PROD_READY_E/,
  'generate_scope_justification.mjs': /process\.env\.FT_PROD_READY_E|process\.env\['FT_PROD_READY_E'\]/
};

describe('Enterprise Audit Invariants', () => {
  describe('FT_PROD_READY_E validation', () => {
    for (const script of AUDIT_SCRIPTS) {
      it(`${script}: must validate FT_PROD_READY_E`, () => {
        const scriptPath = path.join(TOOLS_PROD, script);
        expect(fs.existsSync(scriptPath), `${script} exists`).toBe(true);
        
        const content = fs.readFileSync(scriptPath, 'utf-8');
        const required = REQUIRED_PATTERNS[script as keyof typeof REQUIRED_PATTERNS];
        
        if (required) {
          expect(
            required.test(content),
            `${script} must check FT_PROD_READY_E`
          ).toBe(true);
        }
      });
    }
  });

  describe('Forbidden patterns', () => {
    for (const script of AUDIT_SCRIPTS) {
      it(`${script}: must not contain forbidden patterns`, () => {
        const scriptPath = path.join(TOOLS_PROD, script);
        const content = fs.readFileSync(scriptPath, 'utf-8');
        
        for (const pattern of FORBIDDEN_PATTERNS) {
          expect(
            pattern.test(content),
            `${script} must not contain pattern: ${pattern}`
          ).toBe(false);
        }
      });
    }
  });

  describe('Repo-root E/ ban', () => {
    it('scripts must not hardcode REPO_ROOT/E/ paths', () => {
      for (const script of AUDIT_SCRIPTS) {
        const scriptPath = path.join(TOOLS_PROD, script);
        const content = fs.readFileSync(scriptPath, 'utf-8');
        
        expect(
          /REPO_ROOT['"]\s*\/\s*'E'/.test(content) ||
          /path\.join\([^)]*'E'[^)]*\)/.test(content),
          `${script} must not hardcode REPO_ROOT/E/ paths`
        ).toBe(false);
      }
    });

    it('E/ must be in .gitignore', () => {
      const gitignorePath = path.join(REPO_ROOT, '.gitignore');
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toContain('E/');
    });

    it('E/ directory must not exist in repo', () => {
      const ePath = path.join(REPO_ROOT, 'E');
      expect(fs.existsSync(ePath), 'E/ must not exist in repo').toBe(false);
    });
  });

  describe('Evidence determinism', () => {
    it('scripts must not include timestamps in evidence files', () => {
      const timestampPatterns = [
        /date\s*\-u/,
        /new\s+Date\(\)/,
        /Date\.now\(\)/,
        /moment\(\)/,
      ];
      
      for (const script of AUDIT_SCRIPTS) {
        const scriptPath = path.join(TOOLS_PROD, script);
        const content = fs.readFileSync(scriptPath, 'utf-8');
        
        // Look for timestamp generation in evidence file writes
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Skip comments and non-evidence-file contexts
          if (line.includes('//') || line.includes('#')) continue;
          
          // Check if line writes to evidence file
          if (line.includes('_summary.txt') || line.includes('_inventory.txt') || line.includes('_table.md')) {
            for (const pattern of timestampPatterns) {
              expect(
                pattern.test(line),
                `${script}:${i + 1} must not use timestamps in evidence: ${line}`
              ).toBe(false);
            }
          }
        }
      }
    });
  });

  describe('Exit code correctness', () => {
    it('orchestrator must use exit code accumulation not early exit', () => {
      const orchestratorPath = path.join(TOOLS_PROD, 'run_enterprise_audit.sh');
      const content = fs.readFileSync(orchestratorPath, 'utf-8');
      
      expect(content).toContain('OVERALL_EXIT');
      expect(content).toMatch(/exit\s+\$\{OVERALL_EXIT\}/);
    });

    it('each script must exit 0 or 1 deterministically', () => {
      for (const script of AUDIT_SCRIPTS.filter(s => s !== 'processor_requestjira.mjs')) {
        const scriptPath = path.join(TOOLS_PROD, script);
        const content = fs.readFileSync(scriptPath, 'utf-8');
        
        // Must have exit 0 and exit 1 calls
        expect(
          /exit\s+0|exit\s+1/.test(content),
          `${script} must use explicit exit codes`
        ).toBe(true);
      }
    });
  });

  describe('Evidence directory structure', () => {
    it('scripts must use AUDIT_DIR variable consistently', () => {
      const auditScripts = ['audit_requestjira_map.sh', 'audit_zero_egress.sh'];
      
      for (const script of auditScripts) {
        const scriptPath = path.join(TOOLS_PROD, script);
        const content = fs.readFileSync(scriptPath, 'utf-8');
        
        expect(
          /AUDIT_DIR/.test(content),
          `${script} must define and use AUDIT_DIR`
        ).toBe(true);
      }
    });
  });
});
