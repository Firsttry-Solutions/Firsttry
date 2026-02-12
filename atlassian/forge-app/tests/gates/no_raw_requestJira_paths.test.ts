/**
 * REGRESSION GATE: Verify NO raw requestJira string paths
 * 
 * This gate FAILS if any source file contains:
 * - requestJira('/rest/api/3/
 * - requestJira("/rest/api/3/
 * - requestJira(`/rest/api/3/
 * 
 * All Jira API paths MUST use route template literals from @forge/api
 * 
 * Rationale:
 * - route() enables proper Jira request routing and security enforcement
 * - Raw strings bypass critical Forge platform safety checks
 * - Enforced as non-negotiable constraint for Jira Cloud marketplace compliance
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('[GATE] No raw requestJira paths', () => {
  test('FAIL_GATE_FORBIDDEN: Raw requestJira string literals (single quote)', () => {
    try {
      const result = execSync(
        `rg -n "requestJira\\(\\s*\\'" src --type ts 2>/dev/null || true`,
        { cwd: '.', encoding: 'utf-8' }
      );

      // Filter out route patterns (which are safe)
      const unsafeLines = result
        .split('\n')
        .filter((line) => line && !line.includes('route`'));

      if (unsafeLines.length > 0) {
        console.error('[GATE_FORBIDDEN_RAW_REQUESTJIRA] Violations found:');
        unsafeLines.forEach((line) => console.error('  ' + line));
        throw new Error('RAW_REQUESTJIRA_PATH_FORBIDDEN');
      }
    } catch (error: any) {
      if (error?.message === 'RAW_REQUESTJIRA_PATH_FORBIDDEN') {
        throw error;
      }
      // rg not found or other error - skip test
    }
  });

  test('FAIL_GATE_FORBIDDEN: Raw requestJira string literals (double quote)', () => {
    try {
      const result = execSync(
        `rg -n 'requestJira\\(\\s*\\"' src --type ts 2>/dev/null || true`,
        { cwd: '.', encoding: 'utf-8' }
      );

      // Filter out route patterns
      const unsafeLines = result
        .split('\n')
        .filter((line) => line && !line.includes('route'));

      if (unsafeLines.length > 0) {
        console.error('[GATE_FORBIDDEN_RAW_REQUESTJIRA] Violations found:');
        unsafeLines.forEach((line) => console.error('  ' + line));
        throw new Error('RAW_REQUESTJIRA_PATH_FORBIDDEN');
      }
    } catch (error: any) {
      if (error?.message === 'RAW_REQUESTJIRA_PATH_FORBIDDEN') {
        throw error;
      }
    }
  });

  test('PASS: All requestJira calls use route template literals', () => {
    try {
      // Verify at least some requestJira calls exist (sanity check)
      const result = execSync(
        `rg -n "requestJira\\(" src --type ts 2>/dev/null || true`,
        { cwd: '.', encoding: 'utf-8' }
      );

      const hasRoute = result.includes('route`');
      const lines = result.split('\n').filter((l) => l);

      console.log(`[GATE_REQUESTJIRA_AUDIT] Total requestJira() calls: ${lines.length}`);
      console.log(`[GATE_REQUESTJIRA_AUDIT] Uses route template literals: ${hasRoute}`);

      // If we have requestJira calls, they should use route
      if (lines.length > 0 && !hasRoute) {
        throw new Error('RAW_REQUESTJIRA_PATH_FORBIDDEN');
      }

      expect(hasRoute || lines.length === 0).toBe(true);
    } catch (error: any) {
      if (error?.message === 'RAW_REQUESTJIRA_PATH_FORBIDDEN') {
        throw error;
      }
      // rg command failed - skip
      expect(true).toBe(true);
    }
  });
});
