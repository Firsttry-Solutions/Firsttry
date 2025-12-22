/**
 * dpa_language_consistency.test.ts
 * 
 * CI Gate: Prevent DPA stance contradictions.
 * 
 * Fails if:
 * - Both "DPA provided" and "No DPA" language appear
 * - "DPA available on request" contradicts "DPA not offered"
 * - Ambiguous DPA language detected
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('DPA Language Consistency', () => {
  let complianceDoc = '';
  let enterpriseReadinessDoc = '';
  let termsDoc = '';
  let privacyDoc = '';

  beforeAll(() => {
    const docsDir = path.resolve(__dirname, '../../../../docs');
    try {
      complianceDoc = fs.readFileSync(
        path.join(docsDir, 'COMPLIANCE.md'),
        'utf-8'
      );
    } catch (e) {}

    try {
      enterpriseReadinessDoc = fs.readFileSync(
        path.join(docsDir, 'ENTERPRISE_READINESS.md'),
        'utf-8'
      );
    } catch (e) {}

    try {
      termsDoc = fs.readFileSync(path.join(docsDir, 'TERMS.md'), 'utf-8');
    } catch (e) {}

    try {
      privacyDoc = fs.readFileSync(path.join(docsDir, 'PRIVACY.md'), 'utf-8');
    } catch (e) {}
  });

  describe('Single DPA stance', () => {
    it('COMPLIANCE.md clearly states DPA stance', () => {
      expect(complianceDoc).toMatch(
        /does not.*offer.*DPA|no.*DPA|not.*provide.*DPA/i
      );
    });

    it('No "DPA available on request" language in COMPLIANCE.md', () => {
      expect(complianceDoc).not.toMatch(/available on request|upon request/i);
    });

    it('COMPLIANCE.md references reliance on Atlassian terms', () => {
      expect(complianceDoc).toMatch(/rely.*atlassian|atlassian.*terms|forge.*terms/i);
    });
  });

  describe('No contradictory DPA language across docs', () => {
    it('ENTERPRISE_READINESS.md does not contradict DPA stance', () => {
      const docs = [complianceDoc, enterpriseReadinessDoc, termsDoc, privacyDoc];

      // Collect DPA language from all docs
      const hasNoDPA = docs.some(doc => doc.match(/does not.*offer.*DPA|no.*DPA/i));
      const hasAvailableOnRequest = docs.some(doc => doc.match(/available on request/i));

      // Cannot both claim "no DPA" and "available on request"
      if (hasNoDPA) {
        expect(hasAvailableOnRequest).toBe(false);
      }
    });

    it('No "DPA on request" language anywhere in docs', () => {
      const allDocs = [complianceDoc, enterpriseReadinessDoc, termsDoc, privacyDoc];

      allDocs.forEach(doc => {
        expect(doc).not.toMatch(/DPA.*request|DPA.*available|DPA.*provided/i);
      });
    });

    it('TERMS.md does not offer or claim to provide DPA', () => {
      if (termsDoc.includes('DPA')) {
        expect(termsDoc).not.toMatch(/we.*offer.*DPA|we.*provide.*DPA|available.*DPA/i);
      }
    });
  });

  describe('Clear contact guidance for DPA questions', () => {
    it('COMPLIANCE.md provides Atlassian contact for DPA questions', () => {
      expect(complianceDoc).toMatch(/contact.*atlassian|security@atlassian/i);
    });

    it('DPA language does not promise FirstTry will provide', () => {
      expect(complianceDoc).not.toMatch(/FirstTry.*will.*provide.*DPA|FirstTry.*offers.*DPA/i);
    });
  });

  describe('CLAIMS_PROOF_CATALOG consistency', () => {
    it('CLAIMS_PROOF_CATALOG marks DPA claim as VERIFIED', () => {
      const catalogPath = path.resolve(process.cwd(), 'audit/CLAIMS_PROOF_CATALOG.md');
      if (fs.existsSync(catalogPath)) {
        const catalog = fs.readFileSync(catalogPath, 'utf-8');

        // Look for DPA-related claim marked VERIFIED
        const dpaClaim = catalog.match(/COMP-005.*No DPA.*✅ VERIFIED/i);
        expect(dpaClaim).not.toBeNull();
      }
    });
  });

  describe('No implicit DPA language', () => {
    it('No statement like "DPA-compliant" without context', () => {
      const allDocs = [complianceDoc, enterpriseReadinessDoc, termsDoc, privacyDoc];

      allDocs.forEach(doc => {
        if (doc.includes('DPA-compliant')) {
          // If mentioned, should be in negative context
          expect(doc).toMatch(/not.*DPA-compliant|cannot.*DPA-compliant/i);
        }
      });
    });

    it('No vague "data processing" language without control disclaimer', () => {
      // If docs discuss data processing, they should clarify who controls it
      const processingDocs = [complianceDoc, privacyDoc];

      processingDocs.forEach(doc => {
        if (doc.match(/data processing|processes data/i)) {
          expect(doc).toMatch(/atlassian|customer|you.*control/i);
        }
      });
    });
  });
});
