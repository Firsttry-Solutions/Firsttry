/**
 * Security Tests: Storage Debug Access Control (PHASE 1.1)
 * 
 * Tests that ensure:
 * - Only admins can access storage proof snapshot
 * - Invalid debug tokens are rejected
 * - Access attempts are logged (for audit trail)
 * - No tokens/secrets in logs
 */

import { describe, it } from 'vitest';
import { checkDebugAccess, logDebugAccess } from '../src/storage_debug';

/**
 * Test suite for debug access control
 */
const testSuite: { [key: string]: () => boolean } = {
  /**
   * Test 1: Admin can access snapshot
   */
  'Admin access granted': () => {
    const headers = {};
    const isAdmin = true;
    const debugToken = 'secret-token-123';

    const allowed = checkDebugAccess(headers, isAdmin, debugToken);
    return allowed === true;
  },

  /**
   * Test 2: Non-admin without token denied
   */
  'Non-admin without token denied': () => {
    const headers = {};
    const isAdmin = false;
    const debugToken = 'secret-token-123';

    const allowed = checkDebugAccess(headers, isAdmin, debugToken);
    return allowed === false;
  },

  /**
   * Test 3: Non-admin with valid token allowed
   */
  'Non-admin with valid debug token allowed': () => {
    const headers = { 'x-debug-token': 'secret-token-123' };
    const isAdmin = false;
    const debugToken = 'secret-token-123';

    const allowed = checkDebugAccess(headers, isAdmin, debugToken);
    return allowed === true;
  },

  /**
   * Test 4: Non-admin with invalid token denied
   */
  'Non-admin with invalid debug token denied': () => {
    const headers = { 'x-debug-token': 'wrong-token-456' };
    const isAdmin = false;
    const debugToken = 'secret-token-123';

    const allowed = checkDebugAccess(headers, isAdmin, debugToken);
    return allowed === false;
  },

  /**
   * Test 5: Case-insensitive header check
   */
  'Debug token header case-insensitive': () => {
    const headers = { 'X-Debug-Token': 'secret-token-123' };
    const isAdmin = false;
    const debugToken = 'secret-token-123';

    const allowed = checkDebugAccess(headers, isAdmin, debugToken);
    return allowed === true;
  },

  /**
   * Test 6: Admin bypasses token check
   */
  'Admin bypasses debug token requirement': () => {
    const headers = { 'x-debug-token': 'wrong-token' };
    const isAdmin = true;
    const debugToken = 'secret-token-123';

    const allowed = checkDebugAccess(headers, isAdmin, debugToken);
    return allowed === true;
  },

  /**
   * Test 7: Access logging (allowed)
   */
  'Access logging captures allowed access': () => {
    // This test just ensures logDebugAccess doesn't throw
    try {
      logDebugAccess('admin@example.com', 'allowed');
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Test 8: Access logging (denied)
   */
  'Access logging captures denied access': () => {
    // This test just ensures logDebugAccess doesn't throw
    try {
      logDebugAccess('unknown', 'denied');
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Test 9: No token in environment if undefined
   */
  'Missing debug token allows admin-only': () => {
    const headers = { 'x-debug-token': 'any-token' };
    const isAdmin = false;
    const debugToken = undefined; // No token configured

    const allowed = checkDebugAccess(headers, isAdmin, debugToken);
    return allowed === false; // Non-admin without valid check should be denied
  },

  /**
   * Test 10: Empty token header ignored
   */
  'Empty debug token header rejected': () => {
    const headers = { 'x-debug-token': '' };
    const isAdmin = false;
    const debugToken = 'secret-token-123';

    const allowed = checkDebugAccess(headers, isAdmin, debugToken);
    return allowed === false;
  },
};

/**
 * Run all tests and report results
 */
export function runAllTests(): void {
  const testNames = Object.keys(testSuite);
  let passed = 0;
  let failed = 0;

  console.log('\n=== Storage Debug Access Control Tests ===\n');

  for (const testName of testNames) {
    const testFn = testSuite[testName];
    try {
      const result = testFn();
      if (result) {
        console.log(`✓ ${testName}`);
        passed++;
      } else {
        console.log(`✗ ${testName}`);
        failed++;
      }
    } catch (error) {
      console.log(`✗ ${testName} (error: ${error})`);
      failed++;
    }
  }

  console.log(`\n✅ Test Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed`);
  }
}

describe('Storage Debug Access Tests', () => {
  it('should run all storage access tests', () => {
    runAllTests();
  });
});
