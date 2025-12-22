/**
 * controller_processor_consistency.test.ts
 * 
 * CI Gate: Prevent data controller/processor misclassification.
 * 
 * Fails if:
 * - "FirstTry is a data processor" language reappears
 * - Absolute processor claims without qualification
 * - Customer controller role is not clearly stated
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Data Controller/Processor Consistency', () => {
  let complianceDoc = '';
  let privacyDoc = '';
  let enterpriseReadinessDoc = '';
  let termsDoc = '';

  beforeAll(() => {
    try {
      complianceDoc = fs.readFileSync(
        path.resolve(process.cwd(), 'docs/COMPLIANCE.md'),
        'utf-8'
      );
    } catch (e) {}

    try {
      privacyDoc = fs.readFileSync(path.resolve(process.cwd(), 'docs/PRIVACY.md'), 'utf-8');
    } catch (e) {}

    try {
      enterpriseReadinessDoc = fs.readFileSync(
        path.resolve(process.cwd(), 'docs/ENTERPRISE_READINESS.md'),
        'utf-8'
      );
    } catch (e) {}

    try {
      termsDoc = fs.readFileSync(path.resolve(process.cwd(), 'docs/TERMS.md'), 'utf-8');
    } catch (e) {}
  });

  describe('Customer controller role', () => {
    it('COMPLIANCE.md states customers are data controllers', () => {
      expect(complianceDoc).toMatch(/customer.*data controller|remain.*data controller/i);
    });

    it('PRIVACY.md clarifies control model', () => {
      expect(privacyDoc).toMatch(/customer.*control|data controller|under.*agreement/i);
    });

    it('No absolute "FirstTry is a data processor" language', () => {
      // Search for problematic pattern
      const docs = [complianceDoc, privacyDoc, enterpriseReadinessDoc];

      docs.forEach(doc => {
        // "FirstTry is a data processor" is TOO absolute without qualification
        const absoluteProcessor = doc.match(/FirstTry\s+(is|operates as)\s+a?\s+data processor/i);
        expect(absoluteProcessor).toBeNull();
      });
    });
  });

  describe('Processing within customer control', () => {
    it('COMPLIANCE.md states FirstTry processes data under customer agreement', () => {
      expect(complianceDoc).toMatch(/under.*customer.*agreement|within.*forge.*under/i);
    });

    it('No claim that FirstTry determines processing purpose', () => {
      const docs = [complianceDoc, privacyDoc];

      docs.forEach(doc => {
        expect(doc).not.toMatch(/FirstTry.*determines.*purpose|FirstTry.*decides.*purpose/i);
      });
    });

    it('No claim that FirstTry sets retention policy', () => {
      const docs = [complianceDoc, privacyDoc, enterpriseReadinessDoc];

      docs.forEach(doc => {
        expect(doc).not.toMatch(/FirstTry.*sets.*retention|FirstTry.*determines.*retention/i);
      });
    });
  });

  describe('Atlassian role clarity', () => {
    it('Docs clarify Atlassian Forge infrastructure role', () => {
      const docs = [complianceDoc, privacyDoc, enterpriseReadinessDoc];

      const mentionsAtlassian = docs.some(doc => doc.match(/atlassian.*forge|forge.*atlassian/i));
      expect(mentionsAtlassian).toBe(true);
    });

    it('COMPLIANCE.md references reliance on Atlassian terms', () => {
      expect(complianceDoc).toMatch(/atlassian.*terms|forge.*platform|atlassian.*agreement/i);
    });
  });

  describe('No implied FirstTry control', () => {
    it('No claim that FirstTry controls encryption keys', () => {
      const docs = [complianceDoc, privacyDoc, enterpriseReadinessDoc];

      docs.forEach(doc => {
        expect(doc).not.toMatch(/FirstTry.*controls.*encrypt|FirstTry.*manages.*key/i);
      });
    });

    it('No claim that FirstTry controls data residency', () => {
      const docs = [complianceDoc, privacyDoc, enterpriseReadinessDoc];

      docs.forEach(doc => {
        expect(doc).not.toMatch(/FirstTry.*controls.*residency|FirstTry.*determines.*region/i);
      });
    });

    it('No claim that FirstTry controls data backup', () => {
      const docs = [complianceDoc, privacyDoc, enterpriseReadinessDoc];

      docs.forEach(doc => {
        expect(doc).not.toMatch(/FirstTry.*backup|FirstTry.*recovery/i);
      });
    });
  });

  describe('CLAIMS_PROOF_CATALOG consistency', () => {
    it('CLAIMS_PROOF_CATALOG marks controller/processor as VERIFIED', () => {
      const catalogPath = path.resolve(process.cwd(), 'audit/CLAIMS_PROOF_CATALOG.md');
      if (fs.existsSync(catalogPath)) {
        const catalog = fs.readFileSync(catalogPath, 'utf-8');

        // Look for COMP-006 claim about controller/processor
        const controllerClaim = catalog.match(/COMP-006.*controller.*✅ VERIFIED/i);
        expect(controllerClaim).not.toBeNull();
      }
    });
  });

  describe('Qualification of processing role', () => {
    it('If "processor" language used, it is qualified (e.g., "within Forge")', () => {
      const docs = [complianceDoc, privacyDoc];

      docs.forEach(doc => {
        if (doc.match(/processor/i)) {
          // Any processor mention should be qualified
          expect(
            doc.match(
              /processor.*forge|processor.*atlassian|processor.*customer.*agreement/i
            ) !== null
          ).toBe(true);
        }
      });
    });
  });
});
