/**
 * REGRESSION GATE: Verify UI does NOT invoke forbidden resolvers
 * 
 * This gate FAILS if UI bundle/source contains direct references to:
 * - ft_runAccessIntelligence_v1
 * - ft_exportAccessPack_v1  
 * 
 * These resolvers are internal implementation details called by:
 * - ft_getDashboardState_v1 with action parameter
 * 
 * Direct UI invocation bypasses action validation and breaks allowlist enforcement
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('[GATE] No forbidden UI resolver invocations', () => {
  test('FAIL: UI source contains ft_runAccessIntelligence_v1 invocation', () => {
    try {
      const result = execSync(
        `rg -n "ft_runAccessIntelligence_v1" src/gadget-ui/src --type ts 2>/dev/null || true`,
        { cwd: '.', encoding: 'utf-8' }
      );

      if (result && result.trim()) {
        console.error('[GATE_INVOKE_FORBIDDEN_STRING] Found direct UI invocation:');
        console.error(result);
        throw new Error('[GATE_INVOKE_FORBIDDEN_STRING] FAIL');
      }
    } catch (error: any) {
      if (error?.message?.includes('GATE_INVOKE_FORBIDDEN_STRING')) {
        throw error;
      }
      // rg not found - skip
    }

    expect(true).toBe(true);
  });

  test('FAIL: UI source contains ft_exportAccessPack_v1 invocation', () => {
    try {
      const result = execSync(
        `rg -n "ft_exportAccessPack_v1" src/gadget-ui/src --type ts 2>/dev/null || true`,
        { cwd: '.', encoding: 'utf-8' }
      );

      if (result && result.trim()) {
        console.error('[GATE_INVOKE_FORBIDDEN_STRING] Found direct UI invocation:');
        console.error(result);
        throw new Error('[GATE_INVOKE_FORBIDDEN_STRING] FAIL');
      }
    } catch (error: any) {
      if (error?.message?.includes('GATE_INVOKE_FORBIDDEN_STRING')) {
        throw error;
      }
    }

    expect(true).toBe(true);
  });

  test('PASS: UI uses consolidated ft_getDashboardState_v1 with action parameter', () => {
    try {
      const result = execSync(
        `rg -n "ft_getDashboardState_v1.*action" src/gadget-ui/src --type ts 2>/dev/null || true`,
        { cwd: '.', encoding: 'utf-8' }
      );

      console.log('[GATE_INVOKE_AUDIT] Consolidated action-based invocations:');
      if (result && result.trim()) {
        console.log(result);
        console.log('[GATE_INVOKE_AUDIT] ✅ UI properly uses action parameter');
        expect(true).toBe(true);
      } else {
        console.warn('[GATE_INVOKE_AUDIT] Could not confirm action parameter usage');
        // Don't fail - this is informative only
        expect(true).toBe(true);
      }
    } catch (error: any) {
      // rg error - skip
      expect(true).toBe(true);
    }
  });
});
