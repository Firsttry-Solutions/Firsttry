/**
 * Test: Daily Pipeline - No Data Case
 * PHASE 3: Verify ledgers written even when no events exist
 */

import { process_org_daily, setMockApi } from '../src/pipelines/daily_pipeline';
import { setMockApi as setLedgerMockApi } from '../src/run_ledgers';

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

// Set mocks BEFORE any tests run
setMockApi(mockApi);
setLedgerMockApi(mockApi);

async function runTests() {
  console.log('=== Test: Daily Pipeline - No Data ===\n');

  let passCount = 0;
  let totalCount = 0;

  // Test 1: process_org_daily with no last success, no events
  totalCount++;
  try {
    mockStorage.clear();

    // Don't set any events
    const now = '2025-12-19T01:30:00Z';
    await process_org_daily('test-org', now);

    const dailyAttempt = mockStorage.get('runs/test-org/daily/last_attempt_at');
    const dailySuccess = mockStorage.get('runs/test-org/daily/last_success_at');

    if (dailyAttempt && dailySuccess) {
      console.log('✓ Test 1: Ledgers written (no events)');
      passCount++;
    } else {
      console.log('✗ Test 1 FAILED: Expected ledgers not written');
    }
  } catch (error) {
    console.log(`✗ Test 1 ERROR: ${error}`);
  }

  // Test 2: process_org_daily with previous failures, recovers and writes success
  totalCount++;
  try {
    mockStorage.clear();
    mockStorage.set('runs/test-org/daily/last_attempt_at', '2025-12-18T01:30:00Z');
    mockStorage.set('runs/test-org/daily/last_success_at', null);
    mockStorage.set('runs/test-org/last_error', 'Previous error');

    const now = '2025-12-19T01:30:00Z';
    await process_org_daily('test-org', now);

    const dailySuccess = mockStorage.get('runs/test-org/daily/last_success_at');
    const lastError = mockStorage.get('runs/test-org/last_error');

    if (dailySuccess && !lastError) {
      console.log('✓ Test 2: Recovery from previous failure, ledgers updated');
      passCount++;
    } else {
      console.log('✗ Test 2 FAILED: Recovery ledgers not correct');
    }
  } catch (error) {
    console.log(`✗ Test 2 ERROR: ${error}`);
  }

  // Test 3: process_org_daily always writes last_attempt_at
  totalCount++;
  try {
    mockStorage.clear();

    const now = '2025-12-19T02:15:00Z';
    await process_org_daily('test-org', now);

    const dailyAttempt = mockStorage.get('runs/test-org/daily/last_attempt_at');

    if (dailyAttempt) {
      console.log('✓ Test 3: last_attempt_at always written');
      passCount++;
    } else {
      console.log('✗ Test 3 FAILED: last_attempt_at not written');
    }
  } catch (error) {
    console.log(`✗ Test 3 ERROR: ${error}`);
  }

  // Test 4: process_org_daily doesn't crash on storage errors
  totalCount++;
  try {
    // Mock a broken storage to simulate failure
    const brokenStorage = {
      get: async (key: string) => {
        throw new Error('Storage error');
      },
      set: async (key: string, value: any) => {
        // Attempt to set but fail silently
        throw new Error('Storage error');
      },
    };

    (global as any).api = {
      asApp: () => ({
        requestStorage: async (fn: (storage: any) => Promise<any>) => {
          return fn(brokenStorage);
        },
      }),
    };

    const now = '2025-12-19T03:00:00Z';
    // Should not throw
    await process_org_daily('test-org', now);

    console.log('✓ Test 4: Pipeline survives storage errors gracefully');
    passCount++;
  } catch (error) {
    console.log(`✗ Test 4 FAILED: Pipeline crashed on storage error: ${error}`);
  } finally {
    // Restore mock
    (global as any).api = mockApi;
  }

  console.log(`\n${passCount}/${totalCount} tests passed\n`);

  if (passCount === totalCount) {
    console.log('✅ All daily pipeline (no-data) tests PASS\n');
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
