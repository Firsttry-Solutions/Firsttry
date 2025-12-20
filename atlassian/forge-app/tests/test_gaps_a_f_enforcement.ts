/**
 * PHASE 4 GAPS A-F: HARD ENFORCEMENT TESTS
 * 
 * Verify that each gap is sealed tight - NO BYPASS ROUTES POSSIBLE
 * 
 * Test strategy: For each gap, prove that:
 * 1. Correct usage passes
 * 2. All bypass attempts fail
 * 3. Runtime guards catch violations
 * 4. Types prevent compilation of violations
 */

import {
  PHASE,
  assertValidDisclosure,
  exportPhase4Metric,
  NonFactualZeroSemanticState,
  assertValidZeroMetric,
  createPhase4ZeroMetric,
  assertAutomationRuleCannotBeInferred,
  createAutomationRuleWithExecutionDisclosure,
  assertValidForecast,
  createPhase4Forecast,
  getScopeTransparencyCurrentVersion,
  addScopeTransparencyVersion,
  rejectPhase5Signals,
  assertPhase4Context,
  ConfidenceLevel,
  ZeroValueReason,
  ForbiddenPhase5Signals,
} from '../src/disclosure_hardening_gaps_a_f';

// ============================================================================
// Test Framework
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertThrows(fn: () => void, expectedError: string | RegExp) {
  try {
    fn();
    throw new Error(`Expected error but function succeeded`);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    if (typeof expectedError === 'string') {
      if (!errorMsg.includes(expectedError)) {
        throw new Error(`Expected error containing "${expectedError}", got: ${errorMsg}`);
      }
    } else {
      if (!expectedError.test(errorMsg)) {
        throw new Error(`Expected error matching ${expectedError}, got: ${errorMsg}`);
      }
    }
  }
}

function test(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, passed: true });
    console.log(`✓ ${name}`);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    results.push({ name, passed: false, error });
    console.log(`✗ ${name}: ${error}`);
  }
}

// ============================================================================
// GAP A: HARD DISCLOSURE WRAPPER ENFORCEMENT TESTS
// ============================================================================

test('GAP A.1: Valid disclosure passes assertion', () => {
  const disclosure = {
    completeness_percent: 75,
    observation_window_days: 30,
    confidence_level: ConfidenceLevel.MEDIUM,
    disclosure_text: 'Test disclosure',
    computed_at: new Date().toISOString(),
    _phase_4_sealed: true,
  };

  assertValidDisclosure(disclosure);
  assert(true, 'Valid disclosure accepted');
});

test('GAP A.2: Missing completeness_percent fails', () => {
  const disclosure = {
    observation_window_days: 30,
    confidence_level: ConfidenceLevel.MEDIUM,
    disclosure_text: 'Test',
    computed_at: new Date().toISOString(),
    _phase_4_sealed: true,
  };

  assertThrows(() => assertValidDisclosure(disclosure), 'completeness_percent');
});

test('GAP A.3: Missing confidence_level fails', () => {
  const disclosure = {
    completeness_percent: 75,
    observation_window_days: 30,
    disclosure_text: 'Test',
    computed_at: new Date().toISOString(),
    _phase_4_sealed: true,
  };

  assertThrows(() => assertValidDisclosure(disclosure), 'confidence_level');
});

test('GAP A.4: Missing disclosure_text fails', () => {
  const disclosure = {
    completeness_percent: 75,
    observation_window_days: 30,
    confidence_level: ConfidenceLevel.MEDIUM,
    computed_at: new Date().toISOString(),
    _phase_4_sealed: true,
  };

  assertThrows(() => assertValidDisclosure(disclosure), 'disclosure_text');
});

test('GAP A.5: Missing _phase_4_sealed fails', () => {
  const disclosure = {
    completeness_percent: 75,
    observation_window_days: 30,
    confidence_level: ConfidenceLevel.MEDIUM,
    disclosure_text: 'Test',
    computed_at: new Date().toISOString(),
  };

  assertThrows(() => assertValidDisclosure(disclosure), 'sealed for Phase-4');
});

test('GAP A.6: exportPhase4Metric enforces disclosure', () => {
  const metric = {
    value: 42,
    disclosure: {
      completeness_percent: 75,
      observation_window_days: 30,
      confidence_level: ConfidenceLevel.MEDIUM,
      disclosure_text: 'Valid',
      computed_at: new Date().toISOString(),
      _phase_4_sealed: true,
    },
  };

  const exported = exportPhase4Metric(metric);
  assert(exported.value === 42, 'Value preserved');
  assert(exported.disclosure._phase_4_sealed === true, 'Disclosure preserved');
});

test('GAP A.7: Raw metric export without disclosure fails', () => {
  const metric = {
    value: 42,
    disclosure: null,
  };

  assertThrows(() => exportPhase4Metric(metric), 'Disclosure envelope is null');
});

// ============================================================================
// GAP B: NON_FACTUAL_ZERO SEMANTIC STATE TESTS
// ============================================================================

test('GAP B.1: Zero metric with semantic state passes', () => {
  const metric = {
    value: 0,
    disclosure: createPhase4ZeroMetric('Test Metric', 7, NonFactualZeroSemanticState.INSUFFICIENT_OBSERVATION),
  };

  assertValidZeroMetric(metric);
  assert(metric.disclosure.non_rankable === true, 'Non-rankable flag set');
  assert(metric.disclosure.non_comparable === true, 'Non-comparable flag set');
});

test('GAP B.2: Zero metric without semantic state fails', () => {
  const metric = {
    value: 0,
    disclosure: {
      completeness_percent: 0,
      observation_window_days: 1,
      confidence_level: ConfidenceLevel.INSUFFICIENT_DATA,
      disclosure_text: 'Zero value',
      computed_at: new Date().toISOString(),
      _phase_4_sealed: true,
    },
  };

  assertThrows(() => assertValidZeroMetric(metric), 'zero_semantic_state');
});

test('GAP B.3: Zero metric without interpretation guard fails', () => {
  const metric = {
    value: 0,
    disclosure: {
      completeness_percent: 0,
      observation_window_days: 1,
      confidence_level: ConfidenceLevel.INSUFFICIENT_DATA,
      zero_semantic_state: NonFactualZeroSemanticState.INSUFFICIENT_OBSERVATION,
      disclosure_text: 'Zero value',
      computed_at: new Date().toISOString(),
      _phase_4_sealed: true,
    },
  };

  assertThrows(() => assertValidZeroMetric(metric), 'zero_interpretation_guard');
});

test('GAP B.4: Zero without non_rankable flag fails', () => {
  const metric = {
    value: 0,
    disclosure: {
      completeness_percent: 0,
      observation_window_days: 1,
      confidence_level: ConfidenceLevel.INSUFFICIENT_DATA,
      zero_semantic_state: NonFactualZeroSemanticState.INSUFFICIENT_OBSERVATION,
      disclosure_text: 'Zero value',
      zero_interpretation_guard: 'Cannot rank',
      computed_at: new Date().toISOString(),
      _phase_4_sealed: true,
      non_rankable: false,
      non_comparable: true,
    },
  };

  assertThrows(() => assertValidZeroMetric(metric), 'non_rankable');
});

test('GAP B.5: All zero semantic state reasons work', () => {
  const reasons = [
    NonFactualZeroSemanticState.INSUFFICIENT_OBSERVATION,
    NonFactualZeroSemanticState.MEASUREMENT_NOT_YET_ENABLED,
    NonFactualZeroSemanticState.OUT_OF_SCOPE,
  ];

  reasons.forEach((reason) => {
    const metric = {
      value: 0,
      disclosure: createPhase4ZeroMetric('Test', 7, reason),
    };
    assertValidZeroMetric(metric);
  });
});

// ============================================================================
// GAP C: AUTOMATION DUAL VISIBILITY ENFORCEMENT TESTS
// ============================================================================

test('GAP C.1: Valid automation rule with execution disclosure passes', () => {
  const rule = createAutomationRuleWithExecutionDisclosure('R1', 'Rule 1', true, new Date().toISOString());
  assertAutomationRuleCannotBeInferred(rule);
});

test('GAP C.2: Automation rule missing definition fails', () => {
  const rule = {
    execution_status: {
      visibility: 'NOT_YET_MEASURABLE',
      reason: 'PHASE_4_METADATA_ONLY',
      disclosure: 'Test',
      disclosed_at: new Date().toISOString(),
    },
    execution_count_forbidden: true,
  };

  assertThrows(() => assertAutomationRuleCannotBeInferred(rule), 'definition');
});

test('GAP C.3: Automation rule missing execution status fails', () => {
  const rule = {
    definition: {
      rule_id: 'R1',
      rule_name: 'Rule 1',
      enabled: true,
      last_modified: new Date().toISOString(),
      visibility: 'VISIBLE' as const,
    },
    execution_count_forbidden: true,
  };

  assertThrows(() => assertAutomationRuleCannotBeInferred(rule), 'execution status');
});

test('GAP C.4: Automation with wrong execution visibility fails', () => {
  const rule = {
    definition: {
      rule_id: 'R1',
      rule_name: 'Rule 1',
      enabled: true,
      last_modified: new Date().toISOString(),
      visibility: 'VISIBLE' as const,
    },
    execution_status: {
      visibility: 'MEASURABLE',
      reason: 'PHASE_4_METADATA_ONLY',
      disclosure: 'Test',
      disclosed_at: new Date().toISOString(),
    },
    execution_count_forbidden: true,
  };

  assertThrows(() => assertAutomationRuleCannotBeInferred(rule), 'NOT_YET_MEASURABLE');
});

test('GAP C.5: Automation execution cannot be extracted', () => {
  const rule = createAutomationRuleWithExecutionDisclosure('R1', 'Rule 1', true, new Date().toISOString());
  assert(rule.execution_count_forbidden === true, 'Extraction forbidden');
  assert(rule.execution_status.visibility === 'NOT_YET_MEASURABLE', 'Execution not measurable');
});

test('GAP C.6: Cannot infer "rule is broken" from metadata', () => {
  const rule = createAutomationRuleWithExecutionDisclosure('R1', 'Broken Rule', false, new Date().toISOString());
  assert(rule.definition.enabled === false, 'Rule is disabled');
  assert(rule.execution_status.visibility === 'NOT_YET_MEASURABLE', 'Cannot infer execution from being disabled');
});

// ============================================================================
// GAP D: FORECAST IMMUTABILITY ENFORCEMENT TESTS
// ============================================================================

test('GAP D.1: Valid forecast passes validation', () => {
  const forecast = createPhase4Forecast(42, 30);
  assertValidForecast(forecast);
});

test('GAP D.2: Forecast must be type ESTIMATED', () => {
  const forecast = {
    forecast_type: 'PROJECTED',
    observation_window_days: 30,
    confidence_level: ConfidenceLevel.MEDIUM,
    disclaimer: 'Test forecast',
    value: 42,
    generated_at: new Date().toISOString(),
    immutable: true,
  };

  assertThrows(() => assertValidForecast(forecast), 'ESTIMATED');
});

test('GAP D.3: Forecast without confidence_level fails', () => {
  const forecast = {
    forecast_type: 'ESTIMATED' as const,
    observation_window_days: 30,
    disclaimer: 'Test forecast',
    value: 42,
    generated_at: new Date().toISOString(),
    immutable: true,
  };

  assertThrows(() => assertValidForecast(forecast), 'confidence_level');
});

test('GAP D.4: Forecast without disclaimer fails', () => {
  const forecast = {
    forecast_type: 'ESTIMATED' as const,
    observation_window_days: 30,
    confidence_level: ConfidenceLevel.MEDIUM,
    value: 42,
    generated_at: new Date().toISOString(),
    immutable: true,
  };

  assertThrows(() => assertValidForecast(forecast), 'disclaimer');
});

test('GAP D.5: Forecast window < 7 days forces LOW confidence', () => {
  const forecast = createPhase4Forecast(42, 3);
  assert(forecast.confidence_level === ConfidenceLevel.LOW, 'Window < 7 forces LOW');
  assert(forecast.disclaimer.includes('Do not use for critical decisions'), 'Disclaimer warns');
});

test('GAP D.6: Forecast window >= 7 days can be MEDIUM', () => {
  const forecast = createPhase4Forecast(42, 30);
  assert(forecast.confidence_level === ConfidenceLevel.MEDIUM, 'Window >= 7 allows MEDIUM');
});

test('GAP D.7: Forecast must be immutable', () => {
  const forecast = createPhase4Forecast(42, 30);
  assert(forecast.immutable === true, 'Forecast marked immutable');
});

// ============================================================================
// GAP E: VERSIONED SCOPE TRANSPARENCY TESTS
// ============================================================================

test('GAP E.1: Create initial scope transparency', () => {
  const v1 = {
    version: '1.0.0',
    published_at: new Date().toISOString(),
    title: 'Phase-4 Scope',
    body: 'Phase-4 collects metadata only',
    why_metadata_first: ['Reason 1', 'Reason 2'],
    immutable_content: true as const,
  };

  const changelog = {
    versions: [v1],
    current_version: '1.0.0',
    last_updated_at: new Date().toISOString(),
    changelog_immutable: true as const,
  };

  const current = getScopeTransparencyCurrentVersion(changelog);
  assert(current.version === '1.0.0', 'Version retrieved');
});

test('GAP E.2: Add new version on content change', () => {
  const v1 = {
    version: '1.0.0',
    published_at: new Date().toISOString(),
    title: 'Phase-4 Scope',
    body: 'Phase-4 collects metadata only',
    why_metadata_first: ['Reason 1'],
    immutable_content: true as const,
  };

  let changelog = {
    versions: [v1],
    current_version: '1.0.0',
    last_updated_at: new Date().toISOString(),
    changelog_immutable: true as const,
  };

  const v2 = {
    version: '1.1.0',
    published_at: new Date().toISOString(),
    title: 'Phase-4 Scope (Updated)',
    body: 'Phase-4 collects metadata only. Version 1.1 clarifies...',
    why_metadata_first: ['Reason 1', 'Reason 2 (new)'],
    immutable_content: true as const,
  };

  changelog = addScopeTransparencyVersion(changelog, v2);
  assert(changelog.current_version === '1.1.0', 'New version is current');
  assert(changelog.versions.length === 2, 'Both versions in changelog');
});

test('GAP E.3: Cannot add new version without content change', () => {
  const v1 = {
    version: '1.0.0',
    published_at: new Date().toISOString(),
    title: 'Phase-4 Scope',
    body: 'Phase-4 collects metadata only',
    why_metadata_first: ['Reason 1'],
    immutable_content: true as const,
  };

  const changelog = {
    versions: [v1],
    current_version: '1.0.0',
    last_updated_at: new Date().toISOString(),
    changelog_immutable: true as const,
  };

  const v1_again = {
    version: '1.1.0',
    published_at: new Date().toISOString(),
    title: 'Phase-4 Scope',
    body: 'Phase-4 collects metadata only',
    why_metadata_first: ['Reason 1'],
    immutable_content: true as const,
  };

  assertThrows(
    () => addScopeTransparencyVersion(changelog, v1_again),
    'unchanged but new version'
  );
});

test('GAP E.4: Cannot change version string without different version', () => {
  const v1 = {
    version: '1.0.0',
    published_at: new Date().toISOString(),
    title: 'Phase-4 Scope',
    body: 'Phase-4 collects metadata only',
    why_metadata_first: ['Reason 1'],
    immutable_content: true as const,
  };

  const changelog = {
    versions: [v1],
    current_version: '1.0.0',
    last_updated_at: new Date().toISOString(),
    changelog_immutable: true as const,
  };

  const v1_edited = {
    version: '1.0.0',
    published_at: new Date().toISOString(),
    title: 'Phase-4 Scope (Different)',
    body: 'Phase-4 collects metadata only (updated)',
    why_metadata_first: ['Reason 1', 'Reason 2'],
    immutable_content: true as const,
  };

  assertThrows(() => addScopeTransparencyVersion(changelog, v1_edited), 'version string must differ');
});

test('GAP E.5: Old versions remain accessible', () => {
  let changelog = {
    versions: [
      {
        version: '1.0.0',
        published_at: new Date().toISOString(),
        title: 'Phase-4 Scope',
        body: 'V1',
        why_metadata_first: ['R1'],
        immutable_content: true as const,
      },
    ],
    current_version: '1.0.0',
    last_updated_at: new Date().toISOString(),
    changelog_immutable: true as const,
  };

  changelog = addScopeTransparencyVersion(changelog, {
    version: '1.1.0',
    published_at: new Date().toISOString(),
    title: 'Phase-4 Scope (Updated)',
    body: 'V1.1',
    why_metadata_first: ['R1', 'R2'],
    immutable_content: true as const,
  });

  assert(changelog.versions[0].version === '1.0.0', 'V1 still in changelog');
  assert(changelog.versions[1].version === '1.1.0', 'V1.1 added to changelog');
  assert(changelog.current_version === '1.1.0', 'V1.1 is current');
});

// ============================================================================
// GAP F: PHASE-4 BOUNDARY GUARDS TESTS
// ============================================================================

test('GAP F.1: PHASE constant is 4', () => {
  assert(PHASE === 4, 'PHASE = 4');
});

test('GAP F.2: assertPhase4Context passes when PHASE = 4', () => {
  assertPhase4Context();
  assert(true, 'Context assertion passed');
});

test('GAP F.3: Reject transition_count signal', () => {
  const data = {
    transition_count: 42,
  };

  assertThrows(() => rejectPhase5Signals(data), 'transition_count');
});

test('GAP F.4: Reject execution_count signal', () => {
  const data = {
    execution_count: 10,
  };

  assertThrows(() => rejectPhase5Signals(data), 'execution_count');
});

test('GAP F.5: Reject hygiene_score signal', () => {
  const data = {
    hygiene_score: 0.95,
  };

  assertThrows(() => rejectPhase5Signals(data), 'hygiene_score');
});

test('GAP F.6: Reject recommendation signal', () => {
  const data = {
    recommendation: 'Fix field X',
  };

  assertThrows(() => rejectPhase5Signals(data), 'recommendation');
});

test('GAP F.7: Reject behavior_confidence signal', () => {
  const data = {
    behavior_confidence: 0.85,
  };

  assertThrows(() => rejectPhase5Signals(data), 'behavior_confidence');
});

test('GAP F.8: Reject benchmark signal', () => {
  const data = {
    benchmark: {
      percentile: 75,
    },
  };

  assertThrows(() => rejectPhase5Signals(data), 'benchmark');
});

test('GAP F.9: Nested Phase-5 signals detected', () => {
  const data = {
    metrics: {
      nested: {
        execution_count: 5,
      },
    },
  };

  assertThrows(() => rejectPhase5Signals(data), 'execution_count');
});

test('GAP F.10: Clean Phase-4 data passes signal check', () => {
  const data = {
    projects: 5,
    fields: 25,
    automations: 10,
  };

  rejectPhase5Signals(data);
  assert(true, 'Phase-4 data passes');
});

// ============================================================================
// BYPASS ATTEMPT TESTS (Comprehensive Closure Verification)
// ============================================================================

test('BYPASS-1: Cannot extract raw metric without disclosure', () => {
  const bypassAttempt = () => {
    const metric = {
      value: 0,
      disclosure: null,
    };
    return exportPhase4Metric(metric);
  };

  assertThrows(bypassAttempt, 'Disclosure envelope');
});

test('BYPASS-2: Cannot rank zero metrics', () => {
  const metric = createPhase4ZeroMetric('M1', 1, NonFactualZeroSemanticState.INSUFFICIENT_OBSERVATION);
  assert(metric.non_rankable === true, 'Cannot rank zero');
  assert(metric.non_comparable === true, 'Cannot compare zero');
});

test('BYPASS-3: Cannot infer automation execution in Phase-4', () => {
  const rule = createAutomationRuleWithExecutionDisclosure('R1', 'Rule', true, new Date().toISOString());
  assert(rule.execution_count_forbidden === true, 'Cannot extract count');
  assert(rule.execution_status.visibility === 'NOT_YET_MEASURABLE', 'Execution not measurable');
});

test('BYPASS-4: Forecast cannot be unlabeled as ESTIMATED', () => {
  const forecast = createPhase4Forecast(42, 30);
  assert(forecast.forecast_type === 'ESTIMATED', 'Must be ESTIMATED');
  assert(forecast.immutable === true, 'Immutable');
});

test('BYPASS-5: Scope text cannot change without version bump', () => {
  let changelog = {
    versions: [
      {
        version: '1.0.0',
        published_at: new Date().toISOString(),
        title: 'Original',
        body: 'V1 body',
        why_metadata_first: ['R1'],
        immutable_content: true as const,
      },
    ],
    current_version: '1.0.0',
    last_updated_at: new Date().toISOString(),
    changelog_immutable: true as const,
  };

  const invalidAttempt = () => {
    return addScopeTransparencyVersion(changelog, {
      version: '1.0.0',
      published_at: new Date().toISOString(),
      title: 'Changed (Should Fail)',
      body: 'V1 body with edits',
      why_metadata_first: ['R1', 'R2'],
      immutable_content: true as const,
    });
  };

  assertThrows(invalidAttempt, 'version string must differ');
});

test('BYPASS-6: Cannot slip Phase-5 signals into Phase-4 data', () => {
  const sneakyData = {
    phase_4_field: 'OK',
    hidden_execution_count: 42,
  };

  assertThrows(() => rejectPhase5Signals(sneakyData), 'execution_count');
});

// ============================================================================
// RESULTS
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('PHASE 4 GAPS A-F: HARD ENFORCEMENT TEST RESULTS');
console.log('='.repeat(80) + '\n');

const passed = results.filter((r) => r.passed).length;
const total = results.length;
const failedTests = results.filter((r) => !r.passed);

console.log(`Tests Passed: ${passed}/${total}`);

if (failedTests.length > 0) {
  console.log('\nFailed Tests:');
  failedTests.forEach((r) => {
    console.log(`  ✗ ${r.name}`);
    console.log(`    ${r.error}\n`);
  });
}

// Gap summary
console.log('='.repeat(80));
console.log('GAP ENFORCEMENT STATUS');
console.log('='.repeat(80) + '\n');

const gaps = [
  { name: 'GAP A: Hard Disclosure Wrapper', prefix: 'GAP A' },
  { name: 'GAP B: NON_FACTUAL_ZERO State', prefix: 'GAP B' },
  { name: 'GAP C: Automation Dual Visibility', prefix: 'GAP C' },
  { name: 'GAP D: Forecast Immutability', prefix: 'GAP D' },
  { name: 'GAP E: Scope Versioning', prefix: 'GAP E' },
  { name: 'GAP F: Phase-4 Boundary Guards', prefix: 'GAP F' },
  { name: 'BYPASS PREVENTION', prefix: 'BYPASS' },
];

gaps.forEach((gap) => {
  const gapTests = results.filter((r) => r.name.startsWith(gap.prefix));
  const gapPassed = gapTests.filter((r) => r.passed).length;
  const gapTotal = gapTests.length;
  const status = gapPassed === gapTotal ? '✓ SEALED' : `✗ ${gapPassed}/${gapTotal}`;
  console.log(`${gap.name}: ${status}`);
});

console.log('\n' + '='.repeat(80) + '\n');

process.exit(failedTests.length > 0 ? 1 : 0);
