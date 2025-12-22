/**
 * GAP-7: SUPPORT & INCIDENT REALITY PROOF
 *
 * CONTRACT RULES:
 * - NO product features
 * - src/** is READ-ONLY
 * - Tests only
 * - PASS = support docs exist with no fake claims
 * - FAIL = fake emails, over-claims, or missing docs
 * - UNKNOWN = contacts cannot be verified
 *
 * FORBIDDEN:
 * - @atlassian.com emails (claiming to be Atlassian support)
 * - Fake SLAs, uptime promises, certifications
 * - Generic example@company.com placeholders
 *
 * ALLOWED:
 * - UNKNOWN for unverifiable information
 * - Bounded, truthful descriptions
 * - Platform-delegated responses
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const WORKSPACE_ROOT = path.resolve(__dirname, '../../');
const DOCS_ROOT = path.join(WORKSPACE_ROOT, 'docs');
const AUDIT_DIR = path.join(WORKSPACE_ROOT, '../../audit/credibility_reports');

if (!fs.existsSync(AUDIT_DIR)) {
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
}

interface EvidenceRecord {
  runId: number;
  gapId: string;
  testId: string;
  status: 'PASS' | 'FAIL' | 'UNKNOWN';
  reason?: string;
  evidence: {
    filePath?: string;
    reproCommand?: string;
    assertion?: string;
    details?: Record<string, any>;
  };
  timestamp: string;
}

function emitEvidence(record: EvidenceRecord) {
  const jsonlPath = path.join(AUDIT_DIR, 'GAP7_SUPPORT_REALITY.jsonl');
  fs.appendFileSync(jsonlPath, JSON.stringify(record) + '\n');
}

describe('GAP-7: Support & Incident Reality Proof', () => {
  it('GAP7_SUPPORT_DOC_EXISTS: Verify SUPPORT.md exists', () => {
    const supportDoc = path.join(DOCS_ROOT, 'SUPPORT.md');
    const exists = fs.existsSync(supportDoc);

    emitEvidence({
      runId: 0,
      gapId: 'GAP_7',
      testId: 'GAP7_SUPPORT_DOC_EXISTS',
      status: exists ? 'PASS' : 'FAIL',
      reason: exists ? 'docs/SUPPORT.md exists' : 'docs/SUPPORT.md missing',
      evidence: {
        filePath: 'docs/SUPPORT.md',
        reproCommand: 'ls -la docs/SUPPORT.md',
        assertion: 'SUPPORT.md must exist and document support channels',
      },
      timestamp: new Date().toISOString(),
    });

    expect(exists).toBe(true);
  });

  it('GAP7_SUPPORT_NO_FAKE_EMAILS: Verify no @atlassian.com or example.com emails', () => {
    const supportDoc = path.join(DOCS_ROOT, 'SUPPORT.md');

    if (!fs.existsSync(supportDoc)) {
      expect(fs.existsSync(supportDoc)).toBe(true);
      return;
    }

    const content = fs.readFileSync(supportDoc, 'utf-8');

    const forbiddenPatterns = [
      { name: '@atlassian.com (fake Atlassian support)', regex: /@atlassian\.com/i },
      { name: 'example.com (generic placeholder)', regex: /example\.com/i },
      { name: 'test@test.com (fake email)', regex: /test@test\.com/i },
      { name: 'support@yourcompany.com (placeholder)', regex: /yourcompany\.com/i },
    ];

    const violations: Array<{ pattern: string; match: RegExpMatchArray | null }> = [];

    for (const pattern of forbiddenPatterns) {
      const match = content.match(pattern.regex);
      if (match) {
        violations.push({ pattern: pattern.name, match });
      }
    }

    const status = violations.length === 0 ? 'PASS' : 'FAIL';
    const reason =
      violations.length === 0
        ? 'No fake emails or placeholders found'
        : `Found ${violations.length} fake email patterns: ${violations.map((v) => v.pattern).join(', ')}`;

    emitEvidence({
      runId: 0,
      gapId: 'GAP_7',
      testId: 'GAP7_SUPPORT_NO_FAKE_EMAILS',
      status,
      reason,
      evidence: {
        filePath: 'docs/SUPPORT.md',
        reproCommand: 'grep "@atlassian.com\\|example.com" docs/SUPPORT.md',
        assertion: 'SUPPORT.md must not contain fake Atlassian emails or placeholder addresses',
        details: { violations },
      },
      timestamp: new Date().toISOString(),
    });

    expect(violations).toHaveLength(0);
  });

  it('GAP7_SUPPORT_NO_OVERCLAIMS: Verify no SLA or certification claims', () => {
    const supportDoc = path.join(DOCS_ROOT, 'SUPPORT.md');

    if (!fs.existsSync(supportDoc)) {
      expect(fs.existsSync(supportDoc)).toBe(true);
      return;
    }

    const content = fs.readFileSync(supportDoc, 'utf-8');

    // Check each forbidden pattern - but allow NO SLA disclaimers
    const forbiddenClaims = [
      { name: 'SLA guarantee/promise', regex: /\bSLA\b.*guarantee|\bSLA\b.*promise|guaranteed.*\bSLA\b/i },
      { name: '99.9% uptime guarantee', regex: /99\.9%.*uptime.*guarantee|uptime.*guarantee.*99\.9%/i },
      { name: 'SOC2 certification claim', regex: /SOC\s?2\s+certified|SOC\s?2\s+compliant/i },
      { name: 'ISO certification claim', regex: /ISO\s?\d{4,5}\s+certified/i },
      { name: 'Cloud Fortified claim', regex: /cloud fortified/i },
    ];

    const overclaims: Array<{ claim: string; found: boolean }> = [];

    for (const claim of forbiddenClaims) {
      if (claim.regex.test(content)) {
        // Found a potential overclaim, but check if it's in a disclaimer context
        const lines = content.split('\n');
        for (const line of lines) {
          if (claim.regex.test(line) && !/(no|without|does not provide).*\bSLA\b|\bSLA\b.*(no|without|none)/i.test(line)) {
            overclaims.push({ claim: claim.name, found: true });
            break;
          }
        }
      }
    }

    const status = overclaims.length === 0 ? 'PASS' : 'FAIL';
    const reason =
      overclaims.length === 0
        ? 'No unsupported SLA or certification claims found'
        : `Found ${overclaims.length} overclaims: ${overclaims.map((c) => c.claim).join(', ')}`;

    emitEvidence({
      runId: 0,
      gapId: 'GAP_7',
      testId: 'GAP7_SUPPORT_NO_OVERCLAIMS',
      status,
      reason,
      evidence: {
        filePath: 'docs/SUPPORT.md',
        reproCommand: 'grep -i "SLA\\|SOC2\\|ISO\\|uptime" docs/SUPPORT.md',
        assertion: 'SUPPORT.md must not make unverifiable SLA or certification claims',
        details: { overclaims },
      },
      timestamp: new Date().toISOString(),
    });

    expect(overclaims).toHaveLength(0);
  });

  it('GAP7_INCIDENT_RESPONSE_DOC_EXISTS: Verify INCIDENT_RESPONSE.md exists', () => {
    const incidentDoc = path.join(DOCS_ROOT, 'INCIDENT_RESPONSE.md');
    const exists = fs.existsSync(incidentDoc);

    emitEvidence({
      runId: 0,
      gapId: 'GAP_7',
      testId: 'GAP7_INCIDENT_RESPONSE_DOC_EXISTS',
      status: exists ? 'PASS' : 'FAIL',
      reason: exists ? 'docs/INCIDENT_RESPONSE.md exists' : 'docs/INCIDENT_RESPONSE.md missing',
      evidence: {
        filePath: 'docs/INCIDENT_RESPONSE.md',
        reproCommand: 'ls -la docs/INCIDENT_RESPONSE.md',
        assertion: 'INCIDENT_RESPONSE.md must exist and document incident handling',
      },
      timestamp: new Date().toISOString(),
    });

    expect(exists).toBe(true);
  });

  it('GAP7_DATA_RETENTION_DOC_EXISTS: Verify DATA_RETENTION.md exists', () => {
    const retentionDoc = path.join(DOCS_ROOT, 'DATA_RETENTION.md');
    const exists = fs.existsSync(retentionDoc);

    emitEvidence({
      runId: 0,
      gapId: 'GAP_7',
      testId: 'GAP7_DATA_RETENTION_DOC_EXISTS',
      status: exists ? 'PASS' : 'FAIL',
      reason: exists ? 'docs/DATA_RETENTION.md exists' : 'docs/DATA_RETENTION.md missing',
      evidence: {
        filePath: 'docs/DATA_RETENTION.md',
        reproCommand: 'ls -la docs/DATA_RETENTION.md',
        assertion: 'DATA_RETENTION.md must exist and document retention policies',
      },
      timestamp: new Date().toISOString(),
    });

    expect(exists).toBe(true);
  });

  it('GAP7_DOCUMENTATION_COMPLETENESS: Verify all required docs exist', () => {
    const requiredDocs = [
      'SUPPORT.md',
      'INCIDENT_RESPONSE.md',
      'DATA_RETENTION.md',
      'SECURITY.md',
      'PLATFORM_DEPENDENCIES.md',
      'EXTERNAL_APIS.md',
    ];

    const missingDocs: string[] = [];

    for (const doc of requiredDocs) {
      const docPath = path.join(DOCS_ROOT, doc);
      if (!fs.existsSync(docPath)) {
        missingDocs.push(doc);
      }
    }

    const status = missingDocs.length === 0 ? 'PASS' : 'FAIL';
    const reason =
      missingDocs.length === 0
        ? 'All required compliance docs exist'
        : `Missing docs: ${missingDocs.join(', ')}`;

    emitEvidence({
      runId: 0,
      gapId: 'GAP_7',
      testId: 'GAP7_DOCUMENTATION_COMPLETENESS',
      status,
      reason,
      evidence: {
        filePath: 'docs/',
        reproCommand: 'ls -la docs/',
        assertion: 'All GAP-7 required documentation must exist',
        details: { requiredDocs, missingDocs },
      },
      timestamp: new Date().toISOString(),
    });

    expect(missingDocs).toHaveLength(0);
  });
});
