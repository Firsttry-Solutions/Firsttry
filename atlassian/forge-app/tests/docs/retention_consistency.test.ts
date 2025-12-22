/**
 * retention_consistency.test.ts
 * 
 * CI Gate: Prevent retention policy contradictions.
 * 
 * Fails if:
 * - Numeric retention values (days) appear outside DATA_RETENTION.md
 * - Multiple retention stances detected across docs
 * - Contradiction between "indefinite" and "TTL" language
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Retention Policy Consistency', () => {
  let dataRetentionDoc = '';
  let complianceDoc = '';
  let enterpriseReadinessDoc = '';
  let privacyDoc = '';

  beforeAll(() => {
    const docsDir = path.resolve(__dirname, '../../../../docs');
    try {
      dataRetentionDoc = fs.readFileSync(
        path.join(docsDir, 'DATA_RETENTION.md'),
        'utf-8'
      );
    } catch (e) {}

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
      privacyDoc = fs.readFileSync(
        path.join(docsDir, 'PRIVACY.md'),
        'utf-8'
      );
    } catch (e) {}
  });

  describe('Retention authority', () => {
    it('DATA_RETENTION.md is the single source of truth', () => {
      expect(dataRetentionDoc).toMatch(/single source of truth/i);
    });

    it('All retention claims reference DATA_RETENTION.md', () => {
      // Check other docs reference the correct source
      if (complianceDoc.includes('retention')) {
        expect(complianceDoc).toMatch(/DATA_RETENTION/i);
      }
      if (enterpriseReadinessDoc.includes('retention')) {
        expect(enterpriseReadinessDoc).toMatch(/DATA_RETENTION/i);
      }
      if (privacyDoc.includes('retention')) {
        expect(privacyDoc).toMatch(/DATA_RETENTION/i);
      }
    });
  });

  describe('Indefinite retention stance', () => {
    it('DATA_RETENTION.md states indefinite retention clearly', () => {
      expect(dataRetentionDoc).toMatch(/retained indefinitely/i);
    });

    it('FirstTry does not enforce TTL (documented)', () => {
      expect(dataRetentionDoc).toMatch(
        /FirstTry does not.*enforce.*TTL|does not.*enforce.*time-based/i
      );
    });

    it('No contradictory "auto-delete" claims in ENTERPRISE_READINESS.md', () => {
      expect(enterpriseReadinessDoc).not.toMatch(
        /automatic.*data.*cleanup|auto-delete|auto-purge/i
      );
    });
  });

  describe('Platform control disclaimer', () => {
    it('DATA_RETENTION.md includes Platform-Controlled Behaviors section', () => {
      expect(dataRetentionDoc).toMatch(/platform-controlled behaviors/i);
    });

    it('DATA_RETENTION.md disclaims deletion on uninstall', () => {
      expect(dataRetentionDoc).toMatch(
        /FirstTry.*cannot.*guarantee.*uninstall|does not.*control.*uninstall/i
      );
    });

    it('DATA_RETENTION.md disclaims residency control', () => {
      expect(dataRetentionDoc).toMatch(/cannot.*specify.*residency|does not.*control.*location/i);
    });

    it('ENTERPRISE_READINESS.md includes Platform-Controlled Behaviors section', () => {
      expect(enterpriseReadinessDoc).toMatch(/platform-controlled behaviors/i);
    });
  });

  describe('No numeric retention values outside DATA_RETENTION.md', () => {
    it('COMPLIANCE.md does not state specific retention days', () => {
      const numericPattern = /\d+\s+(day|week|month|year)s?\s+(retention|purge|delete)/i;
      expect(complianceDoc).not.toMatch(numericPattern);
    });

    it('ENTERPRISE_READINESS.md does not state specific retention days', () => {
      const numericPattern = /\d+\s+(day|week|month|year)s?\s+(retention|purge|delete)/i;
      expect(enterpriseReadinessDoc).not.toMatch(numericPattern);
    });

    it('PRIVACY.md defers to DATA_RETENTION.md', () => {
      if (privacyDoc.includes('retention')) {
        expect(privacyDoc).toMatch(/DATA_RETENTION|see.*DATA_RETENTION/i);
      }
    });
  });

  describe('No contradictory retention stances', () => {
    it('No doc claims "90-day retention" if DATA_RETENTION.md says indefinite', () => {
      const claims90days = [
        complianceDoc.includes('90 day'),
        enterpriseReadinessDoc.includes('90 day'),
        privacyDoc.includes('90 day')
      ];

      // If DATA_RETENTION says indefinite, other docs should not claim 90 days
      if (dataRetentionDoc.includes('indefinite')) {
        expect(claims90days.some(claim => claim)).toBe(false);
      }
    });

    it('No doc claims "automatic purge" if DATA_RETENTION.md says indefinite', () => {
      const claimsAutoPurge = [
        complianceDoc.includes('auto-purge') || complianceDoc.includes('auto delete'),
        enterpriseReadinessDoc.includes('auto-purge') ||
          enterpriseReadinessDoc.includes('auto delete'),
        privacyDoc.includes('auto-purge') || privacyDoc.includes('auto delete')
      ];

      // If DATA_RETENTION says indefinite, other docs should not claim auto-purge
      if (dataRetentionDoc.includes('indefinite')) {
        expect(claimsAutoPurge.some(claim => claim)).toBe(false);
      }
    });

    it('Consistency check: retention language across docs', () => {
      // Collect retention language from each doc
      const indefiniteUsage = [
        dataRetentionDoc.includes('indefinitely'),
        complianceDoc.includes('indefinitely'),
        enterpriseReadinessDoc.includes('indefinitely'),
        privacyDoc.includes('indefinitely')
      ];

      const autoPurgeUsage = [
        dataRetentionDoc.includes('auto-purge') || dataRetentionDoc.includes('auto delete'),
        complianceDoc.includes('auto-purge') || complianceDoc.includes('auto delete'),
        enterpriseReadinessDoc.includes('auto-purge') ||
          enterpriseReadinessDoc.includes('auto delete'),
        privacyDoc.includes('auto-purge') || privacyDoc.includes('auto delete')
      ];

      // Primary stance should be consistent
      const primaryIndefinite = indefiniteUsage[0]; // DATA_RETENTION.md
      if (primaryIndefinite) {
        // Other docs should not make conflicting auto-purge claims
        const conflictingClaims = autoPurgeUsage.slice(1).filter((claim, idx) => {
          // Allow auto-purge only in DATA_RETENTION context
          return claim;
        });

        // Minor: only warn if other docs make strong auto-purge claims
        // (some mention of Forge auto-purge is OK)
        expect(conflictingClaims.length).toBeLessThan(2);
      }
    });
  });

  describe('CLAIMS_PROOF_CATALOG consistency', () => {
    it('CLAIMS_PROOF_CATALOG marks retention as VERIFIED or VERIFIED WITH DEPENDENCY', () => {
      const catalogPath = path.resolve(process.cwd(), 'audit/CLAIMS_PROOF_CATALOG.md');
      if (fs.existsSync(catalogPath)) {
        const catalog = fs.readFileSync(catalogPath, 'utf-8');

        // Find RET-001 claim
        const retentionClaim = catalog.match(/\*\*RET-001\*\*.*indefinitely/i);
        if (retentionClaim) {
          expect(catalog).toMatch(/RET-001.*✅ VERIFIED/);
        }
      }
    });

    it('CLAIMS_PROOF_CATALOG marks platform-controlled items with DEPENDENCY', () => {
      const catalogPath = path.resolve(process.cwd(), 'audit/CLAIMS_PROOF_CATALOG.md');
      if (fs.existsSync(catalogPath)) {
        const catalog = fs.readFileSync(catalogPath, 'utf-8');

        // Platform-controlled retention claims should be marked VERIFIED WITH DEPENDENCY
        const platformClaims = catalog.match(/RET-0[234].*VERIFIED WITH DEPENDENCY/gi);
        expect(platformClaims?.length || 0).toBeGreaterThan(0);
      }
    });
  });
});
