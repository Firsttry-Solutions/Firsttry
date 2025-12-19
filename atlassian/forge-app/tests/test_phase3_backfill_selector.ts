/**
 * Test: Backfill Selector - Deterministic Date Range Selection
 * PHASE 3: Verify backfill dates are selected correctly
 */

import { select_backfill_dates } from '../src/backfill_selector';

function runTests() {
  console.log('=== Test: Backfill Selector ===\n');

  let passCount = 0;
  let totalCount = 0;

  // Test 1: No last success (null) → returns last 7 days
  totalCount++;
  try {
    const result = select_backfill_dates(null, '2025-12-19T10:00:00Z', 7);
    const expected = [
      '2025-12-13',
      '2025-12-14',
      '2025-12-15',
      '2025-12-16',
      '2025-12-17',
      '2025-12-18',
      '2025-12-19',
    ];
    if (JSON.stringify(result) === JSON.stringify(expected)) {
      console.log('✓ Test 1: No last success → last 7 days');
      passCount++;
    } else {
      console.log('✗ Test 1 FAILED');
      console.log(`  Expected: ${JSON.stringify(expected)}`);
      console.log(`  Got: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    console.log(`✗ Test 1 ERROR: ${error}`);
  }

  // Test 2: Last success 2 days ago → returns 2 dates (last+1 to today)
  totalCount++;
  try {
    const result = select_backfill_dates(
      '2025-12-17T10:00:00Z',
      '2025-12-19T10:00:00Z',
      7
    );
    const expected = ['2025-12-18', '2025-12-19'];
    if (JSON.stringify(result) === JSON.stringify(expected)) {
      console.log('✓ Test 2: Last success 2 days ago → 2 dates');
      passCount++;
    } else {
      console.log('✗ Test 2 FAILED');
      console.log(`  Expected: ${JSON.stringify(expected)}`);
      console.log(`  Got: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    console.log(`✗ Test 2 ERROR: ${error}`);
  }

  // Test 3: Last success yesterday → returns today only
  totalCount++;
  try {
    const result = select_backfill_dates(
      '2025-12-18T10:00:00Z',
      '2025-12-19T10:00:00Z',
      7
    );
    const expected = ['2025-12-19'];
    if (JSON.stringify(result) === JSON.stringify(expected)) {
      console.log('✓ Test 3: Last success yesterday → today only');
      passCount++;
    } else {
      console.log('✗ Test 3 FAILED');
      console.log(`  Expected: ${JSON.stringify(expected)}`);
      console.log(`  Got: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    console.log(`✗ Test 3 ERROR: ${error}`);
  }

  // Test 4: Last success today → returns empty
  totalCount++;
  try {
    const result = select_backfill_dates(
      '2025-12-19T10:00:00Z',
      '2025-12-19T15:00:00Z',
      7
    );
    const expected: string[] = [];
    if (JSON.stringify(result) === JSON.stringify(expected)) {
      console.log('✓ Test 4: Last success today → empty');
      passCount++;
    } else {
      console.log('✗ Test 4 FAILED');
      console.log(`  Expected: ${JSON.stringify(expected)}`);
      console.log(`  Got: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    console.log(`✗ Test 4 ERROR: ${error}`);
  }

  // Test 5: Results are always sorted
  totalCount++;
  try {
    const result = select_backfill_dates(
      '2025-12-10T10:00:00Z',
      '2025-12-19T10:00:00Z',
      7
    );
    const sorted = [...result].sort();
    if (JSON.stringify(result) === JSON.stringify(sorted)) {
      console.log('✓ Test 5: Results are sorted ascending');
      passCount++;
    } else {
      console.log('✗ Test 5 FAILED: Not sorted');
    }
  } catch (error) {
    console.log(`✗ Test 5 ERROR: ${error}`);
  }

  // Test 6: Invalid ISO dates → returns []
  totalCount++;
  try {
    const result = select_backfill_dates('invalid', '2025-12-19T10:00:00Z', 7);
    if (JSON.stringify(result) === JSON.stringify([])) {
      console.log('✓ Test 6: Invalid ISO date → empty');
      passCount++;
    } else {
      console.log('✗ Test 6 FAILED');
      console.log(`  Expected: []`);
      console.log(`  Got: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    console.log(`✗ Test 6 ERROR: ${error}`);
  }

  console.log(`\n${passCount}/${totalCount} tests passed\n`);

  if (passCount === totalCount) {
    console.log('✅ All backfill selector tests PASS\n');
    process.exit(0);
  } else {
    console.log('❌ Some tests FAILED\n');
    process.exit(1);
  }
}

runTests();
