/**
 * Test: Runtime Proofpack v2 - No Simulation Enforcement
 *
 * Validates that audit/runtime_proofpack_v2.sh is hardened against simulation:
 * - No heredoc-based evidence file creation
 * - All evidence from real command outputs (forge logs, git, grep)
 * - No FIRSTTRY_ALLOW_NO_FREEZE usage
 * - Self-integrity check enabled
 * - FREEZE_LOCK dirty detection
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

describe('RuntimeProofpackV2_NoSimulation', () => {
  let scriptContent: string;
  
  try {
    const scriptPath = join(__dirname, '../../audit/runtime_proofpack_v2.sh');
    scriptContent = readFileSync(scriptPath, 'utf-8');
  } catch (e) {
    scriptContent = '';
  }

  it('MUST have exactly one canonical RuntimeProofpackV2_NoSimulation test file', () => {
    const files = readdirSync(join(__dirname)).filter(f =>
      /^RuntimeProofpackV2.*NoSimulation\.test\.ts$/i.test(f)
    );
    expect(files).toEqual(['RuntimeProofpackV2_NoSimulation.test.ts']);
  });

  it('MUST NOT contain heredoc patterns creating evidence files', () => {
    // Forbidden: cat > 20_logs_before.txt << EOF
    // Forbidden: cat > 40_logs_after.txt << EOF
    // Forbidden: cat > 50_resolver_extract.txt << EOF
    // Forbidden: cat > 31_browser_console.txt << EOF
    // Forbidden: cat > 32_dashboard.png << EOF
    
    const forbiddenPatterns = [
      /cat\s+>\s*.*20_logs_before.*<<\s+\w+/i,
      /cat\s+>\s*.*40_logs_after.*<<\s+\w+/i,
      /cat\s+>\s*.*50_.*extract.*<<\s+\w+/i,
      /cat\s+>\s*.*31_browser_console.*<<\s+\w+/i,
      /cat\s+>\s*.*32_dashboard.*<<\s+\w+/i,
    ];

    forbiddenPatterns.forEach(pattern => {
      const match = scriptContent.match(pattern);
      expect(match).toBeNull();
    });
  });

  it('MUST forbid mv/cp into evidence artifacts via check_script_integrity', () => {
    // Script must contain explicit mv/cp detection patterns in check_script_integrity
    expect(scriptContent).toMatch(/INTEGRITY CHECK FAILED: Script contains forbidden mv\/cp/i);
    expect(scriptContent).toMatch(/\b\(mv\|cp\)\b/);
    expect(scriptContent).toMatch(/20_logs_before|40_logs_after|31_browser_console|32_dashboard/i);
  });

  it('MUST have FIRSTTRY_ALLOW_NO_FREEZE rejection check', () => {
    const hasRejectOverride = scriptContent.includes('FIRSTTRY_ALLOW_NO_FREEZE') &&
                             scriptContent.includes('die');
    expect(hasRejectOverride).toBe(true);
  });

  it('MUST have check_script_integrity function defined', () => {
    const hasIntegrityCheck = scriptContent.includes('check_script_integrity()');
    expect(hasIntegrityCheck).toBe(true);
  });

  it('MUST have enforce_freeze_lock function that dies on dirty FREEZE_LOCK', () => {
    const hasEnforceFreezeFunction = scriptContent.includes('enforce_freeze_lock()');
    const checksIfDirty = scriptContent.includes('git diff');
    expect(hasEnforceFreezeFunction).toBe(true);
    expect(checksIfDirty).toBe(true);
  });

  it('MUST have secret scanning (scan_for_secrets function)', () => {
    const hasSecretScan = scriptContent.includes('scan_for_secrets()');
    const checksForTokens = scriptContent.includes('ATATT') || scriptContent.includes('FORGE_API_TOKEN');
    expect(hasSecretScan).toBe(true);
    expect(checksForTokens).toBe(true);
  });

  it('MUST call check_script_integrity before PHASE 0', () => {
    const integrityCheckPos = scriptContent.indexOf('check_script_integrity');
    const phase0Pos = scriptContent.indexOf('PHASE 0');
    expect(integrityCheckPos).toBeGreaterThan(-1);
    expect(phase0Pos).toBeGreaterThan(-1);
    expect(integrityCheckPos).toBeLessThan(phase0Pos);
  });

  it('MUST call enforce_freeze_lock before PHASE 0', () => {
    const freezeCheckPos = scriptContent.indexOf('enforce_freeze_lock');
    const phase0Pos = scriptContent.indexOf('PHASE 0');
    expect(freezeCheckPos).toBeGreaterThan(-1);
    expect(phase0Pos).toBeGreaterThan(-1);
    expect(freezeCheckPos).toBeLessThan(phase0Pos);
  });

  it('MUST use capture_cmd for all real command outputs', () => {
    const hasCaptureCmd = scriptContent.includes('capture_cmd()');
    expect(hasCaptureCmd).toBe(true);
  });

  it('MUST scan logs and console for secrets (scan_for_secrets calls)', () => {
    const scanCalls = (scriptContent.match(/scan_for_secrets/g) || []).length;
    // Should scan: whoami output, logs before, logs after, browser console
    expect(scanCalls).toBeGreaterThanOrEqual(3);
  });

  it('MUST have die() function for fail-closed execution', () => {
    const hasDieFunction = scriptContent.includes('die()') &&
                          scriptContent.includes('STOP_REASON.txt');
    expect(hasDieFunction).toBe(true);
  });

  it('MUST set umask 077 for secure file permissions', () => {
    const hasUmask = scriptContent.includes('umask 077');
    expect(hasUmask).toBe(true);
  });

  it('MUST deterministically capture exit codes in capture_cmd (not pipelines)', () => {
    // capture_cmd must capture exit code immediately after command execution
    const hasCaptureCmd = scriptContent.includes('capture_cmd()');
    const hasExitCodeCapture = scriptContent.includes('local exit_code=$?') ||
                               scriptContent.includes('exit_code=$?');
    const hasStrictMode = scriptContent.includes('set -euo pipefail');
    
    expect(hasCaptureCmd).toBe(true);
    expect(hasExitCodeCapture).toBe(true);
    expect(hasStrictMode).toBe(true);
  });

  it('MUST require_file for non-empty evidence files', () => {
    const hasRequireFile = scriptContent.includes('require_file()');
    expect(hasRequireFile).toBe(true);
  });

  it('MUST enforce minimum artifact sizes and PNG dimensions', () => {
    // Validate that hardened functions exist
    const hasRequireMinBytes = scriptContent.includes('require_min_bytes()');
    const hasRequirePngMinDims = scriptContent.includes('require_png_min_dims()');
    
    expect(hasRequireMinBytes).toBe(true);
    expect(hasRequirePngMinDims).toBe(true);
    
    // Validate that these functions are used in PHASE 3B
    const phase3bSection = scriptContent.match(
      /=== PHASE 3B: Validate Manual Artifacts ===([\s\S]*?)=== PHASE [0-9]/
    );
    
    if (phase3bSection) {
      expect(phase3bSection[1]).toContain('require_min_bytes');
      expect(phase3bSection[1]).toContain('require_png_min_dims');
      expect(phase3bSection[1]).toContain('2000');  // minimum bytes for console
      expect(phase3bSection[1]).toContain('600');   // minimum width for PNG
      expect(phase3bSection[1]).toContain('400');   // minimum height for PNG
    }
  });

  it('MUST explicitly reject 1x1 PNG placeholders', () => {
    // Ensure the placeholder detection logic exists
    const has1x1Rejection = scriptContent.includes('1x1 PNG');
    const hasPlaceholderDetection = scriptContent.includes('placeholder');
    
    expect(has1x1Rejection).toBe(true);
    expect(hasPlaceholderDetection).toBe(true);
  });

  it('MUST have CSP_VIOLATION fail-closed check for inline styles', () => {
    // Ensure runtime proofpack detects CSP violations in browser console
    const hasCspViolationCheck = scriptContent.includes('CSP_VIOLATION');
    const hasInlineStyleDetection = scriptContent.includes('Applying inline style violates');
    const hasStyleSrcDetection = scriptContent.includes('style-src');
    
    expect(hasCspViolationCheck).toBe(true);
    expect(hasInlineStyleDetection).toBe(true);
    expect(hasStyleSrcDetection).toBe(true);
  });

});

