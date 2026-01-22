import { test, expect } from '@playwright/test';
import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Auth Gating Tests
 * 
 * Verifies that authentication fails closed in non-interactive environments.
 * Tests that:
 * 1. Missing storageState in headless mode causes BOTH markers and exits non-zero
 * 2. Invalid storageState emits [AUTH_REQUIRED_STORAGESTATE_INVALID]
 * 3. Markers are grep-able and deterministic
 */

test.describe('E2E: Auth Gating (Fail-Closed)', () => {
  test('Missing storageState in non-interactive environment should emit both markers and exit 1', () => {
    // Simulate non-interactive environment by:
    // 1. Unsetting DISPLAY
    // 2. Setting CI=true (CI environment detection)
    // 3. Running with missing storageState
    
    const testDir = '/tmp/ft_e2e_auth_gate_test_missing';
    const authDir = path.join(testDir, 'e2e', '.auth');
    
    // Ensure storageState is missing
    if (fs.existsSync(path.join(authDir, 'storageState.persistent.json'))) {
      fs.unlinkSync(path.join(authDir, 'storageState.persistent.json'));
    }
    
    // Run the acceptance script in non-interactive mode
    const env = {
      ...process.env,
      DISPLAY: '', // Unset DISPLAY (headless)
      CI: 'true', // Set CI flag
      JIRA_DASHBOARD_URL: 'https://firsttry.atlassian.net/jira/dashboards/10102',
      FT_RUN_DIR: path.join(testDir, 'run'),
    };
    
    const result = spawnSync('bash', [
      path.join(process.cwd(), 'e2e/scripts/run_dashboard_acceptance.sh'),
    ], {
      env,
      cwd: process.cwd(),
      encoding: 'utf-8',
    });
    
    const output = result.stdout + result.stderr;
    
    // Exit code must be non-zero (failure)
    expect(result.status).not.toBe(0);
    expect(result.status).toBeGreaterThan(0);
    
    // Both markers must be present
    expect(output).toContain('[AUTH_ENV_NOT_INTERACTIVE]');
    expect(output).toContain('[AUTH_REQUIRED_STORAGESTATE_INVALID]');
    
    // Action marker must be present
    expect(output).toContain('[ACTION_REQUIRED]');
    
    // Message must be clear
    expect(output).toContain('GUI machine');
    expect(output).toContain('npm run dashboard:auth');
  });
  
  test('Invalid storageState validation should emit [STORAGESTATE_UI_FAIL]', () => {
    // This test verifies that when storageState exists but is invalid,
    // the validation failure marker is emitted.
    // (Note: Full validation requires real network access to Jira)
    
    const testDir = '/tmp/ft_e2e_auth_gate_test_invalid';
    const authDir = path.join(testDir, 'e2e', '.auth');
    const storageFile = path.join(authDir, 'storageState.persistent.json');
    
    // Create invalid/empty storageState
    fs.mkdirSync(authDir, { recursive: true });
    fs.writeFileSync(storageFile, '{}'); // Empty session object
    
    const env = {
      ...process.env,
      DISPLAY: '', // Headless
      CI: 'true',
      JIRA_DASHBOARD_URL: 'https://firsttry.atlassian.net/jira/dashboards/10102',
      FT_RUN_DIR: path.join(testDir, 'run'),
      STORAGE_STATE: storageFile,
    };
    
    const result = spawnSync('bash', [
      path.join(process.cwd(), 'e2e/scripts/run_dashboard_acceptance.sh'),
    ], {
      env,
      cwd: process.cwd(),
      encoding: 'utf-8',
      timeout: 30000, // 30s timeout for validation
    });
    
    const output = result.stdout + result.stderr;
    
    // When validation fails in non-interactive mode, should fail
    // and emit [STORAGESTATE_UI_FAIL] or [AUTH_REQUIRED_STORAGESTATE_INVALID]
    // (depending on which step fails)
    expect(result.status).not.toBe(0);
    expect(
      output.includes('[STORAGESTATE_UI_FAIL]') ||
      output.includes('[AUTH_REQUIRED_STORAGESTATE_INVALID]')
    ).toBe(true);
  });
  
  test('Auth location helper should print paths without secrets', () => {
    const result = spawnSync('bash', [
      path.join(process.cwd(), 'e2e/scripts/print_auth_locations.sh'),
    ], {
      cwd: process.cwd(),
      encoding: 'utf-8',
    });
    
    const output = result.stdout + result.stderr;
    
    // Should exit successfully
    expect(result.status).toBe(0);
    
    // Should mention accepted file names
    expect(output).toContain('storageState.json');
    expect(output).toContain('storageState.persistent.json');
    
    // Should mention the directory
    expect(output).toContain('.auth');
    
    // Should NOT contain any obvious secret patterns
    // (This is a safety check, not exhaustive)
    expect(output).not.toMatch(/token['":\s]*[a-zA-Z0-9_-]{40,}/i);
    expect(output).not.toMatch(/secret['":\s]*[a-zA-Z0-9_-]{40,}/i);
    
    // Should mention how to refresh
    expect(output).toContain('npm run dashboard:auth');
    expect(output).toContain('GUI');
  });
  
  test('Auth markers should be grep-able from script output', () => {
    // Verify that all expected markers are grep-able
    const markers = [
      '[AUTH_ENV_NOT_INTERACTIVE]',
      '[AUTH_REQUIRED_STORAGESTATE_INVALID]',
      '[AUTH_SKIPPED_STORAGESTATE_VALID]',
      '[STORAGESTATE_UI_OK]',
      '[STORAGESTATE_UI_FAIL]',
      '[ACTION_REQUIRED]',
    ];
    
    const scriptPath = path.join(process.cwd(), 'e2e/scripts/run_dashboard_acceptance.sh');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    
    // All markers should appear in the script
    for (const marker of markers) {
      expect(scriptContent).toContain(marker);
    }
  });
});
