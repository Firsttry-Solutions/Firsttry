/**
 * Test: Run Ledgers - Execution Tracking & Org Index
 * PHASE 3: Verify ledger write/read operations and org discovery
 */

import {
  record_daily_attempt,
  record_daily_success,
  record_weekly_attempt,
  record_weekly_success,
  record_last_error,
  get_daily_last_success,
  get_weekly_last_success,
  add_org_to_index,
  get_all_orgs,
  setMockApi,
} from '../src/run_ledgers';

// Mock storage
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

// Set mock BEFORE any tests run
setMockApi(mockApi);

async function runTests() {
  console.log('=== Test: Run Ledgers ===\n');

  let passCount = 0;
  let totalCount = 0;

  // Test 1: record_daily_attempt writes timestamp
  totalCount++;
  try {
    mockStorage.clear();

    const now = '2025-12-19T01:30:00Z';
    await record_daily_attempt('org1', now);

    const key = 'runs/org1/daily/last_attempt_at';
    const value = mockStorage.get(key);

    if (value === now) {
      console.log('✓ Test 1: record_daily_attempt writes correct timestamp');
      passCount++;
    } else {
      console.log(`✗ Test 1 FAILED: Expected ${now}, got ${value}`);
    }
  } catch (error) {
    console.log(`✗ Test 1 ERROR: ${error}`);
  }

  // Test 2: record_daily_success writes timestamp
  totalCount++;
  try {
    mockStorage.clear();

    const now = '2025-12-19T01:35:00Z';
    await record_daily_success('org1', now);

    const key = 'runs/org1/daily/last_success_at';
    const value = mockStorage.get(key);

    if (value === now) {
      console.log('✓ Test 2: record_daily_success writes correct timestamp');
      passCount++;
    } else {
      console.log(`✗ Test 2 FAILED: Expected ${now}, got ${value}`);
    }
  } catch (error) {
    console.log(`✗ Test 2 ERROR: ${error}`);
  }

  // Test 3: get_daily_last_success retrieves timestamp
  totalCount++;
  try {
    mockStorage.clear();
    const now = '2025-12-19T01:35:00Z';
    mockStorage.set('runs/org1/daily/last_success_at', now);

    const result = await get_daily_last_success('org1');

    if (result === now) {
      console.log('✓ Test 3: get_daily_last_success retrieves timestamp');
      passCount++;
    } else {
      console.log(`✗ Test 3 FAILED: Expected ${now}, got ${result}`);
    }
  } catch (error) {
    console.log(`✗ Test 3 ERROR: ${error}`);
  }

  // Test 4: record_weekly_attempt writes timestamp
  totalCount++;
  try {
    mockStorage.clear();

    const now = '2025-12-22T02:30:00Z';
    await record_weekly_attempt('org1', now);

    const key = 'runs/org1/weekly/last_attempt_at';
    const value = mockStorage.get(key);

    if (value === now) {
      console.log('✓ Test 4: record_weekly_attempt writes correct timestamp');
      passCount++;
    } else {
      console.log(`✗ Test 4 FAILED: Expected ${now}, got ${value}`);
    }
  } catch (error) {
    console.log(`✗ Test 4 ERROR: ${error}`);
  }

  // Test 5: record_last_error redacts to 300 chars
  totalCount++;
  try {
    mockStorage.clear();

    const longError = 'x'.repeat(500);
    const now = '2025-12-19T01:30:00Z';
    await record_last_error('org1', longError, now);

    const key = 'runs/org1/last_error';
    const value = mockStorage.get(key);

    if (value && value.message && value.message.length <= 300) {
      console.log('✓ Test 5: record_last_error redacts to max 300 chars');
      passCount++;
    } else {
      console.log(`✗ Test 5 FAILED: Error length ${value?.message?.length}, expected <= 300`);
    }
  } catch (error) {
    console.log(`✗ Test 5 ERROR: ${error}`);
  }

  // Test 6: add_org_to_index deduplicates
  totalCount++;
  try {
    mockStorage.clear();

    await add_org_to_index('org1');
    await add_org_to_index('org2');
    await add_org_to_index('org1'); // Duplicate

    const orgs = await get_all_orgs();

    if (orgs.includes('org1') && orgs.includes('org2') && orgs.length === 2) {
      console.log('✓ Test 6: add_org_to_index deduplicates');
      passCount++;
    } else {
      console.log(`✗ Test 6 FAILED: Expected [org1, org2], got ${JSON.stringify(orgs)}`);
    }
  } catch (error) {
    console.log(`✗ Test 6 ERROR: ${error}`);
  }

  // Test 7: get_all_orgs returns sorted list
  totalCount++;
  try {
    mockStorage.clear();

    await add_org_to_index('zebra-org');
    await add_org_to_index('alpha-org');
    await add_org_to_index('beta-org');

    const orgs = await get_all_orgs();

    if (
      orgs[0] === 'alpha-org' &&
      orgs[1] === 'beta-org' &&
      orgs[2] === 'zebra-org'
    ) {
      console.log('✓ Test 7: get_all_orgs returns sorted list');
      passCount++;
    } else {
      console.log(`✗ Test 7 FAILED: Expected sorted list, got ${JSON.stringify(orgs)}`);
    }
  } catch (error) {
    console.log(`✗ Test 7 ERROR: ${error}`);
  }

  // Test 8: get_daily_last_success returns null if never run
  totalCount++;
  try {
    mockStorage.clear();

    const result = await get_daily_last_success('never-run-org');

    if (result === null) {
      console.log('✓ Test 8: get_daily_last_success returns null if never run');
      passCount++;
    } else {
      console.log(`✗ Test 8 FAILED: Expected null, got ${result}`);
    }
  } catch (error) {
    console.log(`✗ Test 8 ERROR: ${error}`);
  }

  console.log(`\n${passCount}/${totalCount} tests passed\n`);

  if (passCount === totalCount) {
    console.log('✅ All run ledger tests PASS\n');
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
