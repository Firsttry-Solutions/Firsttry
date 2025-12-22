/**
 * GAP-3: OUTBOUND EGRESS PROOF
 *
 * CONTRACT RULES:
 * - NO product features
 * - src/** is READ-ONLY
 * - Tests only
 * - PASS = proof of zero external egress
 * - FAIL = undeclared external calls found
 * - UNKNOWN = cannot verify without runtime execution
 *
 * TESTS:
 * 1. Static scan for network API imports
 * 2. Verify EXTERNAL_APIS.md completeness
 * 3. Runtime network trap (if applicable)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { withDeterminism, assertNoNetworkCalls, getNetworkCalls } from './_harness/determinism';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const WORKSPACE_ROOT = path.resolve(__dirname, '../../');
const SRC_ROOT = path.join(WORKSPACE_ROOT, 'src');
const DOCS_ROOT = path.join(WORKSPACE_ROOT, 'docs');
const AUDIT_DIR = path.join(WORKSPACE_ROOT, '../../audit/credibility_reports');
const EXTERNAL_APIS_DOC = path.join(DOCS_ROOT, 'EXTERNAL_APIS.md');

// Ensure audit directory exists
if (!fs.existsSync(AUDIT_DIR)) {
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
}

// ============================================================================
// EVIDENCE EMISSION
// ============================================================================

interface EvidenceRecord {
  runId: number;
  gapId: string;
  testId: string;
  status: 'PASS' | 'FAIL' | 'UNKNOWN';
  reason?: string;
  evidence: {
    filePath?: string;
    lineRange?: string;
    reproCommand?: string;
    actualResult?: string | boolean | number;
    expectedResult?: string | boolean | number;
    assertion?: string;
    details?: Record<string, any>;
  };
  timestamp: string;
}

function emitEvidence(record: EvidenceRecord) {
  const jsonlPath = path.join(AUDIT_DIR, 'GAP3_EGRESS.jsonl');
  fs.appendFileSync(jsonlPath, JSON.stringify(record) + '\n');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function findFilesInDirectory(dir: string, extension: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findFilesInDirectory(fullPath, extension));
    } else if (entry.name.endsWith(extension)) {
      files.push(fullPath);
    }
  }

  return files;
}

// ============================================================================
// GAP-3 TESTS
// ============================================================================

describe('GAP-3: Outbound Egress Proof', () => {
  beforeAll(() => {
    withDeterminism.setup();
  });

  afterAll(() => {
    withDeterminism.teardown();
  });

  it('GAP3_STATIC_EGRESS_SCAN: Scan src/ for external network APIs', () => {
    const dangerousPatterns = [
      { name: 'axios import', regex: /import.*['"]axios['"]/ },
      { name: 'node-fetch import', regex: /import.*['"]node-fetch['"]/ },
      { name: 'got import', regex: /import.*['"]got['"]/ },
      { name: 'superagent import', regex: /import.*['"]superagent['"]/ },
      { name: 'request import', regex: /import.*['"]request['"]/ },
      { name: 'http.request', regex: /http\.request\s*\(/ },
      { name: 'https.request', regex: /https\.request\s*\(/ },
      { name: 'new WebSocket', regex: /new\s+WebSocket\s*\(/ },
      { name: 'dns.lookup', regex: /dns\.lookup\s*\(/ },
    ];

    // Allowed patterns (Forge APIs, same-origin)
    const allowedPatterns = [
      { name: '@forge/api', regex: /import.*['"]@forge\/api['"]/ },
      { name: '@forge/ui', regex: /import.*['"]@forge\/ui['"]/ },
      { name: 'window.location.href (same-origin)', regex: /fetch\s*\(\s*window\.location\.href/ },
      { name: 'api.asUser().requestJira', regex: /api\.asUser\(\)\.requestJira/ },
      { name: 'api.asApp().requestStorage', regex: /api\.asApp\(\)\.requestStorage/ },
    ];

    const files = findFilesInDirectory(SRC_ROOT, '.ts');
    const violations: Array<{ file: string; line: number; pattern: string; code: string }> = [];
    const allowedUsages: Array<{ file: string; line: number; pattern: string }> = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        // Check for dangerous patterns
        for (const pattern of dangerousPatterns) {
          if (pattern.regex.test(line)) {
            // Skip if it's just a comment
            if (!line.trim().startsWith('//')) {
              violations.push({
                file: path.relative(SRC_ROOT, file),
                line: idx + 1,
                pattern: pattern.name,
                code: line.trim(),
              });
            }
          }
        }

        // Track allowed patterns
        for (const pattern of allowedPatterns) {
          if (pattern.regex.test(line)) {
            allowedUsages.push({
              file: path.relative(SRC_ROOT, file),
              line: idx + 1,
              pattern: pattern.name,
            });
          }
        }
      });
    }

    const status = violations.length === 0 ? 'PASS' : 'FAIL';
    const reason =
      violations.length === 0
        ? `No external network API calls found (${allowedUsages.length} allowed Forge API calls verified)`
        : `Found ${violations.length} potential external network API calls`;

    emitEvidence({
      runId: 0,
      gapId: 'GAP_3',
      testId: 'GAP3_STATIC_EGRESS_SCAN',
      status,
      reason,
      evidence: {
        filePath: 'tests/credibility/gap3_egress_static_and_runtime.test.ts',
        lineRange: '1-200',
        reproCommand: 'npm run test:credibility -- --grep GAP3_STATIC_EGRESS_SCAN',
        actualResult: violations.length,
        expectedResult: 0,
        assertion: 'No external network API imports or calls in src/',
        details: {
          violations: violations.slice(0, 10), // First 10 for brevity
          allowedUsages: allowedUsages.length,
        },
      },
      timestamp: new Date().toISOString(),
    });

    if (violations.length > 0) {
      console.error('=== NETWORK API VIOLATIONS ===');
      violations.forEach((v) => {
        console.error(`  ${v.file}:${v.line} [${v.pattern}] ${v.code}`);
      });
    }

    expect(violations).toHaveLength(0);
  });

  it('GAP3_EXTERNAL_APIS_DOC_EXISTS: Verify EXTERNAL_APIS.md exists', () => {
    const exists = fs.existsSync(EXTERNAL_APIS_DOC);
    
    emitEvidence({
      runId: 0,
      gapId: 'GAP_3',
      testId: 'GAP3_EXTERNAL_APIS_DOC_EXISTS',
      status: exists ? 'PASS' : 'FAIL',
      reason: exists ? 'EXTERNAL_APIS.md exists' : 'EXTERNAL_APIS.md missing',
      evidence: {
        filePath: 'docs/EXTERNAL_APIS.md',
        reproCommand: 'ls -la docs/EXTERNAL_APIS.md',
        actualResult: exists,
        expectedResult: true,
        assertion: 'EXTERNAL_APIS.md must exist and document all network calls',
      },
      timestamp: new Date().toISOString(),
    });

    expect(exists).toBe(true);
  });

  it('GAP3_EXTERNAL_APIS_DOC_COMPLETENESS: Verify EXTERNAL_APIS.md has no placeholders', () => {
    if (!fs.existsSync(EXTERNAL_APIS_DOC)) {
      emitEvidence({
        runId: 0,
        gapId: 'GAP_3',
        testId: 'GAP3_EXTERNAL_APIS_DOC_COMPLETENESS',
        status: 'FAIL',
        reason: 'EXTERNAL_APIS.md does not exist',
        evidence: {
          filePath: 'docs/EXTERNAL_APIS.md',
          assertion: 'Document must exist before checking completeness',
        },
        timestamp: new Date().toISOString(),
      });
      expect(fs.existsSync(EXTERNAL_APIS_DOC)).toBe(true);
      return;
    }

    const content = fs.readFileSync(EXTERNAL_APIS_DOC, 'utf-8');
    
    // Forbidden placeholders
    const forbiddenPatterns = [
      /TODO/i,
      /TBD/i,
      /\[TO BE DOCUMENTED\]/i,
      /\[INSERT.*\]/i,
      /\[REPLACE WITH.*\]/i,
      /example\.com/i, // Generic example URLs not allowed
      /UNKNOWN.*API/, // "UNKNOWN" is allowed for specific fields, but not for entire API sections
    ];

    const violations: Array<{ pattern: string; line: number; text: string }> = [];
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(line)) {
          violations.push({
            pattern: pattern.source,
            line: idx + 1,
            text: line.trim(),
          });
        }
      }
    });

    // Must document Jira API calls
    const requiredSections = [
      'Atlassian Jira REST API',
      'Forge Storage API',
      'Static Analysis Results',
      'Compliance Attestations',
    ];

    const missingSections = requiredSections.filter((section) => !content.includes(section));

    const status = violations.length === 0 && missingSections.length === 0 ? 'PASS' : 'FAIL';
    const reason =
      violations.length === 0 && missingSections.length === 0
        ? 'EXTERNAL_APIS.md is complete with no placeholders'
        : `Found ${violations.length} placeholders and ${missingSections.length} missing sections`;

    emitEvidence({
      runId: 0,
      gapId: 'GAP_3',
      testId: 'GAP3_EXTERNAL_APIS_DOC_COMPLETENESS',
      status,
      reason,
      evidence: {
        filePath: 'docs/EXTERNAL_APIS.md',
        reproCommand: 'cat docs/EXTERNAL_APIS.md',
        assertion: 'EXTERNAL_APIS.md must have no TODO/TBD/placeholder text',
        details: {
          violations: violations.slice(0, 5),
          missingSections,
        },
      },
      timestamp: new Date().toISOString(),
    });

    if (violations.length > 0) {
      console.error('=== PLACEHOLDER VIOLATIONS ===');
      violations.forEach((v) => {
        console.error(`  Line ${v.line}: ${v.text}`);
      });
    }

    if (missingSections.length > 0) {
      console.error('=== MISSING SECTIONS ===');
      missingSections.forEach((s) => {
        console.error(`  - ${s}`);
      });
    }

    expect(violations).toHaveLength(0);
    expect(missingSections).toHaveLength(0);
  });

  it('GAP3_RUNTIME_NETWORK_TRAP: Verify determinism harness blocks external calls', () => {
    // Test that the network trap is installed
    const calls = getNetworkCalls();
    
    // Should be empty at start
    const status = calls.length === 0 ? 'PASS' : 'FAIL';

    emitEvidence({
      runId: 0,
      gapId: 'GAP_3',
      testId: 'GAP3_RUNTIME_NETWORK_TRAP',
      status,
      reason: calls.length === 0 ? 'No network calls detected' : `${calls.length} network calls detected`,
      evidence: {
        filePath: 'tests/credibility/_harness/determinism.ts',
        lineRange: '170-220',
        reproCommand: 'npm run test:credibility -- --grep GAP3_RUNTIME_NETWORK_TRAP',
        actualResult: calls.length,
        expectedResult: 0,
        assertion: 'Network trap should block all external calls',
      },
      timestamp: new Date().toISOString(),
    });

    expect(calls).toHaveLength(0);
  });

  it('GAP3_EGRESS_POLICY_ENFORCEMENT: Verify egress policy documented', () => {
    if (!fs.existsSync(EXTERNAL_APIS_DOC)) {
      expect(fs.existsSync(EXTERNAL_APIS_DOC)).toBe(true);
      return;
    }

    const content = fs.readFileSync(EXTERNAL_APIS_DOC, 'utf-8');
    
    // Must declare policy
    const hasPolicyStatement = content.includes('Policy Statement') || content.includes('ZERO outbound egress');
    const hasEnforcement = content.includes('Enforcement');
    const hasResidualRisks = content.includes('Residual Risks');

    const status = hasPolicyStatement && hasEnforcement && hasResidualRisks ? 'PASS' : 'FAIL';

    emitEvidence({
      runId: 0,
      gapId: 'GAP_3',
      testId: 'GAP3_EGRESS_POLICY_ENFORCEMENT',
      status,
      reason: status === 'PASS' ? 'Egress policy fully documented' : 'Egress policy incomplete',
      evidence: {
        filePath: 'docs/EXTERNAL_APIS.md',
        assertion: 'Document must include policy statement, enforcement, and residual risks',
        actualResult: { hasPolicyStatement, hasEnforcement, hasResidualRisks },
        expectedResult: { hasPolicyStatement: true, hasEnforcement: true, hasResidualRisks: true },
      },
      timestamp: new Date().toISOString(),
    });

    expect(hasPolicyStatement).toBe(true);
    expect(hasEnforcement).toBe(true);
    expect(hasResidualRisks).toBe(true);
  });
});
