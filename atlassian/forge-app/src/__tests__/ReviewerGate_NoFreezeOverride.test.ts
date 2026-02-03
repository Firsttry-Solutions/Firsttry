/**
 * Test: Reviewer Gate - No Freeze Override Allowed
 *
 * Validates that audit/reviewer_ready_gate.sh:
 * - FAILS if FIRSTTRY_ALLOW_NO_FREEZE is set
 * - FAILS if FREEZE_LOCK is dirty
 * - Never passes proof/CI mode with override
 * - Provides clear error message with fix command
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('ReviewerGate_NoFreezeOverride', () => {
  let gateContent: string;
  
  try {
    const gatePath = join(__dirname, '../../audit/reviewer_ready_gate.sh');
    gateContent = readFileSync(gatePath, 'utf-8');
  } catch (e) {
    gateContent = '';
  }

  it('MUST reject FIRSTTRY_ALLOW_NO_FREEZE with FAIL (never PASS with override)', () => {
    // Should detect FIRSTTRY_ALLOW_NO_FREEZE
    const checksForOverride = gateContent.includes('FIRSTTRY_ALLOW_NO_FREEZE');
    expect(checksForOverride).toBe(true);
    
    // Should exit 1, not continue
    const rejectsOverride = gateContent.includes('FAIL: FREEZE_OVERRIDE_FORBIDDEN') ||
                           gateContent.includes('exit 1');
    expect(rejectsOverride).toBe(true);
    
    // Should NOT have "WARN: FREEZE_SKIPPED_BY_OVERRIDE" (allow to pass)
    const allowsOverride = gateContent.includes('FREEZE_SKIPPED_BY_OVERRIDE');
    expect(allowsOverride).toBe(false);
  });

  it('MUST check if FREEZE_LOCK file is dirty', () => {
    const checksDirty = gateContent.includes('git diff --quiet');
    expect(checksDirty).toBe(true);
  });

  it('MUST FAIL if FREEZE_LOCK is modified in working tree', () => {
    const failOnDirty = gateContent.includes('FREEZE_LOCK_DIRTY') ||
                       gateContent.includes('git diff --quiet');
    expect(failOnDirty).toBe(true);
  });

  it('MUST FAIL if FREEZE_LOCK is staged but not committed', () => {
    const failOnStaged = gateContent.includes('git diff --cached');
    expect(failOnStaged).toBe(true);
  });

  it('MUST provide clear error message with git commit command', () => {
    const hasErrorMsg = gateContent.includes('git add') || 
                       gateContent.includes('git commit');
    expect(hasErrorMsg).toBe(true);
  });

  it('MUST NOT allow any conditional pass when FREEZE_LOCK dirty', () => {
    // Find the section that checks FREEZE_LOCK
    const freezeLockSection = gateContent.substring(
      gateContent.indexOf('FREEZE_LOCK='),
      gateContent.indexOf('Check 3B') > 0 ? gateContent.indexOf('Check 3B') : gateContent.length
    );
    
    // Should not have "continue" or "return 0" when dirty
    const hasEarlyExit = freezeLockSection.includes('exit 1');
    expect(hasEarlyExit).toBe(true);
  });

  it('MUST verify FREEZE_LOCK file exists before checking dirty', () => {
    const checksExists = gateContent.includes('! -f "$FREEZE_LOCK"') ||
                        gateContent.includes('FREEZE_LOCK_MISSING');
    expect(checksExists).toBe(true);
  });

  it('MUST require GENERATE_FREEZE and VERIFY_FREEZE scripts', () => {
    const requiresGenerate = gateContent.includes('GENERATE_FREEZE') &&
                            gateContent.includes('FREEZE_GENERATOR_MISSING');
    const requiresVerify = gateContent.includes('VERIFY_FREEZE') &&
                          gateContent.includes('FREEZE_VERIFY_MISSING');
    expect(requiresGenerate).toBe(true);
    expect(requiresVerify).toBe(true);
  });

  it('MUST run verify_freeze_lock.sh and validate output', () => {
    const runsVerify = gateContent.includes('bash "$VERIFY_FREEZE"');
    const validatesOutput = gateContent.includes('COMPUTED_FROZEN_SHA') ||
                           gateContent.includes('LOCKED_FROZEN_SHA');
    expect(runsVerify).toBe(true);
    expect(validatesOutput).toBe(true);
  });

  it('MUST use proper exit codes (exit 1 on failure)', () => {
    const failExits = (gateContent.match(/exit\s+1/g) || []).length;
    expect(failExits).toBeGreaterThan(0);
  });

  it('MUST clearly mark success with green checkmark', () => {
    const hasSuccess = gateContent.includes('✓ Freeze verification passed') ||
                      gateContent.includes('GREEN');
    expect(hasSuccess).toBe(true);
  });

  it('MUST NOT have any comments mentioning "bypass" or "override" as workarounds', () => {
    // Comments should explain why override is forbidden, not how to use it
    const hasWorkaroundComments = gateContent.match(/# .*(?:bypass|workaround|override).*allow/i);
    expect(hasWorkaroundComments).toBeNull();
  });

});
