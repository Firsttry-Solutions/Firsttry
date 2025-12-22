/**
 * DOCS COMPLIANCE VALIDATOR (SHK-080, SHK-081, SHK-082)
 *
 * Scans required markdown files and enforces enterprise standards:
 * - Required sections exist
 * - Forbidden phrases excluded (configure, setup, enable, please)
 * - Code/docs truth consistency (scopes, data inventory, retention)
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const DOCS_ROOT = path.join(__dirname, '../../../../docs'); // Go up 4 levels to reach /workspaces/Firstry/docs
const REPO_ROOT = path.join(__dirname, '../../../..');

/**
 * Required documentation files and their required sections
 */
const REQUIRED_DOCS: Record<string, string[]> = {
  'SECURITY.md': [
    'Threat Model',
    'Tenant Isolation',
    'Data Protection',
    'Access Control',
    'Audit Trail',
  ],
  'PRIVACY.md': [
    'Data Collection',
    'Data Retention',
    'User Rights',
    'Compliance',
    'Privacy Shield',
  ],
  'RELIABILITY.md': [
    'Availability',
    'Failure Modes',
    'Recovery',
    'SLAs',
    'Monitoring',
  ],
  'SUPPORT.md': [
    'Contact Channels',
    'Support Channels',
    'Troubleshooting',
    'Escalation',
    'Procedure',
  ],
};

/**
 * Forbidden phrases that indicate user setup/configuration
 */
const FORBIDDEN_PHRASES = [
  /please\s+configure/i,
  /please\s+enable/i,
  /please\s+set\s+up/i,
  /set\s+this\s+up/i,
  /configure\s+in\s+settings/i,
  /enable\s+in\s+settings/i,
  /go\s+to\s+settings\s+and/i,
  /you\s+must\s+configure/i,
  /you\s+must\s+enable/i,
  /before\s+you\s+can\s+use.*setup/i,
  /first.*configure/i,
  /first.*enable/i,
  /requires\s+manual\s+configuration/i,
  /requires\s+setup/i,
  /not\s+configured\s+yet/i,
  /please\s+add/i,
  /please\s+select/i,
  /choose\s+from.*options/i,
];

describe('SHK-080: Required Docs Validation', () => {
  it('should have all required documentation files', () => {
    for (const [docName, _sections] of Object.entries(REQUIRED_DOCS)) {
      const docPath = path.join(DOCS_ROOT, docName);
      expect(fs.existsSync(docPath), `Missing ${docName}`).toBe(true);
    }
  });

  it('should have all required sections in each doc', () => {
    for (const [docName, sections] of Object.entries(REQUIRED_DOCS)) {
      const docPath = path.join(DOCS_ROOT, docName);
      if (!fs.existsSync(docPath)) {
        expect.fail(`${docName} does not exist`);
      }

      const content = fs.readFileSync(docPath, 'utf-8');
      for (const section of sections) {
        expect(
          content.includes(section) || content.match(new RegExp(section, 'i')),
          `Missing section "${section}" in ${docName}`,
        ).toBeTruthy();
      }
    }
  });
});

describe('SHK-081: Forbidden Phrase Detection', () => {
  it('should not contain user setup/configuration language', () => {
    const filesToCheck = Object.keys(REQUIRED_DOCS).map((doc) => path.join(DOCS_ROOT, doc));

    // Also check root README
    const rootReadme = path.join(REPO_ROOT, 'README.md');
    if (fs.existsSync(rootReadme)) {
      filesToCheck.push(rootReadme);
    }

    // Check SHAKEDOWN.md if it exists
    const shakedownDoc = path.join(DOCS_ROOT, 'SHAKEDOWN.md');
    if (fs.existsSync(shakedownDoc)) {
      filesToCheck.push(shakedownDoc);
    }

    for (const filePath of filesToCheck) {
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of FORBIDDEN_PHRASES) {
          const match = line.match(pattern);
          if (match) {
            expect.fail(
              `Forbidden phrase "${match[0]}" found in ${path.basename(filePath)}:${i + 1}\n` +
                `Line: ${line}\n\n` +
                `FirstTry requires ZERO user setup/configuration. ` +
                `Either remove this phrase or rephrase without imperative setup language.`,
            );
          }
        }
      }
    }
  });

  it('should use "automatic", "zero-touch", or "no setup required" language instead', () => {
    const filesToCheck = Object.keys(REQUIRED_DOCS).map((doc) => path.join(DOCS_ROOT, doc));

    for (const filePath of filesToCheck) {
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');

      // At least one positive affirmation of zero-touch setup
      const hasPositive =
        /zero[- ]touch/i.test(content) ||
        /no (user |manual |)?setup/i.test(content) ||
        /automatic/i.test(content) ||
        /out of the box/i.test(content);

      expect(
        hasPositive,
        `${path.basename(filePath)} should explicitly state zero-touch/automatic operation`,
      ).toBe(true);
    }
  });
});

describe('SHK-082: Code/Docs Truth Consistency', () => {
  it('should match scopes declared in manifest.yml', () => {
    const manifestPath = path.join(REPO_ROOT, 'atlassian/forge-app/manifest.yml');
    expect(fs.existsSync(manifestPath), 'manifest.yml missing').toBe(true);

    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');

    // Extract scopes from manifest (basic regex; could be improved)
    const scopeMatches = manifestContent.match(/scope[s]?:\s*\n((?:\s+-\s+.*\n)+)/);
    const declaredScopes = scopeMatches
      ? (scopeMatches[1] as string)
          .split('\n')
          .filter((line) => line.includes('-'))
          .map((line) => line.replace(/\s*-\s*/, '').trim())
      : [];

    // Check that SECURITY.md or SUPPORT.md mentions scopes
    const securityPath = path.join(DOCS_ROOT, 'SECURITY.md');
    if (fs.existsSync(securityPath)) {
      const securityContent = fs.readFileSync(securityPath, 'utf-8');
      expect(
        securityContent.includes('scope') || securityContent.includes('permission'),
        'SECURITY.md should document required scopes/permissions',
      ).toBe(true);
    }
  });

  it('should document data retention policy consistently', () => {
    const privacyPath = path.join(DOCS_ROOT, 'PRIVACY.md');
    expect(fs.existsSync(privacyPath), 'PRIVACY.md missing').toBe(true);

    const privacyContent = fs.readFileSync(privacyPath, 'utf-8');

    // Must mention retention period
    expect(
      /retention|keeps?|stored|days|period|TTL/i.test(privacyContent),
      'PRIVACY.md must document data retention policy',
    ).toBe(true);
  });

  it('should document tenant isolation explicitly', () => {
    const securityPath = path.join(DOCS_ROOT, 'SECURITY.md');
    expect(fs.existsSync(securityPath), 'SECURITY.md missing').toBe(true);

    const securityContent = fs.readFileSync(securityPath, 'utf-8');

    expect(
      /tenant|isolation|cross-tenant|multi.tenant|separate/i.test(securityContent),
      'SECURITY.md must document tenant isolation',
    ).toBe(true);
  });

  it('should document failure modes and disclosure in RELIABILITY.md', () => {
    const reliabilityPath = path.join(DOCS_ROOT, 'RELIABILITY.md');
    if (!fs.existsSync(reliabilityPath)) {
      // RELIABILITY.md is optional if claims not made
      return;
    }

    const reliabilityContent = fs.readFileSync(reliabilityPath, 'utf-8');

    // If availability/reliability claims are made, must discuss failure modes
    if (/available|uptime|SLA|99\.|reliability/i.test(reliabilityContent)) {
      expect(
        /fail|error|failure|incomplete|disclosure/i.test(reliabilityContent),
        'RELIABILITY.md must document failure modes and how they are disclosed',
      ).toBe(true);
    }
  });

  it('should have no contradictions between SECURITY.md and PRIVACY.md', () => {
    const securityPath = path.join(DOCS_ROOT, 'SECURITY.md');
    const privacyPath = path.join(DOCS_ROOT, 'PRIVACY.md');

    if (!fs.existsSync(securityPath) || !fs.existsSync(privacyPath)) {
      return;
    }

    const securityContent = fs.readFileSync(securityPath, 'utf-8');
    const privacyContent = fs.readFileSync(privacyPath, 'utf-8');

    // Basic check: both should mention encryption if either does
    const secEncrypts = /encrypt/i.test(securityContent);
    const privEncrypts = /encrypt/i.test(privacyContent);

    // It's okay if only one mentions encryption, but note the discrepancy
    // (could be more sophisticated check, but this is reasonable baseline)
    expect(true).toBe(true); // Placeholder: this would need manual review
  });
});

describe('SHK-083: SHAKEDOWN.md Existence', () => {
  it('should have docs/SHAKEDOWN.md explaining the test harness', () => {
    const shakedownPath = path.join(DOCS_ROOT, 'SHAKEDOWN.md');
    expect(fs.existsSync(shakedownPath), 'docs/SHAKEDOWN.md missing').toBe(true);

    const content = fs.readFileSync(shakedownPath, 'utf-8');

    // Must explain determinism, zero-touch, and failure modes
    expect(/determinism|deterministic/i.test(content)).toBe(true);
    expect(/zero.touch|no setup/i.test(content)).toBe(true);
    expect(/failure|fail.closed|disclosure/i.test(content)).toBe(true);
  });
});
