/**
 * PHASE-9: TRUTH ENFORCEMENT
 *
 * Enforces language discipline:
 * - Blocks forbidden terms (recommend, fix, prevent, impact, etc.)
 * - Validates claims against capabilities
 * - Ensures UI text is factual, not aspirational
 * - Scans templates and exports for compliance
 *
 * This is a guardrail, not an engine. It blocks false claims.
 */

// Forbidden terms that must never appear in product claims/UI
const FORBIDDEN_TERMS = [
  'recommend', 'recommendation',
  'fix', 'fixed', 'fixing',
  'prevent', 'prevention', 'prevent',
  'root cause',
  'impact',
  'improve', 'improved', 'improvement',
  'combined score',
  'health score',
  'predict', 'prediction',
  'guarantee', 'guaranteed',
  'outcome',
  'risk score',
  'severity score',
];

const FORBIDDEN_TERM_PATTERN = new RegExp(
  `\\b(${FORBIDDEN_TERMS.join('|')})\\b`,
  'gi'
);

/**
 * ClaimType: Categories of claims that product can or cannot make
 */
export enum ClaimType {
  OBSERVED = 'observed',        // ✅ "Field X was never used" (fact from data)
  RECORDED = 'recorded',        // ✅ "Configuration changed 5 times" (fact from logs)
  MISSING = 'missing',          // ✅ "Data unavailable for project Y"
  NOT_AVAILABLE = 'not_available', // ✅ "Metric X unknown (no usage data)"
  DISCLOSED = 'disclosed',      // ✅ "We don't track issue descriptions"

  // All of these are FORBIDDEN:
  INTERPRETED = 'interpreted',  // ❌ "This indicates a problem"
  RECOMMENDED = 'recommended',  // ❌ "You should fix X"
  CAUSED = 'caused',            // ❌ "Root cause is Y"
  PREVENTED = 'prevented',      // ❌ "We prevent configuration drift"
  IMPROVED = 'improved',        // ❌ "Accuracy improved by 10%"
  SCORED = 'scored',            // ❌ "Overall score is 75"
  GUARANTEED = 'guaranteed',    // ❌ "We guarantee no outages"
}

/**
 * Enforcement Result
 */
export interface EnforcementResult {
  compliant: boolean;
  violations: ClaimViolation[];
  blockedTerms: TermMatch[];
  warnings: string[];
}

export interface ClaimViolation {
  type: ClaimType;
  location: string;
  content: string;
  reason: string;
}

export interface TermMatch {
  term: string;
  location: string;
  context: string;
}

/**
 * Enforce truth in a UI template
 *
 * @throws Error if forbidden terms or claims detected (build-blocking)
 */
export function enforceUiTruth(
  templateContent: string,
  templatePath: string
): EnforcementResult {
  const violations: ClaimViolation[] = [];
  const blockedTerms: TermMatch[] = [];
  const warnings: string[] = [];

  // Check for forbidden terms
  const forbiddenMatches = templateContent.match(FORBIDDEN_TERM_PATTERN);
  if (forbiddenMatches) {
    for (const term of forbiddenMatches) {
      const context = extractContext(templateContent, term, 30);
      blockedTerms.push({
        term: term.toLowerCase(),
        location: templatePath,
        context,
      });
    }
  }

  // Check for forbidden claim patterns
  const claimViolations = detectForbiddenClaims(templateContent, templatePath);
  violations.push(...claimViolations);

  // Warn about aspirational language (not blocking, but flagged)
  const aspirationalMatches = templateContent.match(
    /\b(would|should|could|may|might|could help|might improve)\b/gi
  );
  if (aspirationalMatches) {
    warnings.push(
      `${templatePath}: Found ${aspirationalMatches.length} instances of aspirational language (would/should/could/may). ` +
      `Use factual language only: "recorded", "observed", "missing", "unknown".`
    );
  }

  const compliant = blockedTerms.length === 0 && violations.length === 0;

  return {
    compliant,
    violations,
    blockedTerms,
    warnings,
  };
}

/**
 * Detect forbidden claim patterns
 */
function detectForbiddenClaims(
  content: string,
  location: string
): ClaimViolation[] {
  const violations: ClaimViolation[] = [];

  // Patterns that indicate forbidden claim types
  const forbiddenPatterns: Array<{ pattern: RegExp; claimType: ClaimType; reason: string }> = [
    {
      pattern: /\b(can help|could help|might help|will improve)\b/gi,
      claimType: ClaimType.IMPROVED,
      reason: 'Aspirational "improvement" claims are forbidden',
    },
    {
      pattern: /\b(we (prevent|stop|eliminate).*drift|prevent.*misconfiguration)\b/gi,
      claimType: ClaimType.PREVENTED,
      reason: 'Cannot claim prevention without proof',
    },
    {
      pattern: /\b(root cause is|caused by|cause of)\b/gi,
      claimType: ClaimType.CAUSED,
      reason: 'Causal claims are forbidden (forbidden term: root cause)',
    },
    {
      pattern: /\b(we (ensure|guarantee|promise).*no|guaranteed.*safety)\b/gi,
      claimType: ClaimType.GUARANTEED,
      reason: 'Cannot guarantee outcomes',
    },
    {
      pattern: /\b(overall|combined|total).*score\b/gi,
      claimType: ClaimType.SCORED,
      reason: 'Combined or aggregate scores are forbidden',
    },
  ];

  for (const { pattern, claimType, reason } of forbiddenPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      for (const match of matches) {
        violations.push({
          type: claimType,
          location,
          content: match,
          reason,
        });
      }
    }
  }

  return violations;
}

/**
 * Extract context around a term (for error messages)
 */
function extractContext(
  content: string,
  term: string,
  contextChars: number
): string {
  const index = content.toLowerCase().indexOf(term.toLowerCase());
  if (index === -1) return term;

  const start = Math.max(0, index - contextChars);
  const end = Math.min(content.length, index + term.length + contextChars);
  const before = content.substring(start, index);
  const after = content.substring(index + term.length, end);

  return `...${before}[${term}]${after}...`.replace(/\s+/g, ' ');
}

/**
 * Scan all UI templates for truth violations
 *
 * @param templatesByPath Map of template path → content
 * @returns Enforcement result (fails build if violations found)
 */
export function scanAllTemplates(
  templatesByPath: Map<string, string>
): EnforcementResult {
  const allViolations: ClaimViolation[] = [];
  const allBlockedTerms: TermMatch[] = [];
  const allWarnings: string[] = [];
  let compliant = true;

  for (const [path, content] of templatesByPath) {
    const result = enforceUiTruth(content, path);
    allViolations.push(...result.violations);
    allBlockedTerms.push(...result.blockedTerms);
    allWarnings.push(...result.warnings);
    if (!result.compliant) compliant = false;
  }

  return {
    compliant,
    violations: allViolations,
    blockedTerms: allBlockedTerms,
    warnings: allWarnings,
  };
}

/**
 * Assert truth enforcement (blocking)
 * Throws error if violations found
 */
export function assertTruthEnforced(
  templatesByPath: Map<string, string>,
  enforceStrict: boolean = true
): void {
  const result = scanAllTemplates(templatesByPath);

  if (!result.compliant) {
    const errorLines = [
      '❌ TRUTH ENFORCEMENT VIOLATION — Build will fail',
      '',
      `Found ${result.blockedTerms.length} forbidden terms and ${result.violations.length} forbidden claims:`,
      '',
    ];

    for (const term of result.blockedTerms) {
      errorLines.push(
        `  ❌ "${term.term}" in ${term.location}`,
        `     Context: ${term.context}`,
        ''
      );
    }

    for (const violation of result.violations) {
      errorLines.push(
        `  ❌ ${violation.type} claim in ${violation.location}`,
        `     "${violation.content}"`,
        `     Reason: ${violation.reason}`,
        ''
      );
    }

    if (result.warnings.length > 0 && enforceStrict) {
      errorLines.push('⚠️  Warnings (aspirational language):');
      for (const warning of result.warnings) {
        errorLines.push(`  ${warning}`);
      }
    }

    throw new Error(errorLines.join('\n'));
  }
}

/**
 * Get allowed claim types (what product IS allowed to say)
 */
export function getAllowedClaimTypes(): ClaimType[] {
  return [
    ClaimType.OBSERVED,
    ClaimType.RECORDED,
    ClaimType.MISSING,
    ClaimType.NOT_AVAILABLE,
    ClaimType.DISCLOSED,
  ];
}

/**
 * Get forbidden claim types (what product is NOT allowed to say)
 */
export function getForbiddenClaimTypes(): ClaimType[] {
  return [
    ClaimType.INTERPRETED,
    ClaimType.RECOMMENDED,
    ClaimType.CAUSED,
    ClaimType.PREVENTED,
    ClaimType.IMPROVED,
    ClaimType.SCORED,
    ClaimType.GUARANTEED,
  ];
}

/**
 * Verify a claim is allowed (helper for developers)
 */
export function isClaimAllowed(claimType: ClaimType): boolean {
  return getAllowedClaimTypes().includes(claimType);
}

/**
 * Get human-readable explanation of why a term is forbidden
 */
export function getForbiddenTermExplanation(term: string): string {
  const termLower = term.toLowerCase();

  const explanations: { [key: string]: string } = {
    'recommend': 'Recommendations require interpretation, which is forbidden. Use "observed" instead.',
    'fix': 'Cannot claim fixing without proving resolution. Use "recorded change" instead.',
    'prevent': 'Cannot claim prevention without guaranteed outcome. Use "drift detected" instead.',
    'root cause': 'Causal claims forbidden. Use "observed configuration value" instead.',
    'impact': 'Impact requires interpretation. Use "observed field usage" instead.',
    'improve': 'Cannot claim improvement without baseline and measurement. Forbidden.',
    'combined score': 'Aggregate scoring is forbidden. Report individual metrics instead.',
    'health score': 'Health scoring implies interpretation. Report individual metrics instead.',
    'predict': 'Predictions are forbidden. Report observed facts only.',
    'guarantee': 'Cannot guarantee outcomes. Report what was measured instead.',
    'outcome': 'Outcomes imply causality. Report observed facts instead.',
  };

  return explanations[termLower] || `"${term}" is a forbidden term. Use factual language instead.`;
}

/**
 * Generate compliance report
 */
export function generateComplianceReport(
  result: EnforcementResult
): string {
  const lines = [
    '═══════════════════════════════════════════════════════',
    'TRUTH ENFORCEMENT COMPLIANCE REPORT',
    '═══════════════════════════════════════════════════════',
    '',
    `Status: ${result.compliant ? '✅ COMPLIANT' : '❌ VIOLATIONS DETECTED'}`,
    '',
    `Blocked Terms Found: ${result.blockedTerms.length}`,
    `Forbidden Claims Found: ${result.violations.length}`,
    `Warnings: ${result.warnings.length}`,
    '',
  ];

  if (result.blockedTerms.length > 0) {
    lines.push('FORBIDDEN TERMS:');
    for (const term of result.blockedTerms) {
      lines.push(`  • "${term.term}" in ${term.location}`);
      lines.push(`    ${getForbiddenTermExplanation(term.term)}`);
    }
    lines.push('');
  }

  if (result.violations.length > 0) {
    lines.push('FORBIDDEN CLAIMS:');
    for (const violation of result.violations) {
      lines.push(`  • ${violation.type} in ${violation.location}`);
      lines.push(`    "${violation.content}"`);
      lines.push(`    Reason: ${violation.reason}`);
    }
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push('WARNINGS (Aspirational Language):');
    for (const warning of result.warnings) {
      lines.push(`  • ${warning}`);
    }
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════════════');
  return lines.join('\n');
}
