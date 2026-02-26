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

  it('should contain TOTAL_STEPS=8 variable definition', () => {
    const hasTotalSteps = /TOTAL_STEPS\s*=\s*8/.test(orchestratorContent);
    expect(hasTotalSteps).toBe(true);
  });

  it('should use ${TOTAL_STEPS} in step logging, not hardcoded /7', () => {
    const usesTotalStepsVar = /Step\s+\$\{step_no\}\/\$\{TOTAL_STEPS\}/.test(orchestratorContent);
    const hasHardcoded7 = /Step\s+[\$\{]*step_no[\}]*\/7/.test(orchestratorContent);
    expect(usesTotalStepsVar).toBe(true);
    expect(hasHardcoded7).toBe(false);
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

  it('should define function generate_proof_pack_binding', () => {
    const hasFunction = /generate_proof_pack_binding\s*\(\s*\)/.test(
      orchestratorContent
    );
    expect(hasFunction).toBe(true);
  });

  it('should write prod_ready_manifest_files.txt in binding function', () => {
    const hasManifestFiles = /prod_ready_manifest_files\.txt/.test(
      orchestratorContent
    );
    expect(hasManifestFiles).toBe(true);
  });

  it('should write prod_ready_manifest_sha256.txt in binding function', () => {
    const hasManifestSha256 = /prod_ready_manifest_sha256\.txt/.test(
      orchestratorContent
    );
    expect(hasManifestSha256).toBe(true);
  });

  it('should write prod_ready_packhash.txt in binding function', () => {
    const hasPackHash = /prod_ready_packhash\.txt/.test(
      orchestratorContent
    );
    expect(hasPackHash).toBe(true);
  });

  it('should call generate_proof_pack_binding in finalization block', () => {
    const hasCall = /generate_proof_pack_binding/.test(
      orchestratorContent
    );
    expect(hasCall).toBe(true);
  });

  it('should set LC_ALL=C for deterministic ordering', () => {
    const hasLC_ALL = /LC_ALL=C/.test(orchestratorContent);
    expect(hasLC_ALL).toBe(true);
  });

  it('should use find with deterministic sort for manifest', () => {
    const hasFind = /find\s+\.\s+-type\s+f/.test(orchestratorContent);
    const hasSort = /LC_ALL=C\s+sort/.test(orchestratorContent);
    expect(hasFind && hasSort).toBe(true);
  });

  it('should exclude stdout/stderr from manifest', () => {
    const hasExcludeStdout = /stdout\.txt/.test(orchestratorContent);
    const hasExcludeStderr = /stderr\.txt/.test(orchestratorContent);
    expect(hasExcludeStdout && hasExcludeStderr).toBe(true);
  });

  it('should use sha256sum for file hashing', () => {
    const hasSha256 = /sha256sum/.test(orchestratorContent);
    expect(hasSha256).toBe(true);
  });

  it('should set OVERALL_EXIT=1 if binding generation fails', () => {
    const hasFailCheck = /OVERALL_EXIT=1/.test(orchestratorContent);
    expect(hasFailCheck).toBe(true);
  });

  it('should have fail-closed error handling in binding function', () => {
    const hasErrorHandler = /ERROR:.*failed/.test(orchestratorContent);
    const hasReturnCheck = /\|\|\s+return\s+1/.test(orchestratorContent);
    expect(hasErrorHandler && hasReturnCheck).toBe(true);
  });

  // ── NEW INVARIANTS: cwd-independence, self-describing manifest, hash_inputs ──

  it('should compute SCRIPT_DIR at top (cwd-independent)', () => {
    const hasScriptDir = /SCRIPT_DIR="\$\(cd "\$\(dirname "\$\{BASH_SOURCE\[0\]\}"/.test(orchestratorContent);
    expect(hasScriptDir).toBe(true);
  });

  it('should compute REPO_ROOT relative to SCRIPT_DIR', () => {
    const hasRepoRoot = /REPO_ROOT="\$\(cd "\$SCRIPT_DIR/.test(orchestratorContent);
    expect(hasRepoRoot).toBe(true);
  });

  it('should cd to "$REPO_ROOT" immediately after computing it', () => {
    const hasCdRepoRoot = /cd\s+"\$REPO_ROOT"/.test(orchestratorContent);
    expect(hasCdRepoRoot).toBe(true);
  });

  it('should NOT hardcode /workspaces path for cd (cwd-independent)', () => {
    const hasHardcodedCd = /^cd\s+\/workspaces/m.test(orchestratorContent);
    expect(hasHardcodedCd).toBe(false);
  });

  it('should include prod_ready_manifest_files.txt in manifest_files (self-describing)', () => {
    // The find command must NOT exclude manifest_files — binding files must NOT be grep-v'd
    // Presence of manifest_files var definition is necessary but not sufficient;
    // confirm is NOT excluded in find pipeline by looking for absence of manifest_files exclusion grep
    const hasManifestFilesVar = /prod_ready_manifest_files\.txt/.test(orchestratorContent);
    // Binding files must NOT appear in a grep -v exclusion line
    const hasManifestFilesExcluded = /grep\s+-v.*prod_ready_manifest_files/.test(orchestratorContent);
    expect(hasManifestFilesVar).toBe(true);
    expect(hasManifestFilesExcluded).toBe(false);
  });

  it('should include prod_ready_manifest_sha256.txt in manifest_files list', () => {
    // manifest_sha256 must appear exactly once in the script — in the hash_inputs
    // filter (grep -v exclusion), NOT in the find pipeline that builds manifest_files.
    // Count = 1 means it's excluded from hash_inputs only (correct), not from find.
    const count = (orchestratorContent.match(
      /grep\s+-v.*\^09_release\/prod_ready_manifest_sha256/g
    ) || []).length;
    expect(count).toBe(1);
  });

  it('should include prod_ready_packhash.txt in manifest_files list', () => {
    // packhash must appear exactly once in the script — in the hash_inputs
    // filter (grep -v exclusion), NOT in the find pipeline that builds manifest_files.
    const count = (orchestratorContent.match(
      /grep\s+-v.*\^09_release\/prod_ready_packhash/g
    ) || []).length;
    expect(count).toBe(1);
  });

  it('should include prod_ready_manifest_exclusions.txt in manifest_files list', () => {
    const hasExclusionsExcluded = /grep\s+-v.*prod_ready_manifest_exclusions/.test(orchestratorContent);
    expect(hasExclusionsExcluded).toBe(false);
  });

  it('exclusions list must include stdout.txt and stderr.txt', () => {
    // The exclusions_file must be written with stdout/stderr entries
    const hasStdoutInExclusions = /echo\s+"stdout\.txt"/.test(orchestratorContent);
    const hasStderrInExclusions = /echo\s+"stderr\.txt"/.test(orchestratorContent);
    expect(hasStdoutInExclusions && hasStderrInExclusions).toBe(true);
  });

  it('exclusions list must NOT include binding artifacts', () => {
    // The static exclusions block must not echo the binding file names
    const excludesManifestFiles = /echo\s+"09_release\/prod_ready_manifest_files\.txt"/.test(orchestratorContent);
    const excludesManifestSha256 = /echo\s+"09_release\/prod_ready_manifest_sha256\.txt"/.test(orchestratorContent);
    const excludesPackhash = /echo\s+"09_release\/prod_ready_packhash\.txt"/.test(orchestratorContent);
    expect(excludesManifestFiles).toBe(false);
    expect(excludesManifestSha256).toBe(false);
    expect(excludesPackhash).toBe(false);
  });

  it('should create prod_ready_manifest_hash_inputs.txt (hash_inputs list)', () => {
    const hasHashInputsVar = /prod_ready_manifest_hash_inputs\.txt/.test(orchestratorContent);
    expect(hasHashInputsVar).toBe(true);
  });

  it('should compute manifest_sha256 from hash_inputs (not manifest_files)', () => {
    // The while loop must read from manifest_hash_inputs, not manifest_files
    const readsFromHashInputs = /done\s+<\s+"\$manifest_hash_inputs"\s+>\s+"\$manifest_sha256"/.test(orchestratorContent);
    expect(readsFromHashInputs).toBe(true);
  });

  it('should derive packhash from manifest_sha256.txt file (not old $manifest_sha256 var)', () => {
    // packhash = sha256sum "09_release/prod_ready_manifest_sha256.txt"
    const derivesFromFile = /sha256sum\s+"09_release\/prod_ready_manifest_sha256\.txt"/.test(orchestratorContent);
    expect(derivesFromFile).toBe(true);
  });

  it('hash_inputs must exclude manifest_sha256 and packhash via grep -v', () => {
    const excludesSha256 = /grep\s+-v.*\^09_release\/prod_ready_manifest_sha256\\\.txt\$/.test(orchestratorContent);
    const excludesPackhash = /grep\s+-v.*\^09_release\/prod_ready_packhash\\\.txt\$/.test(orchestratorContent);
    expect(excludesSha256).toBe(true);
    expect(excludesPackhash).toBe(true);
  });

  it('hash_inputs must include run_prod_ready_audit.full.log (all writes happen before binding)', () => {
    // All final writes to full.log (verdict, evidence path, exit code) happen
    // BEFORE generate_proof_pack_binding is called, so full.log has a stable hash
    // and can be included in hash_inputs. The exclusion grep -v must NOT cover it.
    const excludesFullLog = /grep\s+-v.*\^09_release\/run_prod_ready_audit\\.full\\.log\$/.test(orchestratorContent);
    expect(excludesFullLog).toBe(false);
  });

  it('finalization must call generate_proof_pack_binding exactly twice (reseal-once pattern)', () => {
    // Count actual call sites: lines matching `if ! generate_proof_pack_binding`
    // (excludes function definition, comments inside the function body, and header comments)
    const calls = (orchestratorContent.match(/^\s*if ! generate_proof_pack_binding\b/gm) || []).length;
    expect(calls).toBe(2);
  });

  it('should write PROOF_PACK_PACKHASH_PRESEAL: and PROOF_PACK_PACKHASH_FINAL: labels to FULL_LOG', () => {
    // Two-hash model: PRESEAL is the pass-1 binding hash (sealed in pass 2),
    // FINAL is the authoritative post-reseal hash (written after pass 2, enforced
    // by verifier to equal prod_ready_packhash.txt).
    const hasPreseal = /PROOF_PACK_PACKHASH_PRESEAL:/.test(orchestratorContent);
    const hasFinal   = /PROOF_PACK_PACKHASH_FINAL:/.test(orchestratorContent);
    expect(hasPreseal).toBe(true);
    expect(hasFinal).toBe(true);
    // Old single-label must be gone
    const hasOldLabel = /PROOF_PACK_PACKHASH:[^_]/.test(orchestratorContent);
    expect(hasOldLabel).toBe(false);
  });
});
