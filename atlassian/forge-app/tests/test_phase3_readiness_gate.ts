/**
 * Test: Readiness Gate - First Report Eligibility
 * PHASE 3: Verify readiness status determination
 */

import { ReadinessStatus, evaluate_readiness, write_readiness_status, setMockApi } from '../src/readiness_gate';

// Mock storage for testing
const mockStorage: Map<string, any> = new Map();

// Mock api
const mockApi = {
  asApp: () => ({
    requestStorage: async (fn: (storage: any) => Promise<any>) => {
      const storage = {
        get: async (key: string) => mockStorage.get(key),
        set: async (key: string, value: any) => {
          mockStorage.set(key, value);
        },
      };
      return fn(storage);
    },
  }),
};

// Set mock BEFORE tests run
setMockApi(mockApi);

async function runTests() {
  console.log('=== Test: Readiness Gate ===\n');

  let passCount = 0;
  let totalCount = 0;

  // Test 1: Missing install_at → BLOCKED_MISSING_INSTALL_AT
  totalCount++;
  try {
    mockStorage.clear();
    const result = await evaluate_readiness('test-org', '2025-12-19T10:00:00Z');
    if (result.status === ReadinessStatus.BLOCKED_MISSING_INSTALL_AT) {
      console.log('✓ Test 1: Missing install_at → BLOCKED_MISSING_INSTALL_AT');
      passCount++;
    } else {
      console.log(`✗ Test 1 FAILED: Expected ${ReadinessStatus.BLOCKED_MISSING_INSTALL_AT}, got ${result.status}`);
    }
  } catch (error) {
    console.log(`✗ Test 1 ERROR: ${error}`);
  }

  // Test 2: install_at > 12h ago → READY_BY_TIME_WINDOW
  totalCount++;
  try {
    mockStorage.clear();
    // Install 13 hours ago
    const installTime = new Date(new Date().getTime() - 13 * 60 * 60 * 1000);
    mockStorage.set('coverage/test-org/install_at', installTime.toISOString());

    const result = await evaluate_readiness('test-org', new Date().toISOString());
    if (result.status === ReadinessStatus.READY_BY_TIME_WINDOW) {
      console.log('✓ Test 2: install_at > 12h ago → READY_BY_TIME_WINDOW');
      passCount++;
    } else {
      console.log(`✗ Test 2 FAILED: Expected ${ReadinessStatus.READY_BY_TIME_WINDOW}, got ${result.status}`);
    }
  } catch (error) {
    console.log(`✗ Test 2 ERROR: ${error}`);
  }

  // Test 3: install_at < 12h ago → WAITING_FOR_DATA_WINDOW (if events < 10)
  totalCount++;
  try {
    mockStorage.clear();
    // Install 5 hours ago
    const installTime = new Date(new Date().getTime() - 5 * 60 * 60 * 1000);
    mockStorage.set('coverage/test-org/install_at', installTime.toISOString());

    const result = await evaluate_readiness('test-org', new Date().toISOString());
    if (result.status === ReadinessStatus.WAITING_FOR_DATA_WINDOW) {
      console.log('✓ Test 3: install_at < 12h ago & events < 10 → WAITING_FOR_DATA_WINDOW');
      passCount++;
    } else {
      console.log(`✗ Test 3 FAILED: Expected ${ReadinessStatus.WAITING_FOR_DATA_WINDOW}, got ${result.status}`);
    }
  } catch (error) {
    console.log(`✗ Test 3 ERROR: ${error}`);
  }

  // Test 4: Manual override flag set → READY_BY_MANUAL_OVERRIDE
  totalCount++;
  try {
    mockStorage.clear();
    mockStorage.set('report/test-org/manual_override', true);

    const result = await evaluate_readiness('test-org', new Date().toISOString());
    if (result.status === ReadinessStatus.READY_BY_MANUAL_OVERRIDE) {
      console.log('✓ Test 4: Manual override flag → READY_BY_MANUAL_OVERRIDE');
      passCount++;
    } else {
      console.log(`✗ Test 4 FAILED: Expected ${ReadinessStatus.READY_BY_MANUAL_OVERRIDE}, got ${result.status}`);
    }
  } catch (error) {
    console.log(`✗ Test 4 ERROR: ${error}`);
  }

  // Test 5: Event count >= 10 → READY_BY_MIN_EVENTS
  totalCount++;
  try {
    mockStorage.clear();
    mockStorage.set('coverage/test-org/total_events_counted', 15);

    const result = await evaluate_readiness('test-org', '2025-12-19T10:00:00Z');
    if (result.status === ReadinessStatus.READY_BY_MIN_EVENTS) {
      console.log('✓ Test 5: Event count >= 10 → READY_BY_MIN_EVENTS');
      passCount++;
    } else {
      console.log(`✗ Test 5 FAILED: Expected ${ReadinessStatus.READY_BY_MIN_EVENTS}, got ${result.status}`);
    }
  } catch (error) {
    console.log(`✗ Test 5 ERROR: ${error}`);
  }

  // Test 6: write_readiness_status writes all 3 keys
  totalCount++;
  try {
    mockStorage.clear();
    await write_readiness_status(
      'test-org',
      ReadinessStatus.READY_BY_MIN_EVENTS,
      'Test reason',
      '2025-12-19T10:00:00Z'
    );

    const status = mockStorage.get('report/test-org/first_ready_status');
    const reason = mockStorage.get('report/test-org/first_ready_reason');
    const checked = mockStorage.get('report/test-org/first_ready_checked_at');

    if (
      status === ReadinessStatus.READY_BY_MIN_EVENTS &&
      reason === 'Test reason' &&
      checked === '2025-12-19T10:00:00Z'
    ) {
      console.log('✓ Test 6: write_readiness_status writes all keys');
      passCount++;
    } else {
      console.log('✗ Test 6 FAILED: Not all keys written correctly');
    }
  } catch (error) {
    console.log(`✗ Test 6 ERROR: ${error}`);
  }

  console.log(`\n${passCount}/${totalCount} tests passed\n`);

  if (passCount === totalCount) {
    console.log('✅ All readiness gate tests PASS\n');
    process.exit(0);
  } else {
    console.log('❌ Some tests FAILED\n');
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('Test harness error:', error);
  process.exit(1);
});
