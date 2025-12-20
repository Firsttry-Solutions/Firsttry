/**
 * PHASE 4 DISCLOSURE HARDENING TESTS
 * 
 * Verify that all 5 gaps in user-facing disclosure have been closed:
 * 1. Zero-value misinterpretation (mandatory "INSUFFICIENT HISTORICAL WINDOW" labels)
 * 2. Automation rule visibility illusion (explicit "execution not yet measurable" banner)
 * 3. Forecast trust leakage (ESTIMATED + window + confidence + disclaimer)
 * 4. Marketplace reviewer trap (static scope transparency disclosure)
 * 5. Confidence signal absence (completeness%, window, confidence on all metrics)
 */

import {
  DataQualityIndicator,
  ConfidenceLevel,
  ZeroValueReason,
  AutomationVisibilityDisclosure,
  ForecastTemplate,
  ScopeTransparencyDisclosure,
  createInsufficientWindowDisclosure,
  createAutomationVisibilityDisclosure,
  createForecastWithMandatoryDisclosure,
  createScopeTransparencyDisclosure,
} from '../src/disclosure_types';

import {
  CoverageMetrics,
  computeCoverageMetrics,
  wrapCoverageMetricsWithDisclosure,
  computeProjectCoverageMatrix,
  wrapProjectCoverageWithDisclosure,
  computeFieldCoverageMatrix,
  wrapFieldCoverageWithDisclosure,
  computeAutomationRuleCoverageMatrix,
  wrapAutomationRuleCoverageWithDisclosure,
} from '../src/coverage_matrix';

// ============================================================================
// Test Helpers
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
// GAP 1: Zero-Value Misinterpretation Tests
// ============================================================================

test('GAP 1.1: Insufficient window disclosure helper creates correct structure', () => {
  const disclosure = createInsufficientWindowDisclosure('Field Usage', 1);

  assert(disclosure.completeness_percent === 0, 'Completeness should be 0 for zero value');
  assert(
    disclosure.confidence_level === ConfidenceLevel.INSUFFICIENT_DATA,
    'Confidence should be INSUFFICIENT_DATA'
  );
  assert(
    disclosure.zero_value_reason === ZeroValueReason.INSUFFICIENT_HISTORICAL_WINDOW,
    'Reason should be INSUFFICIENT_HISTORICAL_WINDOW'
  );
  assert(
    disclosure.disclosure_text.includes('INSUFFICIENT HISTORICAL WINDOW'),
    'Text must contain "INSUFFICIENT HISTORICAL WINDOW"'
  );
  assert(
    disclosure.observation_window_days === 1,
    'Observation window should be 1 day'
  );
});

test('GAP 1.2: Coverage metrics with zero values get disclosed', () => {
  // Create a mock coverage metrics with all zeros (typical Phase 4)
  const metrics: CoverageMetrics = {
    org: 'test-org',
    snapshotTimestamp: new Date().toISOString(),
    projectCount: 0,
    issueTypeCount: 0,
    statusCount: 0,
    fieldCount: 0,
    fieldCounts: { custom: 0, system: 0 },
    issueEventCount: 0,
    automationRuleCount: 0,
    automationRulesEnabled: 0,
  };

  const disclosed = wrapCoverageMetricsWithDisclosure(metrics, 1);

  // Verify every zero value has disclosure
  assert(disclosed.projectCount_disclosure.zero_value_reason === ZeroValueReason.INSUFFICIENT_HISTORICAL_WINDOW,
    'projectCount zero must have reason');
  assert(disclosed.fieldCount_disclosure.zero_value_reason === ZeroValueReason.INSUFFICIENT_HISTORICAL_WINDOW,
    'fieldCount zero must have reason');
  assert(disclosed.automationRuleCount_disclosure.zero_value_reason === ZeroValueReason.INSUFFICIENT_HISTORICAL_WINDOW,
    'automationRuleCount zero must have reason');
  assert(disclosed.automationRulesEnabled_disclosure.zero_value_reason === ZeroValueReason.MEASUREMENT_NOT_YET_ENABLED,
    'automationRulesEnabled zero must have MEASUREMENT_NOT_YET_ENABLED reason');

  // Verify all disclosure texts explain the zero
  assert(
    disclosed.projectCount_disclosure.disclosure_text.includes('not yet measured'),
    'projectCount disclosure must explain measurement limitation'
  );
  assert(
    disclosed.fieldCount_disclosure.disclosure_text.includes('not yet measured'),
    'fieldCount disclosure must explain measurement limitation'
  );
  assert(
    disclosed.automationRuleCount_disclosure.disclosure_text.includes('not yet measured'),
    'automationRuleCount disclosure must explain measurement limitation'
  );
});

test('GAP 1.3: Project coverage zeros get disclosed with observation window', () => {
  const matrix = computeProjectCoverageMatrix('PROJ', 'PROJ', 0, 0, 0);
  const disclosed = wrapProjectCoverageWithDisclosure(matrix, 7);

  assert(
    disclosed.issues_missing_fields_disclosure.observation_window_days === 7,
    'Observation window should be 7 days'
  );
  assert(
    disclosed.issues_missing_fields_disclosure.zero_value_reason === ZeroValueReason.INSUFFICIENT_HISTORICAL_WINDOW,
    'Zero missing fields must have reason'
  );
  assert(
    disclosed.issues_missing_fields_disclosure.disclosure_text.includes('7 day'),
    'Disclosure must mention observation window'
  );
});

test('GAP 1.4: Field coverage zeros get disclosed', () => {
  const matrix = computeFieldCoverageMatrix('FIELD-123', 'Custom Field', true, 0);
  const disclosed = wrapFieldCoverageWithDisclosure(matrix, 3);

  assert(disclosed.population_disclosure.completeness_percent === 0, 'Completeness should be 0');
  assert(
    disclosed.population_disclosure.zero_value_reason === ZeroValueReason.INSUFFICIENT_HISTORICAL_WINDOW,
    'Zero population must have reason'
  );
  assert(
    disclosed.population_disclosure.disclosure_text.includes('Field population will be measured'),
    'Must explain that measurement will happen later'
  );
});

// ============================================================================
// GAP 2: Automation Visibility Illusion Tests
// ============================================================================

test('GAP 2.1: Automation visibility disclosure helper creates correct structure', () => {
  const disclosure = createAutomationVisibilityDisclosure('RULE-123', 'Auto Rule', true);

  assert(disclosure.rule_id === 'RULE-123', 'Rule ID should be set');
  assert(disclosure.rule_metadata.visibility === 'VISIBLE', 'Rule should be VISIBLE');
  assert(disclosure.rule_metadata.enabled === true, 'Rule should show enabled status');
  assert(
    disclosure.execution_data.visibility === 'NOT_YET_MEASURABLE',
    'Execution should be NOT_YET_MEASURABLE'
  );
  assert(
    disclosure.execution_data.reason === 'PHASE_4_METADATA_ONLY',
    'Reason should be PHASE_4_METADATA_ONLY'
  );
  assert(
    disclosure.execution_data.disclosure.includes('not yet available'),
    'Must explicitly state execution data not available'
  );
});

test('GAP 2.2: Automation rule coverage shows "execution not measurable" banner', () => {
  const matrix = computeAutomationRuleCoverageMatrix(
    'RULE-456',
    'Email Notifier',
    true,
    new Date().toISOString(),
    0
  );
  const disclosed = wrapAutomationRuleCoverageWithDisclosure(matrix, 5);

  assert(
    disclosed.visibility_disclosure.execution_data.visibility === 'NOT_YET_MEASURABLE',
    'Must explicitly mark execution as not yet measurable'
  );
  assert(
    disclosed.execution_disclosure.confidence_level === ConfidenceLevel.INSUFFICIENT_DATA,
    'Execution data confidence must be INSUFFICIENT_DATA'
  );
  assert(
    disclosed.execution_disclosure.disclosure_text.includes('not measurable'),
    'Disclosure must state execution is not measurable'
  );
  assert(
    disclosed.execution_disclosure.disclosure_text.includes('Phase 5+'),
    'Must explain measurement comes later'
  );
});

// ============================================================================
// GAP 3: Forecast Trust Leakage Tests
// ============================================================================

test('GAP 3.1: Forecast template has mandatory ESTIMATED label', () => {
  const forecast = createForecastWithMandatoryDisclosure(42, ConfidenceLevel.MEDIUM, 30);

  assert(forecast.forecast_type === 'ESTIMATED', 'Must be labeled ESTIMATED');
  assert(forecast.value === 42, 'Value should be preserved');
});

test('GAP 3.2: Forecast template has mandatory time window', () => {
  const forecast = createForecastWithMandatoryDisclosure(100, ConfidenceLevel.MEDIUM, 30);

  assert(forecast.forecast_window.days_ahead === 30, 'Window should be 30 days');
  assert(forecast.forecast_window.start_date !== undefined, 'Start date must be set');
  assert(forecast.forecast_window.end_date !== undefined, 'End date must be set');
});

test('GAP 3.3: Forecast template has mandatory confidence level', () => {
  const forecastLow = createForecastWithMandatoryDisclosure(50, ConfidenceLevel.LOW, 14);
  const forecastMedium = createForecastWithMandatoryDisclosure(60, ConfidenceLevel.MEDIUM, 30);

  assert(forecastLow.confidence_level === ConfidenceLevel.LOW, 'LOW confidence should be preserved');
  assert(forecastMedium.confidence_level === ConfidenceLevel.MEDIUM, 'MEDIUM confidence should be preserved');
});

test('GAP 3.4: Forecast template has mandatory disclaimer', () => {
  const forecast = createForecastWithMandatoryDisclosure(75, ConfidenceLevel.LOW, 7);

  assert(forecast.disclaimer !== undefined, 'Disclaimer must be present');
  assert(forecast.disclaimer.length > 0, 'Disclaimer must not be empty');
  assert(
    forecast.disclaimer.includes('estimate') || forecast.disclaimer.includes('exploratory'),
    'Disclaimer must warn about estimation'
  );
});

// ============================================================================
// GAP 4: Marketplace Reviewer Trap Tests
// ============================================================================

test('GAP 4.1: Scope transparency disclosure exists and is complete', () => {
  const disclosure = createScopeTransparencyDisclosure();

  assert(
    disclosure.title === 'Why FirstTry Collects Metadata Before Analyzing Behavior',
    'Title should match exactly'
  );
  assert(disclosure.body.length > 100, 'Body should have substantial explanation');
  assert(
    disclosure.body.includes('Phase 4'),
    'Body must reference Phase 4 explicitly'
  );
  assert(
    disclosure.body.includes('metadata'),
    'Body must explain metadata collection'
  );
  assert(
    disclosure.body.includes('no behavioral analysis'),
    'Body must state clearly: no behavioral analysis yet'
  );
});

test('GAP 4.2: Scope transparency explains why metadata-first approach', () => {
  const disclosure = createScopeTransparencyDisclosure();

  assert(
    disclosure.why_metadata_first.length >= 4,
    'Must have at least 4 reasons'
  );
  assert(
    disclosure.why_metadata_first.some(r => r.includes('context')),
    'Must explain complete context need'
  );
  assert(
    disclosure.why_metadata_first.some(r => r.includes('Marketplace')),
    'Must address marketplace trust'
  );
  assert(
    disclosure.why_metadata_first.some(r => r.includes('audit')),
    'Must mention audit trail importance'
  );
});

test('GAP 4.3: Scope transparency is versioned', () => {
  const disclosure = createScopeTransparencyDisclosure();

  assert(disclosure.version === '1.0', 'Should have version 1.0');
  assert(disclosure.published_at !== undefined, 'Should have publication timestamp');
});

// ============================================================================
// GAP 5: Confidence Signal Absence Tests
// ============================================================================

test('GAP 5.1: DataQualityIndicator includes all required confidence fields', () => {
  const indicator: DataQualityIndicator = {
    completeness_percent: 75,
    observation_window_days: 30,
    confidence_level: ConfidenceLevel.MEDIUM,
    zero_value_reason: undefined,
    disclosure_text: 'Test disclosure',
    computed_at: new Date().toISOString(),
  };

  assert(indicator.completeness_percent !== undefined, 'Completeness must be present');
  assert(indicator.observation_window_days !== undefined, 'Window must be present');
  assert(indicator.confidence_level !== undefined, 'Confidence must be present');
  assert(indicator.disclosure_text !== undefined, 'Explanation must be present');
  assert(indicator.computed_at !== undefined, 'Timestamp must be present');
});

test('GAP 5.2: Confidence levels work for all metrics types', () => {
  // High confidence: enough data, enough time
  const highConfidence = wrapCoverageMetricsWithDisclosure(
    {
      org: 'test',
      snapshotTimestamp: new Date().toISOString(),
      projectCount: 5,
      issueTypeCount: 10,
      statusCount: 4,
      fieldCount: 30,
      fieldCounts: { custom: 15, system: 15 },
      issueEventCount: 1000,
      automationRuleCount: 20,
      automationRulesEnabled: 15,
    },
    30
  );

  assert(
    highConfidence.projectCount_disclosure.confidence_level === ConfidenceLevel.HIGH,
    'Non-zero values with long window should have HIGH confidence'
  );

  // Low confidence: short window
  const lowConfidence = wrapCoverageMetricsWithDisclosure(
    {
      org: 'test',
      snapshotTimestamp: new Date().toISOString(),
      projectCount: 5,
      issueTypeCount: 10,
      statusCount: 4,
      fieldCount: 0,
      fieldCounts: { custom: 0, system: 0 },
      issueEventCount: 0,
      automationRuleCount: 0,
      automationRulesEnabled: 0,
    },
    1
  );

  assert(
    lowConfidence.fieldCount_disclosure.confidence_level === ConfidenceLevel.INSUFFICIENT_DATA,
    'Zero values should have INSUFFICIENT_DATA confidence'
  );
});

test('GAP 5.3: Observation window is always included in disclosure', () => {
  const disclosed = wrapCoverageMetricsWithDisclosure(
    {
      org: 'test',
      snapshotTimestamp: new Date().toISOString(),
      projectCount: 0,
      issueTypeCount: 0,
      statusCount: 0,
      fieldCount: 0,
      fieldCounts: { custom: 0, system: 0 },
      issueEventCount: 0,
      automationRuleCount: 0,
      automationRulesEnabled: 0,
    },
    14
  );

  assert(disclosed.observation_window_days === 14, 'Window should be 14 days');
  assert(disclosed.projectCount_disclosure.observation_window_days === 14, 'Every disclosure must include window');
  assert(disclosed.fieldCount_disclosure.observation_window_days === 14, 'Every disclosure must include window');
  assert(disclosed.automationRuleCount_disclosure.observation_window_days === 14, 'Every disclosure must include window');
});

// ============================================================================
// Integration Tests: Verify all gaps closed together
// ============================================================================

test('INTEGRATION: No zero metric lacks explanation', () => {
  const disclosed = wrapCoverageMetricsWithDisclosure(
    {
      org: 'test',
      snapshotTimestamp: new Date().toISOString(),
      projectCount: 0,
      issueTypeCount: 0,
      statusCount: 0,
      fieldCount: 0,
      fieldCounts: { custom: 0, system: 0 },
      issueEventCount: 0,
      automationRuleCount: 0,
      automationRulesEnabled: 0,
    },
    7
  );

  // Every zero must have a disclosure with reason
  [
    disclosed.projectCount_disclosure,
    disclosed.fieldCount_disclosure,
    disclosed.automationRuleCount_disclosure,
  ].forEach((disclosure) => {
    assert(disclosure.zero_value_reason !== undefined, 'Zero must have reason');
    assert(disclosure.disclosure_text.length > 0, 'Zero must have explanation');
    assert(
      disclosure.disclosure_text.includes('Phase'),
      'Explanation must reference Phase system'
    );
  });
});

test('INTEGRATION: Automation rules show visibility AND execution disclosure', () => {
  const matrix = computeAutomationRuleCoverageMatrix(
    'RULE-999',
    'Test Rule',
    true,
    new Date().toISOString(),
    0
  );
  const disclosed = wrapAutomationRuleCoverageWithDisclosure(matrix, 10);

  // Must have BOTH visibility AND execution disclosures
  assert(disclosed.visibility_disclosure !== undefined, 'Must have visibility disclosure');
  assert(disclosed.execution_disclosure !== undefined, 'Must have execution disclosure');

  // They must explain different things
  assert(
    disclosed.visibility_disclosure.rule_metadata.visibility === 'VISIBLE',
    'Visibility should show rule is VISIBLE'
  );
  assert(
    disclosed.execution_disclosure.zero_value_reason === ZeroValueReason.MEASUREMENT_NOT_YET_ENABLED,
    'Execution should explain measurement not enabled'
  );
});

test('INTEGRATION: All disclosure types export correctly', () => {
  // This test verifies the module exports work
  const window = createInsufficientWindowDisclosure('Test', 1);
  const visibility = createAutomationVisibilityDisclosure('R1', 'Rule', false);
  const forecast = createForecastWithMandatoryDisclosure(50, ConfidenceLevel.MEDIUM, 30);
  const scope = createScopeTransparencyDisclosure();

  assert(window !== undefined, 'Window disclosure must export');
  assert(visibility !== undefined, 'Visibility disclosure must export');
  assert(forecast !== undefined, 'Forecast must export');
  assert(scope !== undefined, 'Scope disclosure must export');
});

// ============================================================================
// Report Results
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('PHASE 4 DISCLOSURE HARDENING TEST RESULTS');
console.log('='.repeat(80));

const passed = results.filter((r) => r.passed).length;
const total = results.length;
const failedTests = results.filter((r) => !r.passed);

console.log(`\nTests Passed: ${passed}/${total}`);

if (failedTests.length > 0) {
  console.log('\nFailed Tests:');
  failedTests.forEach((r) => {
    console.log(`  - ${r.name}: ${r.error}`);
  });
}

console.log('\n' + '='.repeat(80));
console.log('GAP CLOSURE SUMMARY');
console.log('='.repeat(80));

const gaps = [
  {
    name: 'GAP 1: Zero-Value Misinterpretation',
    tests: results.filter((r) => r.name.startsWith('GAP 1')),
  },
  {
    name: 'GAP 2: Automation Visibility Illusion',
    tests: results.filter((r) => r.name.startsWith('GAP 2')),
  },
  {
    name: 'GAP 3: Forecast Trust Leakage',
    tests: results.filter((r) => r.name.startsWith('GAP 3')),
  },
  {
    name: 'GAP 4: Marketplace Reviewer Trap',
    tests: results.filter((r) => r.name.startsWith('GAP 4')),
  },
  {
    name: 'GAP 5: Confidence Signal Absence',
    tests: results.filter((r) => r.name.startsWith('GAP 5')),
  },
];

gaps.forEach((gap) => {
  const gapPassed = gap.tests.filter((r) => r.passed).length;
  const gapTotal = gap.tests.length;
  const status = gapPassed === gapTotal ? '✓ CLOSED' : `✗ ${gapPassed}/${gapTotal}`;
  console.log(`${gap.name}: ${status}`);
});

console.log('\n' + '='.repeat(80));

// Exit with appropriate code
process.exit(failedTests.length > 0 ? 1 : 0);
