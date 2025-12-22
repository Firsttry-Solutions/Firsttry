/**
 * platform_dependency_disclosure.test.ts
 * 
 * CI Gate: Ensure Atlassian platform-controlled behaviors are explicitly disclaimed.
 * 
 * Fails if:
 * - FirstTry claims ownership of uninstall cleanup
 * - FirstTry claims to determine data residency
 * - FirstTry claims to manage encryption/backup
 * - Missing "Atlassian-controlled" disclaimer
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Platform Dependency Disclosure', () => {
  let dataRetentionDoc = '';
  let enterpriseReadinessDoc = '';
  let complianceDoc = '';
  let privacyDoc = '';

  beforeAll(() => {
    try {
      dataRetentionDoc = fs.readFileSync(
        path.resolve(process.cwd(), 'docs/DATA_RETENTION.md'),
        'utf-8'
      );
    } catch (e) {}

    try {
      enterpriseReadinessDoc = fs.readFileSync(
        path.resolve(process.cwd(), 'docs/ENTERPRISE_READINESS.md'),
        'utf-8'
      );
    } catch (e) {}

    try {
      complianceDoc = fs.readFileSync(
        path.resolve(process.cwd(), 'docs/COMPLIANCE.md'),
        'utf-8'
      );
    } catch (e) {}

    try {
      privacyDoc = fs.readFileSync(path.resolve(process.cwd(), 'docs/PRIVACY.md'), 'utf-8');
    } catch (e) {}
  });

  describe('Platform-Controlled Behaviors section', () => {
    it('DATA_RETENTION.md includes "Platform-Controlled Behaviors" section', () => {
      expect(dataRetentionDoc).toMatch(/platform-controlled behaviors/i);
    });

    it('ENTERPRISE_READINESS.md includes "Platform-Controlled Behaviors" section', () => {
      expect(enterpriseReadinessDoc).toMatch(/platform-controlled behaviors/i);
    });

    it('Both sections explicitly list behaviors FirstTry does NOT control', () => {
      const sections = [dataRetentionDoc, enterpriseReadinessDoc];

      sections.forEach(section => {
        expect(
          section.match(
            /storage|deletion|uninstall|residency|backup|recovery|encryption|quota/i
          )
        ).not.toBeNull();
      });
    });
  });

  describe('Uninstall behavior disclaimer', () => {
    it('DATA_RETENTION.md disclaims uninstall deletion control', () => {
      expect(dataRetentionDoc).toMatch(
        /uninstall.*atlassian|atlassian.*uninstall|does not.*control.*uninstall/i
      );
    });

    it('No claim "FirstTry deletes data on uninstall"', () => {
      const docs = [dataRetentionDoc, enterpriseReadinessDoc, complianceDoc];

      docs.forEach(doc => {
        expect(doc).not.toMatch(/FirstTry.*delete.*uninstall|FirstTry.*purge.*uninstall/i);
      });
    });

    it('States customer must request deletion from Atlassian', () => {
      expect(dataRetentionDoc).toMatch(/request.*atlassian|contact.*atlassian|manual.*deletion/i);
    });
  });

  describe('Data residency disclaimer', () => {
    it('DATA_RETENTION.md disclaims residency control', () => {
      expect(dataRetentionDoc).toMatch(
        /residency.*atlassian|atlassian.*residency|does not.*control.*location|cannot.*specify.*residency/i
      );
    });

    it('ENTERPRISE_READINESS.md includes residency in Platform-Controlled section', () => {
      expect(enterpriseReadinessDoc).toMatch(
        /platform-controlled.*residency|residency.*atlassian|FirstTry.*cannot.*residency/i
      );
    });

    it('No claim "FirstTry determines data residency"', () => {
      const docs = [dataRetentionDoc, enterpriseReadinessDoc, complianceDoc];

      docs.forEach(doc => {
        expect(doc).not.toMatch(/FirstTry.*determines.*residency|FirstTry.*controls.*region/i);
      });
    });

    it('States Jira Cloud region determines location', () => {
      expect(complianceDoc || enterpriseReadinessDoc).toMatch(/jira.*region|jira.*cloud.*region/i);
    });
  });

  describe('Backup and recovery disclaimer', () => {
    it('ENTERPRISE_READINESS.md includes backup in Platform-Controlled section', () => {
      expect(enterpriseReadinessDoc).toMatch(
        /backup.*atlassian|recovery.*atlassian|platform-controlled.*backup/i
      );
    });

    it('No claim "FirstTry handles backup"', () => {
      const docs = [dataRetentionDoc, enterpriseReadinessDoc, complianceDoc];

      docs.forEach(doc => {
        expect(doc).not.toMatch(/FirstTry.*backup|FirstTry.*recovery/i);
      });
    });

    it('States customer must contact Atlassian for recovery', () => {
      expect(enterpriseReadinessDoc).toMatch(/contact.*atlassian.*recovery|atlassian.*recovery/i);
    });
  });

  describe('Encryption and key management disclaimer', () => {
    it('ENTERPRISE_READINESS.md includes encryption in Platform-Controlled section', () => {
      expect(enterpriseReadinessDoc).toMatch(
        /encryption.*atlassian|atlassian.*encryption|platform-controlled.*encrypt/i
      );
    });

    it('No claim "FirstTry manages encryption keys"', () => {
      const docs = [dataRetentionDoc, enterpriseReadinessDoc, complianceDoc];

      docs.forEach(doc => {
        expect(doc).not.toMatch(/FirstTry.*encrypt|FirstTry.*key.*manage/i);
      });
    });

    it('States Atlassian manages encryption standards', () => {
      expect(enterpriseReadinessDoc).toMatch(/atlassian.*encrypt|forge.*encrypt/i);
    });
  });

  describe('Storage quota disclaimer', () => {
    it('DATA_RETENTION.md includes quotas in Platform-Controlled section', () => {
      expect(dataRetentionDoc).toMatch(
        /quota.*atlassian|storage.*limit.*atlassian|platform-controlled.*quota/i
      );
    });

    it('No claim "FirstTry enforces storage limits"', () => {
      const docs = [dataRetentionDoc, enterpriseReadinessDoc];

      docs.forEach(doc => {
        expect(doc).not.toMatch(/FirstTry.*limit.*storage|FirstTry.*quota/i);
      });
    });

    it('States Forge manages storage quotas', () => {
      expect(dataRetentionDoc).toMatch(/forge.*quota|atlassian.*forge.*limit/i);
    });
  });

  describe('Consistent "VERIFIED WITH DEPENDENCY" marking', () => {
    it('CLAIMS_PROOF_CATALOG marks platform-dependent claims appropriately', () => {
      const catalogPath = path.resolve(process.cwd(), 'audit/CLAIMS_PROOF_CATALOG.md');
      if (fs.existsSync(catalogPath)) {
        const catalog = fs.readFileSync(catalogPath, 'utf-8');

        // Platform-dependent claims: RET-002, RET-003, RET-004, RET-005, ER-001, etc.
        const dependencyClaims = catalog.match(/VERIFIED WITH DEPENDENCY/gi) || [];
        expect(dependencyClaims.length).toBeGreaterThan(0);

        // These should be marked as VERIFIED WITH DEPENDENCY
        expect(catalog).toMatch(/RET-002.*VERIFIED WITH DEPENDENCY/i); // Uninstall
        expect(catalog).toMatch(/RET-003.*VERIFIED WITH DEPENDENCY/i); // Residency
        expect(catalog).toMatch(/RET-004.*VERIFIED WITH DEPENDENCY/i); // Backup/recovery
      }
    });
  });

  describe('No implicit FirstTry responsibility', () => {
    it('Language does not suggest FirstTry manages platform behaviors', () => {
      const docs = [dataRetentionDoc, enterpriseReadinessDoc];

      docs.forEach(doc => {
        // Avoid passive voice that implies FirstTry responsibility
        if (doc.match(/is (managed|controlled|governed)/i)) {
          // Should include "by Atlassian" or "by Forge"
          expect(
            doc.match(/is (managed|controlled|governed).*by\s+(atlassian|forge)/i)
          ).not.toBeNull();
        }
      });
    });
  });
});
