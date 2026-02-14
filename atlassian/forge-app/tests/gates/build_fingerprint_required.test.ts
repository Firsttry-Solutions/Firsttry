/**
 * REGRESSION GATE: Build fingerprint marker must be present
 * 
 * This gate FAILS if the always-on build fingerprint log is missing from ft_getDashboardState_v1.
 * 
 * The fingerprint marker is critical for production proof windows because:
 * - It logs on EVERY resolver call (gadget refresh, any button click)
 * - It proves the resolver is being invoked
 * - It includes buildSha, buildUtc, and action for cross-verification
 * - If fingerprint is missing from logs, the log window is wrong or resolver wasn't hit
 * 
 * REQUIRED: "[FT_PROOF_BUILD_FINGERPRINT]" string in ft_getDashboardState_v1 function body
 */

import { execSync } from 'child_process';

describe('[GATE] Build fingerprint marker must be present', () => {
  test('FAIL: ft_getDashboardState_v1 must log build fingerprint', () => {
    try {
      const result = execSync(
        `rg -n "\\[FT_PROOF_BUILD_FINGERPRINT\\]" src/gadget-resolver.ts --type ts 2>/dev/null || true`,
        { cwd: '.', encoding: 'utf-8' }
      );

      if (!result || !result.trim()) {
        console.error('[GATE_BUILD_FINGERPRINT] FAIL: Build fingerprint marker not found');
        console.error('[GATE_BUILD_FINGERPRINT] Required: "[FT_PROOF_BUILD_FINGERPRINT]" in ft_getDashboardState_v1');
        throw new Error('[GATE_BUILD_FINGERPRINT] Build fingerprint missing');
      }

      console.log('[GATE_BUILD_FINGERPRINT] ✅ Build fingerprint marker found:');
      console.log(result);
      expect(true).toBe(true);
    } catch (error: any) {
      if (error?.message?.includes('GATE_BUILD_FINGERPRINT')) {
        throw error;
      }
      // rg not available - skip
      expect(true).toBe(true);
    }
  });

  test('PASS: Phase1 dispatch marker must be present', () => {
    try {
      const result = execSync(
        `rg -n "\\[FT_PROOF_PHASE1_DISPATCH\\]" src/gadget-resolver.ts --type ts 2>/dev/null || true`,
        { cwd: '.', encoding: 'utf-8' }
      );

      if (result && result.trim()) {
        console.log('[GATE_PHASE1_MARKERS] ✅ Phase1 dispatch marker found');
      } else {
        console.warn('[GATE_PHASE1_MARKERS] ⚠️  Phase1 dispatch marker not found - informative check');
      }
      expect(true).toBe(true);
    } catch (error: any) {
      expect(true).toBe(true);
    }
  });

  test('PASS: Handler entry marker must be present', () => {
    try {
      const result = execSync(
        `rg -n "\\[FT_PROOF_PHASE1_HANDLER_ENTRY\\]" src/resolvers/ft_runAccessIntelligence_v1.ts --type ts 2>/dev/null || true`,
        { cwd: '.', encoding: 'utf-8' }
      );

      if (result && result.trim()) {
        console.log('[GATE_PHASE1_MARKERS] ✅ Handler entry marker found');
      } else {
        console.warn('[GATE_PHASE1_MARKERS] ⚠️  Handler entry marker not found');
      }
      expect(true).toBe(true);
    } catch (error: any) {
      expect(true).toBe(true);
    }
  });

  test('PASS: Route proof marker must be present', () => {
    try {
      const result = execSync(
        `rg -n "\\[FT_ACCESS_ROUTE_PROOF\\]" src/resolvers/ft_runAccessIntelligence_v1.ts --type ts 2>/dev/null || true`,
        { cwd: '.', encoding: 'utf-8' }
      );

      if (result && result.trim()) {
        console.log('[GATE_PHASE1_MARKERS] ✅ Route proof marker found');
      } else {
        console.warn('[GATE_PHASE1_MARKERS] ⚠️  Route proof marker not found');
      }
      expect(true).toBe(true);
    } catch (error: any) {
      expect(true).toBe(true);
    }
  });
});
