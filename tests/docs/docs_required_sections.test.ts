/**
 * docs_required_sections.test.ts
 * 
 * CI Gate: Enforce all required documentation exists with required sections.
 * 
 * Fails the build if:
 * - Required doc files are missing
 * - Required sections are missing from docs
 * - Headings are incorrectly formatted
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Define required documentation
const REQUIRED_DOCS = {
  'docs/PRIVACY.md': [
    '# Privacy Policy',
    '## Data We Collect',
    '## Data We Do NOT Collect',
    '## Data Retention',
    '## External Sharing',
    '## Consent Model',
    '## Evidence'
  ],
  'docs/SECURITY.md': [
    '# Security',
    '## Threat Model',
    '## Vulnerability Disclosure',
    '## Evidence'
  ],
  'docs/DATA_RETENTION.md': [
    '# Data Retention Policy',
    '## Retention Schedule',
    '## Data Deletion',
    '## Evidence'
  ],
  'docs/DATA_INVENTORY.md': [
    '# Data Inventory',
    '## Data Categories',
    '## Workspace Isolation',
    '## Evidence'
  ],
  'docs/ACCESS_CONTROL.md': [
    '# Access Control',
    '## Authentication Model',
    '## User-Level Access',
    '## Tenant Isolation',
    '## Evidence'
  ],
  'docs/TERMS.md': [
    '# Terms of Service',
    '## Warranty Disclaimer',
    '## Liability Limitation',
    '## Support Boundaries'
  ],
  'docs/SUBPROCESSORS.md': [
    '# Subprocessors',
    '## Third-Party Services'
  ],
  'docs/CHANGELOG_POLICY.md': [
    '# Changelog Policy',
    '## Versioning Scheme',
    '## Breaking Changes'
  ],
  'docs/COMPLIANCE.md': [
    '# Compliance Statement',
    '## What FirstTry IS',
    '## What FirstTry IS NOT',
    '## Evidence'
  ],
  'docs/INCIDENT_RESPONSE.md': [
    '# Incident Response',
    '## Detection',
    '## Triage',
    '## Containment',
    '## Notification'
  ],
  'docs/ENTERPRISE_READINESS.md': [
    '# Enterprise Readiness',
    '## What We Guarantee',
    '## What We Do NOT Guarantee',
    '## Known Limitations'
  ],
  'docs/SUPPORT.md': [
    '# Support',
    '## Support Channels',
    '## Response Times'
  ]
};

const REQUIRED_AUDIT_DOCS = {
  'audit/MARKETPLACE_COMPLIANCE_MATRIX.md': [
    '# Marketplace Compliance Matrix',
    '## Matrix Overview',
    '## Summary'
  ],
  'audit/ENTERPRISE_TRUST_MATRIX.md': [
    '# Enterprise Trust Matrix',
    '## Executive Summary',
    '## Trust Assessment Summary'
  ],
  'audit/CLAIMS_PROOF_CATALOG.md': [
    '# Claims Proof Catalog',
    '## How to Use This Catalog',
    '## Summary'
  ]
};

describe('Documentation Requirements', () => {
  describe('Required doc files exist', () => {
    Object.keys(REQUIRED_DOCS).forEach(docPath => {
      it(`${docPath} exists`, () => {
        const fullPath = path.resolve(process.cwd(), docPath);
        expect(fs.existsSync(fullPath)).toBe(true);
      });
    });
  });

  describe('Required audit doc files exist', () => {
    Object.keys(REQUIRED_AUDIT_DOCS).forEach(docPath => {
      it(`${docPath} exists`, () => {
        const fullPath = path.resolve(process.cwd(), docPath);
        expect(fs.existsSync(fullPath)).toBe(true);
      });
    });
  });

  describe('Required sections in Privacy.md', () => {
    const docPath = path.resolve(process.cwd(), 'docs/PRIVACY.md');
    let content: string;

    try {
      content = fs.readFileSync(docPath, 'utf-8');
    } catch (e) {
      // File will be checked in earlier test
      content = '';
    }

    REQUIRED_DOCS['docs/PRIVACY.md'].forEach(section => {
      it(`contains "${section}"`, () => {
        expect(content.includes(section)).toBe(true);
      });
    });
  });

  describe('Required sections in SECURITY.md', () => {
    const docPath = path.resolve(process.cwd(), 'docs/SECURITY.md');
    let content: string;

    try {
      content = fs.readFileSync(docPath, 'utf-8');
    } catch (e) {
      content = '';
    }

    REQUIRED_DOCS['docs/SECURITY.md'].forEach(section => {
      it(`contains "${section}"`, () => {
        expect(content.includes(section)).toBe(true);
      });
    });
  });

  describe('Required sections in DATA_RETENTION.md', () => {
    const docPath = path.resolve(process.cwd(), 'docs/DATA_RETENTION.md');
    let content: string;

    try {
      content = fs.readFileSync(docPath, 'utf-8');
    } catch (e) {
      content = '';
    }

    REQUIRED_DOCS['docs/DATA_RETENTION.md'].forEach(section => {
      it(`contains "${section}"`, () => {
        expect(content.includes(section)).toBe(true);
      });
    });
  });

  describe('Required sections in DATA_INVENTORY.md', () => {
    const docPath = path.resolve(process.cwd(), 'docs/DATA_INVENTORY.md');
    let content: string;

    try {
      content = fs.readFileSync(docPath, 'utf-8');
    } catch (e) {
      content = '';
    }

    REQUIRED_DOCS['docs/DATA_INVENTORY.md'].forEach(section => {
      it(`contains "${section}"`, () => {
        expect(content.includes(section)).toBe(true);
      });
    });
  });

  describe('Required sections in ACCESS_CONTROL.md', () => {
    const docPath = path.resolve(process.cwd(), 'docs/ACCESS_CONTROL.md');
    let content: string;

    try {
      content = fs.readFileSync(docPath, 'utf-8');
    } catch (e) {
      content = '';
    }

    REQUIRED_DOCS['docs/ACCESS_CONTROL.md'].forEach(section => {
      it(`contains "${section}"`, () => {
        expect(content.includes(section)).toBe(true);
      });
    });
  });

  describe('Required sections in COMPLIANCE.md', () => {
    const docPath = path.resolve(process.cwd(), 'docs/COMPLIANCE.md');
    let content: string;

    try {
      content = fs.readFileSync(docPath, 'utf-8');
    } catch (e) {
      content = '';
    }

    REQUIRED_DOCS['docs/COMPLIANCE.md'].forEach(section => {
      it(`contains "${section}"`, () => {
        expect(content.includes(section)).toBe(true);
      });
    });
  });

  describe('Required sections in ENTERPRISE_READINESS.md', () => {
    const docPath = path.resolve(process.cwd(), 'docs/ENTERPRISE_READINESS.md');
    let content: string;

    try {
      content = fs.readFileSync(docPath, 'utf-8');
    } catch (e) {
      content = '';
    }

    REQUIRED_DOCS['docs/ENTERPRISE_READINESS.md'].forEach(section => {
      it(`contains "${section}"`, () => {
        expect(content.includes(section)).toBe(true);
      });
    });
  });

  describe('Audit doc sections', () => {
    Object.entries(REQUIRED_AUDIT_DOCS).forEach(([docPath, sections]) => {
      describe(`${docPath}`, () => {
        let content: string;

        try {
          content = fs.readFileSync(path.resolve(process.cwd(), docPath), 'utf-8');
        } catch (e) {
          content = '';
        }

        sections.forEach(section => {
          it(`contains "${section}"`, () => {
            expect(content.includes(section)).toBe(true);
          });
        });
      });
    });
  });

  describe('Documentation format validation', () => {
    it('All docs start with title heading', () => {
      const docsToCheck = [
        'docs/PRIVACY.md',
        'docs/SECURITY.md',
        'docs/DATA_RETENTION.md',
        'docs/DATA_INVENTORY.md'
      ];

      docsToCheck.forEach(docPath => {
        const fullPath = path.resolve(process.cwd(), docPath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const firstLine = content.split('\n')[0];
          expect(firstLine.startsWith('#')).toBe(true);
        }
      });
    });

    it('No loose "UNKNOWN" claims without context', () => {
      const docsToCheck = [
        'docs/PRIVACY.md',
        'docs/SECURITY.md',
        'docs/DATA_RETENTION.md'
      ];

      docsToCheck.forEach(docPath => {
        const fullPath = path.resolve(process.cwd(), docPath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');
          
          lines.forEach((line, index) => {
            if (line.includes('UNKNOWN')) {
              // UNKNOWN should be in context (surrounded by explanation)
              expect(line.length).toBeGreaterThan(10); // Not just "UNKNOWN"
            }
          });
        }
      });
    });
  });
});

describe('Audit Documentation Requirements', () => {
  it('MARKETPLACE_COMPLIANCE_MATRIX.md has status matrix', () => {
    const docPath = path.resolve(process.cwd(), 'audit/MARKETPLACE_COMPLIANCE_MATRIX.md');
    if (fs.existsSync(docPath)) {
      const content = fs.readFileSync(docPath, 'utf-8');
      expect(content.includes('PASS') || content.includes('FAIL')).toBe(true);
      expect(content.includes('Summary')).toBe(true);
    }
  });

  it('ENTERPRISE_TRUST_MATRIX.md has dimension breakdown', () => {
    const docPath = path.resolve(process.cwd(), 'audit/ENTERPRISE_TRUST_MATRIX.md');
    if (fs.existsSync(docPath)) {
      const content = fs.readFileSync(docPath, 'utf-8');
      expect(content.includes('Privacy')).toBe(true);
      expect(content.includes('Security')).toBe(true);
      expect(content.includes('Governance')).toBe(true);
    }
  });

  it('CLAIMS_PROOF_CATALOG.md has claim mapping', () => {
    const docPath = path.resolve(process.cwd(), 'audit/CLAIMS_PROOF_CATALOG.md');
    if (fs.existsSync(docPath)) {
      const content = fs.readFileSync(docPath, 'utf-8');
      expect(content.includes('Claim ID')).toBe(true);
      expect(content.includes('VERIFIED')).toBe(true);
    }
  });
});
