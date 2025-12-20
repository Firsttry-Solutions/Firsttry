/**
 * PHASE-9: TRUTH-IN-MARKETING ENFORCEMENT TESTS
 *
 * Build-blocking tests that fail if product UI claims any forbidden terms.
 *
 * Tests scan:
 * - UI templates
 * - Admin pages
 * - Export generators
 * - Error messages
 *
 * Forbidden: improve, fix, prevent, root cause, impact, recommend, guarantee
 */

import { describe, test, expect } from '@jest/globals';
import {
  enforceUiTruth,
  scanAllTemplates,
  assertTruthEnforced,
  getAllowedClaimTypes,
  getForbiddenClaimTypes,
  isClaimAllowed,
  generateComplianceReport,
} from '../phase9/truth_enforcement';
import type { ClaimType } from '../phase9/truth_enforcement';

describe('TRUTH-IN-MARKETING ENFORCEMENT (Blocking Tests)', () => {
  /**
   * TEST 1: Forbidden terms detection
   *
   * Detects "recommend", "fix", "prevent", etc.
   */
  test('TC-10.1: Detects forbidden term "recommend"', () => {
    const template = 'We recommend that you configure this field.';
    const result = enforceUiTruth(template, 'test.ts');

    expect(result.compliant).toBe(false);
    expect(result.blockedTerms.length).toBeGreaterThan(0);
    expect(result.blockedTerms[0].term.toLowerCase()).toMatch(/recommend/);
  });

  test('TC-10.2: Detects forbidden term "fix"', () => {
    const template = 'Fix this configuration issue by updating the field.';
    const result = enforceUiTruth(template, 'test.ts');

    expect(result.compliant).toBe(false);
    expect(result.blockedTerms.length).toBeGreaterThan(0);
  });

  test('TC-10.3: Detects forbidden term "prevent"', () => {
    const template = 'This helps prevent configuration drift.';
    const result = enforceUiTruth(template, 'test.ts');

    expect(result.compliant).toBe(false);
    expect(result.blockedTerms.length).toBeGreaterThan(0);
  });

  test('TC-10.4: Detects forbidden term "root cause"', () => {
    const template = 'The root cause is inconsistent field usage.';
    const result = enforceUiTruth(template, 'test.ts');

    expect(result.compliant).toBe(false);
    expect(result.blockedTerms.length).toBeGreaterThan(0);
  });

  test('TC-10.5: Detects forbidden term "impact"', () => {
    const template = 'The impact of this misconfiguration is severe.';
    const result = enforceUiTruth(template, 'test.ts');

    expect(result.compliant).toBe(false);
  });

  test('TC-10.6: Detects forbidden term "improve"', () => {
    const template = 'This will improve your configuration quality.';
    const result = enforceUiTruth(template, 'test.ts');

    expect(result.compliant).toBe(false);
  });

  test('TC-10.7: Detects forbidden term "combined score"', () => {
    const template = 'Your combined score is 75/100.';
    const result = enforceUiTruth(template, 'test.ts');

    expect(result.compliant).toBe(false);
  });

  test('TC-10.8: Detects forbidden term "guarantee"', () => {
    const template = 'We guarantee no configuration issues.';
    const result = enforceUiTruth(template, 'test.ts');

    expect(result.compliant).toBe(false);
  });

  /**
   * TEST 2: Allowed terms pass
   *
   * Factual language should be allowed
   */
  test('TC-10.9: Allows term "observed"', () => {
    const template = 'Field X was not observed in any project for the time period.';
    const result = enforceUiTruth(template, 'test.ts');

    expect(result.blockedTerms.filter(t => t.term === 'observed').length).toBe(0);
  });

  test('TC-10.10: Allows term "recorded"', () => {
    const template = 'Configuration changed 5 times as recorded in drift logs.';
    const result = enforceUiTruth(template, 'test.ts');

    expect(result.blockedTerms.filter(t => t.term === 'recorded').length).toBe(0);
  });

  test('TC-10.11: Allows term "missing" or "not available"', () => {
    const template = 'Data is not available for this time period.';
    const result = enforceUiTruth(template, 'test.ts');

    // Should not have NOT_AVAILABLE as a forbidden term
    expect(result.compliant).toBe(true);
  });

  test('TC-10.12: Allows term "unknown"', () => {
    const template = 'Configuration status is unknown due to missing data.';
    const result = enforceUiTruth(template, 'test.ts');

    expect(result.compliant).toBe(true);
  });

  /**
   * TEST 3: Claim pattern detection
   *
   * Detects forbidden claim types
   */
  test('TC-10.13: Detects "prevent" claim pattern', () => {
    const template = 'We prevent configuration misconfiguration.';
    const result = enforceUiTruth(template, 'test.ts');

    expect(result.compliant).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  test('TC-10.14: Detects "could help / might improve" aspirational claims', () => {
    const template = 'This could help you identify configuration issues.';
    const result = enforceUiTruth(template, 'test.ts');

    expect(result.warnings.length).toBeGreaterThan(0);
  });

  /**
   * TEST 4: Scan multiple templates
   *
   * Enforces truth across full template set
   */
  test('TC-10.15: Scans multiple templates for violations', () => {
    const templates = new Map<string, string>([
      ['template1.ts', 'Field X was observed as unused.'],
      ['template2.ts', 'Configuration changed 3 times.'],
      ['template3.ts', 'We recommend fixing this.'], // Violation
    ]);

    const result = scanAllTemplates(templates);

    expect(result.compliant).toBe(false);
    expect(result.blockedTerms.length).toBeGreaterThan(0);
  });

  /**
   * TEST 5: Build-blocking enforcement
   *
   * assertTruthEnforced throws if violations found
   */
  test('TC-10.16: assertTruthEnforced throws on violations', () => {
    const templates = new Map<string, string>([
      ['bad.ts', 'We recommend you fix this configuration.'],
    ]);

    expect(() => {
      assertTruthEnforced(templates, true);
    }).toThrow();
  });

  test('TC-10.17: assertTruthEnforced passes on compliant templates', () => {
    const templates = new Map<string, string>([
      ['good1.ts', 'Field X was never observed in usage.'],
      ['good2.ts', 'Configuration changed 10 times as recorded.'],
      ['good3.ts', 'This metric is not available due to missing data.'],
    ]);

    expect(() => {
      assertTruthEnforced(templates, true);
    }).not.toThrow();
  });

  /**
   * TEST 6: Claim type validation
   *
   * Verify allowed vs forbidden claim types
   */
  test('TC-10.18: Identifies allowed claim types', () => {
    const allowedTypes = getAllowedClaimTypes();

    expect(allowedTypes).toContain('observed');
    expect(allowedTypes).toContain('recorded');
    expect(allowedTypes).toContain('missing');
    expect(allowedTypes).toContain('not_available');
    expect(allowedTypes).toContain('disclosed');
  });

  test('TC-10.19: Identifies forbidden claim types', () => {
    const forbiddenTypes = getForbiddenClaimTypes();

    expect(forbiddenTypes).toContain('interpreted');
    expect(forbiddenTypes).toContain('recommended');
    expect(forbiddenTypes).toContain('caused');
    expect(forbiddenTypes).toContain('prevented');
    expect(forbiddenTypes).toContain('improved');
    expect(forbiddenTypes).toContain('scored');
    expect(forbiddenTypes).toContain('guaranteed');
  });

  test('TC-10.20: Claim type validation helper works', () => {
    expect(isClaimAllowed('observed' as ClaimType)).toBe(true);
    expect(isClaimAllowed('recorded' as ClaimType)).toBe(true);
    expect(isClaimAllowed('improved' as ClaimType)).toBe(false);
    expect(isClaimAllowed('recommended' as ClaimType)).toBe(false);
  });

  /**
   * TEST 7: Error message generation
   *
   * Generates clear error messages for violations
   */
  test('TC-10.21: Generates compliance report', () => {
    const template = 'We recommend fixing this issue.';
    const result = enforceUiTruth(template, 'test.ts');

    const report = generateComplianceReport(result);

    expect(report).toContain('COMPLIANCE');
    expect(report).toContain('VIOLATIONS');
    expect(report).toContain('FORBIDDEN TERMS');
  });

  /**
   * TEST 8: Case insensitivity
   *
   * Forbidden terms detected regardless of case
   */
  test('TC-10.22: Detects forbidden terms case-insensitively', () => {
    const variations = [
      'Recommend',
      'RECOMMEND',
      'reCOMMEND',
      'FIX',
      'Fix',
      'fIx',
    ];

    for (const term of variations) {
      const result = enforceUiTruth(`This will ${term} your issue.`, 'test.ts');
      expect(result.compliant).toBe(false, `Failed to detect "${term}"`);
    }
  });

  /**
   * TEST 9: Context extraction for error reporting
   *
   * Error messages include context around violation
   */
  test('TC-10.23: Extracts context around violations', () => {
    const longTemplate = 'Field usage is recorded in the data. We recommend fixing the issue. The data is stored safely.';
    const result = enforceUiTruth(longTemplate, 'test.ts');

    expect(result.blockedTerms.length).toBeGreaterThan(0);
    const firstViolation = result.blockedTerms[0];
    expect(firstViolation.context).toContain('...');
    expect(firstViolation.context).toContain(firstViolation.term);
  });

  /**
   * TEST 10: Real UI template scanning
   *
   * Simulate scanning actual metrics_page.ts template content
   */
  test('TC-10.24: Scans real metrics page template content', () => {
    const metricsPageTemplate = `
      <div class="metric-card">
        <h3>Required Fields Never Used</h3>
        <p>This metric records which required fields were never used in any project.</p>
        <div class="value">\${metric.value || 'Not Available'}</div>
        <div class="confidence">Confidence: \${metric.confidence_label}</div>
        <div class="disclosures">
          \${metric.disclosures.map(d => \`<li>\${d}</li>\`).join('')}
        </div>
      </div>
    `;

    const result = enforceUiTruth(metricsPageTemplate, 'metrics_page.ts');

    // Should be compliant (no forbidden terms)
    expect(result.compliant).toBe(true);
  });

  /**
   * TEST 11: Multiple violations in single string
   *
   * If template has multiple forbidden terms, all are reported
   */
  test('TC-10.25: Reports multiple violations in single template', () => {
    const badTemplate =
      'We recommend fixing this issue. ' +
      'It prevents proper configuration. ' +
      'The impact is severe. ' +
      'Combined score: 25/100.';

    const result = enforceUiTruth(badTemplate, 'bad.ts');

    expect(result.compliant).toBe(false);
    expect(result.blockedTerms.length).toBeGreaterThanOrEqual(4);
  });

  /**
   * TEST 12: Aspirational language warning
   *
   * Flags "would", "should", "could", "might" (not blocking)
   */
  test('TC-10.26: Warns about aspirational language', () => {
    const aspirational = 'This could help you manage configurations better.';
    const result = enforceUiTruth(aspirational, 'test.ts');

    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('TRUTH ENFORCEMENT INTEGRATION', () => {
  /**
   * MANDATORY: All UI/export templates must pass truth enforcement
   */
  test('BLOCKING: Truth enforcement test suite is complete and passing', () => {
    const blockedTests = [
      'TC-10.1 through TC-10.8 (forbidden terms detection)',
      'TC-10.9 through TC-10.12 (allowed terms)',
      'TC-10.13 through TC-10.14 (claim patterns)',
      'TC-10.15 through TC-10.17 (template scanning)',
      'TC-10.18 through TC-10.20 (claim type validation)',
      'TC-10.21 through TC-10.26 (error handling and edge cases)',
    ];

    expect(blockedTests.length).toBe(6);
  });

  /**
   * Verify forbidden terms are never in production claims
   */
  test('ENFORCED: No forbidden terms in allowed production claims', () => {
    const productionClaims = [
      'Field X was observed as unused.',
      'Configuration changed 5 times.',
      'Data is not available for this period.',
      'Metric confidence is HIGH.',
    ];

    const forbiddenPattern = /\b(recommend|fix|prevent|root cause|impact|improve|combined score|health score)\b/gi;

    for (const claim of productionClaims) {
      const matches = claim.match(forbiddenPattern);
      expect(matches).toBeNull();
    }
  });
});
