import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Orchestrator Invariants', () => {
  const orchestratorPath = path.join(
    __dirname,
    '../../tools/production/run_prod_ready_audit.sh'
  );

  let orchestratorContent: string;

  it('should read the orchestrator file', () => {
    expect(() => {
      orchestratorContent = fs.readFileSync(orchestratorPath, 'utf-8');
    }).not.toThrow();
    expect(orchestratorContent.length).toBeGreaterThan(0);
  });

  it('should contain NO "timeout" substring (case-insensitive)', () => {
    const hasTimeout = /timeout/i.test(orchestratorContent);
    expect(hasTimeout).toBe(false);
  });

  it('should contain NO "sleep" word boundary', () => {
    const hasSleep = /\bsleep\b/i.test(orchestratorContent);
    expect(hasSleep).toBe(false);
  });

  it('should contain NO "|| true" pattern', () => {
    const hasPipeTrue = /\|\|\s*true/.test(orchestratorContent);
    expect(hasPipeTrue).toBe(false);
  });

  it('should define EXIT_FILE with correct path', () => {
    const hasExitFile = /EXIT_FILE="?\$E\/09_release\/run_prod_ready_audit\.exit_code\.txt"?/.test(
      orchestratorContent
    );
    expect(hasExitFile).toBe(true);
  });

  it('should define STEP_SUMMARY with correct path', () => {
    const hasStepSummary = /STEP_SUMMARY="?\$E\/09_release\/run_prod_ready_audit\.step_summary\.txt"?/.test(
      orchestratorContent
    );
    expect(hasStepSummary).toBe(true);
  });

  it('should define VERDICT_FILE with correct path', () => {
    const hasVerdictFile = /VERDICT_FILE="?\$E\/PROD_READY_VERDICT\.txt"?/.test(
      orchestratorContent
    );
    expect(hasVerdictFile).toBe(true);
  });

  it('should contain exactly 8 run_step calls', () => {
    const matches = orchestratorContent.match(/^run_step\s+\d+\s/gm);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(8);
  });

  it('should contain step 6 with Proof discipline label', () => {
    const hasStep6 = /run_step\s+6\s+"Proof discipline/.test(orchestratorContent);
    expect(hasStep6).toBe(true);
  });

  it('should contain step 7 with repo-root verification', () => {
    const hasStep7 = /run_step\s+7\s+"No repo-root/.test(orchestratorContent);
    expect(hasStep7).toBe(true);
  });

  it('should contain step 8 with enterprise audit label', () => {
    const hasStep8 = /run_step\s+8\s+"Enterprise audit/.test(orchestratorContent);
    expect(hasStep8).toBe(true);
  });

  it('should NOT contain "set -e" (must be "set -uo pipefail")', () => {
    const hasSete = /set\s+-[a-zA-Z]*e[a-zA-Z]*\s+pipefail/.test(orchestratorContent);
    expect(hasSete).toBe(false);
  });

  it('should contain "set -uo pipefail"', () => {
    const hasSetuo = /set\s+-uo\s+pipefail/.test(orchestratorContent);
    expect(hasSetuo).toBe(true);
  });

  it('should exit with "$OVERALL_EXIT" not with hardcoded value', () => {
    const hasCorrectExit = /exit\s+"\$OVERALL_EXIT"/.test(orchestratorContent);
    expect(hasCorrectExit).toBe(true);
  });

  it('should reference verify_proof_discipline.sh not old name', () => {
    const hasNewName = /verify_proof_discipline\.sh/.test(orchestratorContent);
    const hasOldName = /verify_no_timeout_or_true\.sh/.test(orchestratorContent);
    expect(hasNewName).toBe(true);
    expect(hasOldName).toBe(false);
  });

  it('should NOT use trap-based finalization', () => {
    const hasTrap = /trap\s+finalize\s+EXIT/.test(orchestratorContent);
    expect(hasTrap).toBe(false);
  });

  it('should write evidence files explicitly at end', () => {
    // BOTH evidence writes must be present and explicit at end of script
    // Check for explicit writes of exit code file AND verdict file
    // Matches patterns: echo "0" > "$EXIT_FILE" or echo "1" > "$EXIT_FILE"
    // AND echo "PASS" > "$VERDICT_FILE" or echo "FAIL" > "$VERDICT_FILE"
    const hasExitCodeWrite = /echo\s+"[01]"\s+>\s+"?\$\{?EXIT_FILE\}?"?/.test(
      orchestratorContent
    );
    const hasVerdictWrite = /echo\s+"(PASS|FAIL)"\s+>\s+"?\$\{?VERDICT_FILE\}?"?/.test(
      orchestratorContent
    );
    // BOTH must be true (not OR) - fail-closed ensures explicit finalization block
    expect(hasExitCodeWrite && hasVerdictWrite).toBe(true);
  });
});
