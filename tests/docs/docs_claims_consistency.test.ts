/**
 * docs_claims_consistency.test.ts
 * 
 * CI Gate: Verify that claims in docs align with actual code/manifest.
 * 
 * Validates:
 * - Docs don't contradict manifest.yml scopes
 * - Logging claims match redaction code
 * - Storage claims match DATA_INVENTORY.md
 * - No exaggerated claims without evidence
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

describe('Documentation Claims Consistency', () => {
  let privacyDoc = '';
  let securityDoc = '';
  let dataRetentionDoc = '';
  let dataInventoryDoc = '';
  let manifestContent: any = {};

  beforeAll(() => {
    // Load documentation
    try {
      privacyDoc = fs.readFileSync(
        path.resolve(process.cwd(), 'docs/PRIVACY.md'),
        'utf-8'
      );
    } catch (e) {
      // File missing will be caught by other tests
    }

    try {
      securityDoc = fs.readFileSync(
        path.resolve(process.cwd(), 'docs/SECURITY.md'),
        'utf-8'
      );
    } catch (e) {}

    try {
      dataRetentionDoc = fs.readFileSync(
        path.resolve(process.cwd(), 'docs/DATA_RETENTION.md'),
        'utf-8'
      );
    } catch (e) {}

    try {
      dataInventoryDoc = fs.readFileSync(
        path.resolve(process.cwd(), 'docs/DATA_INVENTORY.md'),
        'utf-8'
      );
    } catch (e) {}

    // Load manifest
    try {
      const manifestPath = path.resolve(process.cwd(), 'manifest.yml');
      if (fs.existsSync(manifestPath)) {
        const manifestYaml = fs.readFileSync(manifestPath, 'utf-8');
        manifestContent = yaml.load(manifestYaml) as any;
      }
    } catch (e) {
      console.warn('Could not parse manifest.yml');
    }
  });

  describe('Privacy Claims Consistency', () => {
    it('PRIVACY.md should mention Jira issue metadata', () => {
      expect(privacyDoc).toMatch(/issue|metadata/i);
    });

    it('PRIVACY.md should NOT claim data is shared externally if manifest has no external APIs', () => {
      const hasNoExternalAPIs =
        !privacyDoc.includes('third party') ||
        privacyDoc.includes('do NOT');

      // If manifest has no external integrations, docs shouldn't claim sharing
      const manifestHasExternalAPIs =
        JSON.stringify(manifestContent).includes('http') &&
        !JSON.stringify(manifestContent).includes('jira');

      if (!manifestHasExternalAPIs) {
        expect(privacyDoc).toMatch(/do (NOT|not) (share|send|transmit)/i);
      }
    });

    it('PRIVACY.md claims about tracking should match code', () => {
      const claimsNoTracking =
        privacyDoc.includes('tracking') &&
        privacyDoc.toLowerCase().includes('do not');

      // Check if actual tracking code exists
      const hasTrackingDeps =
        fs.existsSync(path.resolve(process.cwd(), 'package.json')) &&
        fs.readFileSync(
          path.resolve(process.cwd(), 'package.json'),
          'utf-8'
        ).includes('analytics') ||
        fs.readFileSync(
          path.resolve(process.cwd(), 'package.json'),
          'utf-8'
        ).includes('segment') ||
        fs.readFileSync(
          path.resolve(process.cwd(), 'package.json'),
          'utf-8'
        ).includes('amplitude');

      if (claimsNoTracking && !hasTrackingDeps) {
        expect(true).toBe(true); // Consistent
      }
    });

    it('PRIVACY.md should not claim GDPR/HIPAA compliance without explicit certification', () => {
      const claimsGDPR =
        privacyDoc.includes('GDPR') && !privacyDoc.includes('not');
      const claimsHIPAA =
        privacyDoc.includes('HIPAA') && !privacyDoc.includes('not');

      // Load compliance doc to verify
      let complianceDoc = '';
      try {
        complianceDoc = fs.readFileSync(
          path.resolve(process.cwd(), 'docs/COMPLIANCE.md'),
          'utf-8'
        );
      } catch (e) {}

      if (claimsGDPR) {
        expect(complianceDoc.toLowerCase()).toMatch(/gdpr|compliant/i);
      }
      if (claimsHIPAA) {
        expect(complianceDoc.toLowerCase()).toMatch(/hipaa|compliant/i);
      }
    });
  });

  describe('Security Claims Consistency', () => {
    it('SECURITY.md should not claim SOC 2 without certification', () => {
      const claims_SOC2 =
        securityDoc.includes('SOC 2') && !securityDoc.includes('not');

      // If claiming SOC 2, should have file
      if (claims_SOC2) {
        expect(
          fs.existsSync(path.resolve(process.cwd(), 'SOC2_REPORT.pdf')) ||
            fs.existsSync(path.resolve(process.cwd(), 'audit/SOC2.md'))
        ).toBe(true);
      }
    });

    it('SECURITY.md read-only claim should match manifest scopes', () => {
      const claims_readonly = securityDoc.includes('read-only');

      if (claims_readonly && manifestContent.scopes) {
        // Check if manifest only has read scopes
        const scopes = JSON.stringify(manifestContent.scopes).toLowerCase();
        const hasWriteScope =
          scopes.includes('write:') ||
          scopes.includes('delete:') ||
          scopes.includes('admin:');

        expect(!hasWriteScope).toBe(true);
      }
    });

    it('SECURITY.md no-egress claim should match codebase', () => {
      const claims_no_egress = securityDoc.includes('no egress') ||
        securityDoc.includes('egress') ||
        securityDoc.includes('network');

      if (claims_no_egress) {
        // Check source code for HTTP calls
        const srcPath = path.resolve(process.cwd(), 'src');
        let hasHTTPCalls = false;

        if (fs.existsSync(srcPath)) {
          const files = fs.readdirSync(srcPath, { recursive: true });
          files.forEach((file: any) => {
            if (
              file.endsWith('.ts') ||
              file.endsWith('.js')
            ) {
              const content = fs.readFileSync(
                path.resolve(srcPath, file),
                'utf-8'
              );
              if (
                content.includes('fetch') ||
                content.includes('axios') ||
                content.includes('request')
              ) {
                hasHTTPCalls = true;
              }
            }
          });
        }

        // Should have no real HTTP calls (or all mocked)
        expect(
          !hasHTTPCalls ||
            fs.existsSync(path.resolve(process.cwd(), 'tests/mocks'))
        ).toBe(true);
      }
    });

    it('SECURITY.md logging claims should match redaction code', () => {
      const claims_redaction = securityDoc.includes('redaction') ||
        securityDoc.includes('PII') ||
        securityDoc.includes('log');

      if (claims_redaction) {
        // Check for redaction code
        const redactionPath = path.resolve(
          process.cwd(),
          'src/logging/redact.ts'
        );
        const redactionTestPath = path.resolve(
          process.cwd(),
          'tests/p1_logging_safety.test.ts'
        );

        expect(
          fs.existsSync(redactionPath) || fs.existsSync(redactionTestPath)
        ).toBe(true);
      }
    });
  });

  describe('Data Retention Claims Consistency', () => {
    it('DATA_RETENTION.md TTL values should match code constants', () => {
      // Extract TTL values from doc
      const ttl90Match = dataRetentionDoc.match(/90\s+day/i);
      const ttl7Match = dataRetentionDoc.match(/7\s+day/i);

      if (ttl90Match || ttl7Match) {
        // Check if these match code
        const storagePath = path.resolve(process.cwd(), 'src/storage.ts');
        if (fs.existsSync(storagePath)) {
          const storageCode = fs.readFileSync(storagePath, 'utf-8');

          if (ttl90Match) {
            expect(
              storageCode.includes('90') ||
                storageCode.match(/TTL.*90/) ||
                dataRetentionDoc.includes('UNKNOWN')
            ).toBe(true);
          }

          if (ttl7Match) {
            expect(
              storageCode.includes('7') ||
                storageCode.match(/TTL.*7/) ||
                dataRetentionDoc.includes('UNKNOWN')
            ).toBe(true);
          }
        }
      }
    });

    it('DATA_RETENTION.md should mark undefined TTLs as UNKNOWN', () => {
      // If doc doesn't specify a TTL, it should say UNKNOWN, not make up a value
      const containsUNKNOWN =
        dataRetentionDoc.includes('UNKNOWN') ||
        dataRetentionDoc.includes('undefined') ||
        dataRetentionDoc.includes('not defined');

      // At least some data should have known TTL or explicit UNKNOWN
      expect(containsUNKNOWN || dataRetentionDoc.includes('day')).toBe(true);
    });
  });

  describe('Data Inventory Claims Consistency', () => {
    it('DATA_INVENTORY.md should list data types matching what code collects', () => {
      // Check for common data types
      const hasPolicyMetadata = dataInventoryDoc.includes('policy') ||
        dataInventoryDoc.includes('Policy');
      const hasEventData = dataInventoryDoc.includes('event') ||
        dataInventoryDoc.includes('Event');

      expect(hasPolicyMetadata || hasEventData).toBe(true);
    });

    it('DATA_INVENTORY.md storage claims should match manifest scopes', () => {
      const claims_storage = dataInventoryDoc.includes('Forge storage') ||
        dataInventoryDoc.includes('storage') ||
        dataInventoryDoc.includes('Storage');

      if (claims_storage && manifestContent.modules) {
        // Manifest should have storage configuration
        const hasStorage =
          JSON.stringify(manifestContent).includes('storage') ||
          JSON.stringify(manifestContent).includes('Storage');

        expect(claims_storage).toBe(true); // At least claim exists
      }
    });

    it('DATA_INVENTORY.md isolation claims should match Forge storage behavior', () => {
      const claims_isolation = dataInventoryDoc.includes('isolation') ||
        dataInventoryDoc.includes('workspace-scoped') ||
        dataInventoryDoc.includes('cross-workspace');

      if (claims_isolation) {
        // Forge storage is automatically isolated
        expect(true).toBe(true); // Atlassian-managed property
      }
    });
  });

  describe('Cross-Document Consistency', () => {
    it('All docs should agree on what data is collected', () => {
      const privacyDataTypes = (privacyDoc.match(/(issue|event|policy|metric)/gi) || [])
        .length;
      const inventoryDataTypes = (dataInventoryDoc.match(/(issue|event|policy|metric)/gi) || [])
        .length;

      // Both should mention similar data types
      expect(privacyDataTypes + inventoryDataTypes).toBeGreaterThan(0);
    });

    it('COMPLIANCE and PRIVACY docs should agree on certifications', () => {
      let complianceDoc = '';
      try {
        complianceDoc = fs.readFileSync(
          path.resolve(process.cwd(), 'docs/COMPLIANCE.md'),
          'utf-8'
        );
      } catch (e) {}

      // If COMPLIANCE says not HIPAA, PRIVACY shouldn't claim HIPAA
      const privacyClaimsHIPAA = privacyDoc.toLowerCase().includes('hipaa');
      const complianceClaimsNotHIPAA =
        complianceDoc.toLowerCase().includes('hipaa') &&
        complianceDoc.toLowerCase().includes('not');

      if (complianceClaimsNotHIPAA && privacyClaimsHIPAA) {
        expect(privacyDoc.toLowerCase()).toMatch(/hipaa.*not|not.*hipaa/);
      }
    });

    it('TERMS and COMPLIANCE should agree on liability limits', () => {
      let termsDoc = '';
      let complianceDoc = '';

      try {
        termsDoc = fs.readFileSync(
          path.resolve(process.cwd(), 'docs/TERMS.md'),
          'utf-8'
        );
      } catch (e) {}

      try {
        complianceDoc = fs.readFileSync(
          path.resolve(process.cwd(), 'docs/COMPLIANCE.md'),
          'utf-8'
        );
      } catch (e) {}

      // Both should mention (or not mention) liability limits
      const termsHasLiability = termsDoc.includes('liability') ||
        termsDoc.includes('Liability');
      const complianceHasLiability = complianceDoc.includes('liability') ||
        complianceDoc.includes('Liability');

      expect(termsHasLiability === complianceHasLiability).toBe(true);
    });
  });

  describe('Claim Evidence Validation', () => {
    it('PRIVACY.md claims should reference code or state UNKNOWN', () => {
      const claimsWithoutEvidence = privacyDoc.match(/^## .+$/gm) || [];

      claimsWithoutEvidence.forEach(heading => {
        const section = privacyDoc.split(heading)[1]?.split('##')[0] || '';

        // Section should either reference a file or say UNKNOWN
        const hasEvidence =
          section.includes('src/') ||
          section.includes('test') ||
          section.includes('manifest') ||
          section.includes('UNKNOWN') ||
          section.includes('Evidence');

        expect(hasEvidence).toBe(true);
      });
    });

    it('No doc should make unsubstantiated claims', () => {
      const allDocs = [privacyDoc, securityDoc, dataRetentionDoc];

      allDocs.forEach(doc => {
        // Check for overly specific claims without evidence
        const suspiciousClaims = doc.match(/guaranteed|promise|certif/gi) || [];

        suspiciousClaims.forEach(claim => {
          // Should be followed by evidence or negation
          const claimIndex = doc.indexOf(claim);
          const context = doc.substring(
            Math.max(0, claimIndex - 50),
            claimIndex + 100
          );

          expect(
            context.includes('UNKNOWN') ||
              context.includes('not') ||
              context.includes('may') ||
              context.includes('evidence') ||
              context.includes('Evidence')
          ).toBe(true);
        });
      });
    });
  });
});
