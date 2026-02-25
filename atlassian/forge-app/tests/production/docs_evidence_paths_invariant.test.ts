/**
 * docs_evidence_paths_invariant.test.ts
 * 
 * Regression test to ensure documentation uses $E/ and FT_PROD_READY_E 
 * instead of hardcoded repo-root E/ evidence directories
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const REPO_ROOT = process.cwd();
const DOCS_PROD_DIR = path.join(REPO_ROOT, 'docs/production');

describe('Documentation Evidence Path Invariants', () => {
  describe('No hardcoded repo-root E/ paths', () => {
    it('docs/production/ must not reference hardcoded E/ with plain text (no $E)', () => {
      const docFiles = fs.readdirSync(DOCS_PROD_DIR).filter((f) => f.endsWith('.md'));
      
      const forbiddenPatterns = [
        /[^$]E\/[0-9]{2}_/, // E/02_inventory format without $
        /\/workspaces.*E\//, // Absolute repo paths to E/
      ];
      
      for (const docFile of docFiles) {
        const content = fs.readFileSync(path.join(DOCS_PROD_DIR, docFile), 'utf-8');
        
        for (const pattern of forbiddenPatterns) {
          expect(
            pattern.test(content),
            `${docFile} should not contain hardcoded E/ paths: ${pattern}`
          ).toBe(false);
        }
      }
    });

    it('docs must consistently use $E/ or FT_PROD_READY_E for evidence references', () => {
      const marketplaceDoc = fs.readFileSync(
        path.join(DOCS_PROD_DIR, '40_MARKETPLACE_READINESS_PACK.md'),
        'utf-8'
      );
      
      // Should use $E/ notation
      expect(marketplaceDoc).toContain('$E/');
      
      // Should mention FT_PROD_READY_E to explain parameterization
      expect(marketplaceDoc).toContain('FT_PROD_READY_E');
    });
  });

  describe('Evidence directories use FT_PROD_READY_E contract', () => {
    it('at least one principal doc should mention FT_PROD_READY_E environment variable', () => {
      const docFiles = [
        '40_MARKETPLACE_READINESS_PACK.md',
        '50_RELEASE_RUNBOOK.md',
        '00_PRODUCTION_READY_INDEX.md',
      ];
      
      let foundFtProdReadyE = false;
      for (const docFile of docFiles) {
        const filePath = path.join(DOCS_PROD_DIR, docFile);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          if (content.includes('FT_PROD_READY_E')) {
            foundFtProdReadyE = true;
            break;
          }
        }
      }
      
      expect(foundFtProdReadyE, 'At least one doc should reference FT_PROD_READY_E environment variable').toBe(true);
    });
  });

  describe('Documentation clarity', () => {
    it('$E/ should be documented as parameterized via FT_PROD_READY_E', () => {
      const readmeContent = fs.readFileSync(
        path.join(DOCS_PROD_DIR, '40_MARKETPLACE_READINESS_PACK.md'),
        'utf-8'
      );
      
      // Should have $E/ references
      expect(readmeContent).toContain('$E/');
      
      // Should mention FT_PROD_READY_E when illustrating usage
      expect(readmeContent).toContain('FT_PROD_READY_E');
    });
  });
});
