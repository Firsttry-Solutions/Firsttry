import { test, expect } from '@playwright/test';

/**
 * Auth State-Only Guard Test
 * 
 * This test validates that state-only mode correctly fails when no valid state.json
 * exists. This is a gating test that ensures fail-closed behavior.
 * 
 * Run with:
 *   FT_AUTH_MODE=state-only npm test -- auth_state_only_guard
 * 
 * Expected: Test setup fails with "STATE_REQUIRED" error before any test runs.
 */

test.describe('Auth - State-Only Guard', () => {
  test('state-only mode requires valid cached state.json', async ({ page }) => {
    // This test should NOT reach here if state-only mode is working correctly.
    // The auth.setup.ts should fail during setup phase with STATE_REQUIRED error.
    
    // If we somehow reach here, the gate has failed.
    throw new Error(
      'UNEXPECTED_STATE: Reached test body in state-only mode. ' +
      'auth.setup.ts should have failed with STATE_REQUIRED error during setup phase. ' +
      'This indicates the auth gate is not fail-closed.'
    );
  });
});
