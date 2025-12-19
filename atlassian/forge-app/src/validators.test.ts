/**
 * PHASE 1 Test Suite - Event Ingestion Validation & Storage
 * Tests for: schema validation, forbidden fields, token auth, idempotency, sharding
 *
 * Run with: npm test (after configuring test runner)
 */

import { validateEventV1 } from '../src/validators';

/**
 * Test helper: Create valid EventV1
 */
function createValidEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: 'event.v1',
    event_id: 'a1b2c3d4-e5f6-4789-a1b2-c3d4e5f6a1b2',
    timestamp: '2025-12-19T08:45:30.123Z',
    org_key: 'myorg',
    repo_key: 'myrepo',
    profile: 'strict',
    gates: ['gate1', 'gate2'],
    duration_ms: 1500,
    status: 'success',
    cache_hit: true,
    retry_count: 0,
    ...overrides,
  };
}

/**
 * Test Suite
 */
export const testSuite = {
  /**
   * TEST 1: Valid event passes validation
   */
  'Valid EventV1 passes validation': () => {
    const event = createValidEvent();
    const error = validateEventV1(event);
    if (error !== null) {
      throw new Error(`Expected valid event to pass, got error: ${JSON.stringify(error)}`);
    }
    console.log('✓ Valid EventV1 passes validation');
  },

  /**
   * TEST 2: Unknown field is rejected
   */
  'Unknown field is rejected': () => {
    const event = createValidEvent({ unknown_field: 'value' });
    const error = validateEventV1(event);
    if (!error || error.code !== 'INVALID_FIELDS') {
      throw new Error(`Expected INVALID_FIELDS error, got: ${JSON.stringify(error)}`);
    }
    if (!error.fields || !error.fields.unknown_field) {
      throw new Error(`Expected unknown_field error, got: ${JSON.stringify(error.fields)}`);
    }
    console.log('✓ Unknown field is rejected');
  },

  /**
   * TEST 3: Forbidden field 'log' is rejected
   */
  'Forbidden field "log" is rejected': () => {
    const event = createValidEvent({ log: 'some log' });
    const error = validateEventV1(event);
    if (!error || !error.fields || !error.fields.log) {
      throw new Error(`Expected log field to be rejected, got: ${JSON.stringify(error)}`);
    }
    console.log('✓ Forbidden field "log" is rejected');
  },

  /**
   * TEST 4: Forbidden field 'secrets' is rejected
   */
  'Forbidden field "secrets" is rejected': () => {
    const event = createValidEvent({ secrets: { api_key: 'xxx' } });
    const error = validateEventV1(event);
    if (!error || !error.fields || !error.fields.secrets) {
      throw new Error(`Expected secrets field to be rejected, got: ${JSON.stringify(error)}`);
    }
    console.log('✓ Forbidden field "secrets" is rejected');
  },

  /**
   * TEST 5: Forbidden field 'token' is rejected
   */
  'Forbidden field "token" is rejected': () => {
    const event = createValidEvent({ token: 'Bearer xxx' });
    const error = validateEventV1(event);
    if (!error || !error.fields || !error.fields.token) {
      throw new Error(`Expected token field to be rejected, got: ${JSON.stringify(error)}`);
    }
    console.log('✓ Forbidden field "token" is rejected');
  },

  /**
   * TEST 6: Reserved field '__internal' is rejected
   */
  'Reserved field starting with __ is rejected': () => {
    const event = createValidEvent({ __internal: 'value' });
    const error = validateEventV1(event);
    if (!error || !error.fields || !error.fields.__internal) {
      throw new Error(`Expected __internal field to be rejected, got: ${JSON.stringify(error)}`);
    }
    console.log('✓ Reserved field starting with __ is rejected');
  },

  /**
   * TEST 7: Missing required field 'event_id'
   */
  'Missing required field "event_id" is rejected': () => {
    const event = createValidEvent();
    delete event.event_id;
    const error = validateEventV1(event);
    if (!error || !error.fields || !error.fields.event_id) {
      throw new Error(`Expected event_id to be required, got: ${JSON.stringify(error)}`);
    }
    console.log('✓ Missing required field "event_id" is rejected');
  },

  /**
   * TEST 8: Invalid UUID format for event_id
   */
  'Invalid UUID format for event_id is rejected': () => {
    const event = createValidEvent({ event_id: 'not-a-uuid' });
    const error = validateEventV1(event);
    if (!error || !error.fields || !error.fields.event_id) {
      throw new Error(`Expected invalid UUID to be rejected, got: ${JSON.stringify(error)}`);
    }
    console.log('✓ Invalid UUID format for event_id is rejected');
  },

  /**
   * TEST 9: Invalid ISO 8601 timestamp
   */
  'Invalid ISO 8601 timestamp is rejected': () => {
    const event = createValidEvent({ timestamp: '2025-12-19 08:45:30' });
    const error = validateEventV1(event);
    if (!error || !error.fields || !error.fields.timestamp) {
      throw new Error(`Expected invalid timestamp to be rejected, got: ${JSON.stringify(error)}`);
    }
    console.log('✓ Invalid ISO 8601 timestamp is rejected');
  },

  /**
   * TEST 10: Empty org_key is rejected
   */
  'Empty org_key is rejected': () => {
    const event = createValidEvent({ org_key: '' });
    const error = validateEventV1(event);
    if (!error || !error.fields || !error.fields.org_key) {
      throw new Error(`Expected empty org_key to be rejected, got: ${JSON.stringify(error)}`);
    }
    console.log('✓ Empty org_key is rejected');
  },

  /**
   * TEST 11: Invalid profile value
   */
  'Invalid profile value is rejected': () => {
    const event = createValidEvent({ profile: 'invalid' });
    const error = validateEventV1(event);
    if (!error || !error.fields || !error.fields.profile) {
      throw new Error(`Expected invalid profile to be rejected, got: ${JSON.stringify(error)}`);
    }
    console.log('✓ Invalid profile value is rejected');
  },

  /**
   * TEST 12: gates with empty string
   */
  'Gates with empty string is rejected': () => {
    const event = createValidEvent({ gates: ['gate1', ''] });
    const error = validateEventV1(event);
    if (!error || !error.fields || !error.fields.gates) {
      throw new Error(`Expected empty gate to be rejected, got: ${JSON.stringify(error)}`);
    }
    console.log('✓ Gates with empty string is rejected');
  },

  /**
   * TEST 13: Negative duration_ms
   */
  'Negative duration_ms is rejected': () => {
    const event = createValidEvent({ duration_ms: -1 });
    const error = validateEventV1(event);
    if (!error || !error.fields || !error.fields.duration_ms) {
      throw new Error(`Expected negative duration_ms to be rejected, got: ${JSON.stringify(error)}`);
    }
    console.log('✓ Negative duration_ms is rejected');
  },

  /**
   * TEST 14: Invalid status value
   */
  'Invalid status value is rejected': () => {
    const event = createValidEvent({ status: 'pending' });
    const error = validateEventV1(event);
    if (!error || !error.fields || !error.fields.status) {
      throw new Error(`Expected invalid status to be rejected, got: ${JSON.stringify(error)}`);
    }
    console.log('✓ Invalid status value is rejected');
  },

  /**
   * TEST 15: Non-boolean cache_hit
   */
  'Non-boolean cache_hit is rejected': () => {
    const event = createValidEvent({ cache_hit: 'true' });
    const error = validateEventV1(event);
    if (!error || !error.fields || !error.fields.cache_hit) {
      throw new Error(`Expected non-boolean cache_hit to be rejected, got: ${JSON.stringify(error)}`);
    }
    console.log('✓ Non-boolean cache_hit is rejected');
  },

  /**
   * TEST 16: Invalid input type (not an object)
   */
  'Non-object input is rejected': () => {
    const error = validateEventV1('not-an-object');
    if (!error || error.code !== 'INVALID_TYPE') {
      throw new Error(`Expected INVALID_TYPE error, got: ${JSON.stringify(error)}`);
    }
    console.log('✓ Non-object input is rejected');
  },

  /**
   * TEST 17: Array input is rejected
   */
  'Array input is rejected': () => {
    const error = validateEventV1([]);
    if (!error || error.code !== 'INVALID_TYPE') {
      throw new Error(`Expected INVALID_TYPE error, got: ${JSON.stringify(error)}`);
    }
    console.log('✓ Array input is rejected');
  },

  /**
   * TEST 18: All status values allowed
   */
  'All allowed status values pass': () => {
    for (const status of ['success', 'fail']) {
      const event = createValidEvent({ status });
      const error = validateEventV1(event);
      if (error) {
        throw new Error(`Expected status "${status}" to pass, got error: ${JSON.stringify(error)}`);
      }
    }
    console.log('✓ All allowed status values pass');
  },

  /**
   * TEST 19: All profile values allowed
   */
  'All allowed profile values pass': () => {
    for (const profile of ['fast', 'strict', 'ci']) {
      const event = createValidEvent({ profile });
      const error = validateEventV1(event);
      if (error) {
        throw new Error(`Expected profile "${profile}" to pass, got error: ${JSON.stringify(error)}`);
      }
    }
    console.log('✓ All allowed profile values pass');
  },

  /**
   * TEST 20: Multiple forbidden fields caught
   */
  'Multiple forbidden fields are all caught': () => {
    const event = createValidEvent({
      log: 'value',
      secrets: 'value',
      token: 'value',
      stdout: 'value',
    });
    const error = validateEventV1(event);
    if (!error || !error.fields) {
      throw new Error(`Expected multiple field errors, got: ${JSON.stringify(error)}`);
    }
    const forbiddenCount = Object.keys(error.fields).filter(
      (k) => error.fields![k].includes('Forbidden')
    ).length;
    if (forbiddenCount < 4) {
      throw new Error(`Expected 4 forbidden fields, got ${forbiddenCount}: ${JSON.stringify(error.fields)}`);
    }
    console.log('✓ Multiple forbidden fields are all caught');
  },
};

/**
 * Run all tests
 */
export function runAllTests(): void {
  const results = {
    passed: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const [testName, testFn] of Object.entries(testSuite)) {
    try {
      testFn();
      results.passed++;
    } catch (error) {
      results.failed++;
      results.errors.push(`${testName}: ${error}`);
    }
  }

  console.log(`\n✅ Test Results: ${results.passed} passed, ${results.failed} failed`);
  if (results.failed > 0) {
    console.error('\n❌ Failures:');
    results.errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
}

// Run tests if this is the entry point
if (require.main === module) {
  runAllTests();
}
