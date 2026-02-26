/**
 * proof_pack_verifier_invariants.test.ts
 *
 * Unit tests for tools/production/verify_prod_ready_proof_pack.sh.
 *
 * Invariants tested:
 * - Verifier fails (exit 1) when any required file is missing
 * - Verifier fails (exit 1) when packhash does not match recomputed value
 * - Verifier passes (exit 0) when all files are present and correct
 * - Verifier never prints PASS if required files are absent (fail-closed)
 * - Verifier rejects a pack where binding artifacts are in the exclusions list
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const REPO_ROOT = process.cwd();
const VERIFIER = path.join(REPO_ROOT, 'tools/production/verify_prod_ready_proof_pack.sh');

// ---------------------------------------------------------------------------
// Helper: create a minimal but fully valid proof pack in packDir
// ---------------------------------------------------------------------------
const PACK_SETUP_SCRIPT = `#!/bin/bash
set -euo pipefail
PACK="$1"
mkdir -p "$PACK/09_release"

# Content files
echo "PASS"             > "$PACK/PROD_READY_VERDICT.txt"
echo "0"                > "$PACK/09_release/run_prod_ready_audit.exit_code.txt"
echo "step output data" > "$PACK/09_release/some_step.txt"
# full.log is fully written before binding generation (all final writes happen first),
# so it is included in hash_inputs and gets a stable sha256
echo "All verifications passed."     > "$PACK/09_release/run_prod_ready_audit.full.log"
echo "Evidence directory: $PACK"    >> "$PACK/09_release/run_prod_ready_audit.full.log"
echo "Exit code: 0"                 >> "$PACK/09_release/run_prod_ready_audit.full.log"

cd "$PACK"

# Pre-create ALL binding files as empty BEFORE find runs (so find enumerates them).
# This mirrors exactly what run_prod_ready_audit.sh does with ': >' before the find.
: > 09_release/prod_ready_manifest_files.txt
: > 09_release/prod_ready_manifest_hash_inputs.txt
: > 09_release/prod_ready_manifest_sha256.txt
: > 09_release/prod_ready_packhash.txt
: > 09_release/prod_ready_manifest_exclusions.txt

# Exclusions: stdout/stderr only (binding artifacts NOT excluded)
printf 'stderr.txt\\nstdout.txt\\n' > 09_release/prod_ready_manifest_exclusions.txt

# manifest_files: all files except stdout/stderr (includes all binding artifacts
# because they were pre-created above before find runs)
export LC_ALL=C
find . -type f \\
  | sed 's|^\\./||' \\
  | grep -v '^stdout\\.txt$' \\
  | grep -v '^stderr\\.txt$' \\
  | LC_ALL=C sort > 09_release/prod_ready_manifest_files.txt

# hash_inputs: manifest_files minus the two computed-output files only
# (full.log IS included: all writes to it finish before binding generation)
grep -v '^09_release/prod_ready_manifest_sha256\.txt$' 09_release/prod_ready_manifest_files.txt \\
  | grep -v '^09_release/prod_ready_packhash\.txt$' \\
  > 09_release/prod_ready_manifest_hash_inputs.txt

# manifest_sha256 pass 1: sha256 of each file in hash_inputs
while IFS= read -r f; do
  sha256sum "$f"
done < 09_release/prod_ready_manifest_hash_inputs.txt > 09_release/prod_ready_manifest_sha256.txt

# packhash pass 1: sha256 of manifest_sha256.txt
sha256sum 09_release/prod_ready_manifest_sha256.txt | awk '{print $1}' > 09_release/prod_ready_packhash.txt

# Append PROOF_PACK_* summary lines to full.log (mirrors run_prod_ready_audit.sh)
_ph=$(cat 09_release/prod_ready_packhash.txt)
echo "" >> 09_release/run_prod_ready_audit.full.log
echo "PROOF_PACK_DIR: $PACK" >> 09_release/run_prod_ready_audit.full.log
echo "PROOF_PACK_PACKHASH: $_ph" >> 09_release/run_prod_ready_audit.full.log
echo "PROOF_PACK_HASH_INPUTS_FILE: 09_release/prod_ready_manifest_hash_inputs.txt" >> 09_release/run_prod_ready_audit.full.log
echo "PROOF_PACK_EXCLUSIONS_FILE: 09_release/prod_ready_manifest_exclusions.txt" >> 09_release/run_prod_ready_audit.full.log
echo "PROOF_PACK_VERIFY_CMD: bash tools/production/verify_prod_ready_proof_pack.sh \"$PACK\"" >> 09_release/run_prod_ready_audit.full.log

# Reseal pass 2: recompute binding so PROOF_PACK lines are included in hash
while IFS= read -r f; do
  sha256sum "$f"
done < 09_release/prod_ready_manifest_hash_inputs.txt > 09_release/prod_ready_manifest_sha256.txt
sha256sum 09_release/prod_ready_manifest_sha256.txt | awk '{print $1}' > 09_release/prod_ready_packhash.txt
`;

function createValidPack(packDir: string): void {
  const scriptPath = path.join(os.tmpdir(), `ft_proof_pack_setup_${process.pid}.sh`);
  fs.writeFileSync(scriptPath, PACK_SETUP_SCRIPT, { mode: 0o755 });
  try {
    execSync(`bash "${scriptPath}" "${packDir}"`, { stdio: 'pipe' });
  } finally {
    try { fs.unlinkSync(scriptPath); } catch {}
  }
}

function runVerifier(packDir: string): { exitCode: number; stdout: string; stderr: string } {
  const result = spawnSync('bash', [VERIFIER, packDir], {
    encoding: 'utf-8',
    env: { ...process.env, LC_ALL: 'C' },
  });
  return {
    exitCode: result.status ?? 1,
    stdout:   result.stdout ?? '',
    stderr:   result.stderr ?? '',
  };
}

describe('Proof Pack Verifier Invariants', () => {
  let packDir: string;

  beforeEach(() => {
    packDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ft_pv_test_'));
  });

  afterEach(() => {
    if (packDir && fs.existsSync(packDir)) {
      fs.rmSync(packDir, { recursive: true, force: true });
    }
  });

  // ── Required-file present: script exists ────────────────────────────────────
  it('verifier script must exist and be readable', () => {
    expect(fs.existsSync(VERIFIER)).toBe(true);
    const content = fs.readFileSync(VERIFIER, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
  });

  // ── No argument: fail-closed ─────────────────────────────────────────────────
  it('should fail with exit 1 when no argument is given', () => {
    const result = spawnSync('bash', [VERIFIER], { encoding: 'utf-8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('FAIL');
    expect(result.stdout).not.toContain('PASS');
  });

  // ── Non-existent directory ───────────────────────────────────────────────────
  it('should fail with exit 1 when directory does not exist', () => {
    const r = runVerifier('/tmp/ft_does_not_exist_12345678');
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('FAIL');
    expect(r.stdout).not.toContain('PASS');
  });

  // ── Required file missing ────────────────────────────────────────────────────
  const REQUIRED = [
    '09_release/prod_ready_manifest_files.txt',
    '09_release/prod_ready_manifest_sha256.txt',
    '09_release/prod_ready_manifest_hash_inputs.txt',
    '09_release/prod_ready_packhash.txt',
    '09_release/prod_ready_manifest_exclusions.txt',
    'PROD_READY_VERDICT.txt',
    '09_release/run_prod_ready_audit.exit_code.txt',
    '09_release/run_prod_ready_audit.full.log',
  ];

  for (const missingFile of REQUIRED) {
    it(`should fail (exit 1) when required file is missing: ${missingFile}`, () => {
      createValidPack(packDir);
      // Remove the required file
      fs.unlinkSync(path.join(packDir, missingFile));

      const r = runVerifier(packDir);
      expect(r.exitCode).toBe(1);
      expect(r.stderr + r.stdout).toContain('FAIL');
      // Must NOT print PASS anywhere (fail-closed)
      expect(r.stdout).not.toContain('STATUS      : PASS');
    });
  }

  // ── Empty file in required set ───────────────────────────────────────────────
  it('should fail (exit 1) when packhash file is empty', () => {
    createValidPack(packDir);
    fs.writeFileSync(path.join(packDir, '09_release/prod_ready_packhash.txt'), '');

    const r = runVerifier(packDir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr + r.stdout).toContain('FAIL');
    expect(r.stdout).not.toContain('STATUS      : PASS');
  });

  // ── Packhash mismatch ────────────────────────────────────────────────────────
  it('should fail (exit 1) when packhash does not match recomputed value', () => {
    createValidPack(packDir);
    // Corrupt the packhash
    const corrupt = 'a'.repeat(64); // Valid hex format but wrong value
    fs.writeFileSync(path.join(packDir, '09_release/prod_ready_packhash.txt'), corrupt + '\n');

    const r = runVerifier(packDir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('FAIL');
    expect(r.stderr).toContain('packhash mismatch');
    expect(r.stdout).not.toContain('STATUS      : PASS');
  });

  // ── manifest_sha256 mismatch ─────────────────────────────────────────────────
  it('should fail (exit 1) when a content file is tampered (sha256 mismatch)', () => {
    createValidPack(packDir);
    // Tamper with a content file after hashes are computed
    fs.appendFileSync(path.join(packDir, '09_release/some_step.txt'), '\nTAMPERED');

    const r = runVerifier(packDir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('FAIL');
    expect(r.stdout).not.toContain('STATUS      : PASS');
  });

  // ── Binding artifact incorrectly in exclusions ────────────────────────────────
  it('should fail (exit 1) when a binding artifact appears in exclusions', () => {
    createValidPack(packDir);
    // Corrupt exclusions to include a binding artifact
    const addedLine = '09_release/prod_ready_manifest_files.txt';
    fs.appendFileSync(path.join(packDir, '09_release/prod_ready_manifest_exclusions.txt'), `\n${addedLine}\n`);

    const r = runVerifier(packDir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('FAIL');
    expect(r.stdout).not.toContain('STATUS      : PASS');
  });

  // ── Missing PROOF_PACK_PACKHASH label in full.log ────────────────────────────
  it('should fail (exit 1) when full.log has no PROOF_PACK_PACKHASH: label', () => {
    // Build a pack whose full.log intentionally has no PROOF_PACK_PACKHASH label.
    // The binding is still valid for this content (no label = never written by real script).
    const SCRIPT_NO_LABEL = `#!/bin/bash
set -euo pipefail
PACK="$1"
mkdir -p "$PACK/09_release"
echo "PASS"             > "$PACK/PROD_READY_VERDICT.txt"
echo "0"                > "$PACK/09_release/run_prod_ready_audit.exit_code.txt"
echo "step output data" > "$PACK/09_release/some_step.txt"
# full.log WITHOUT any PROOF_PACK_PACKHASH line
echo "All verifications passed." > "$PACK/09_release/run_prod_ready_audit.full.log"
cd "$PACK"
: > 09_release/prod_ready_manifest_files.txt
: > 09_release/prod_ready_manifest_hash_inputs.txt
: > 09_release/prod_ready_manifest_sha256.txt
: > 09_release/prod_ready_packhash.txt
: > 09_release/prod_ready_manifest_exclusions.txt
printf 'stderr.txt\\nstdout.txt\\n' > 09_release/prod_ready_manifest_exclusions.txt
export LC_ALL=C
find . -type f | sed 's|^\\./||' | grep -v '^stdout\\.txt\$' | grep -v '^stderr\\.txt\$' | LC_ALL=C sort > 09_release/prod_ready_manifest_files.txt
grep -v '^09_release/prod_ready_manifest_sha256\\.txt\$' 09_release/prod_ready_manifest_files.txt \\
  | grep -v '^09_release/prod_ready_packhash\\.txt\$' \\
  > 09_release/prod_ready_manifest_hash_inputs.txt
while IFS= read -r f; do sha256sum "$f"; done < 09_release/prod_ready_manifest_hash_inputs.txt > 09_release/prod_ready_manifest_sha256.txt
sha256sum 09_release/prod_ready_manifest_sha256.txt | awk '{print $1}' > 09_release/prod_ready_packhash.txt
`;
    const scriptPath = path.join(os.tmpdir(), `ft_nolabel_${process.pid}.sh`);
    fs.writeFileSync(scriptPath, SCRIPT_NO_LABEL, { mode: 0o755 });
    try {
      execSync(`bash "${scriptPath}" "${packDir}"`, { stdio: 'pipe' });
    } finally {
      try { fs.unlinkSync(scriptPath); } catch {}
    }

    const r = runVerifier(packDir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('FAIL');
    expect(r.stderr).toContain('PROOF_PACK_PACKHASH');
    expect(r.stdout).not.toContain('STATUS      : PASS');
  });

  // ── Valid pack: passes ────────────────────────────────────────────────────────
  it('should pass (exit 0) with a fully valid proof pack', () => {
    createValidPack(packDir);

    const r = runVerifier(packDir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('STATUS      : PASS');
    expect(r.stdout).not.toContain('FAIL');
    expect(r.stderr).toBe('');
  });

  it('valid pack must show correct manifest and hash_inputs line counts', () => {
    createValidPack(packDir);

    const r = runVerifier(packDir);
    expect(r.exitCode).toBe(0);
    // manifest_files count ≥ hash_inputs count (sha256 and packhash excluded from inputs)
    const mfCount  = parseInt(r.stdout.match(/Manifest\s+:\s+(\d+)/)?.[1] ?? '0', 10);
    const hiCount  = parseInt(r.stdout.match(/Hash inputs\s+:\s+(\d+)/)?.[1] ?? '0', 10);
    expect(mfCount).toBeGreaterThan(0);
    expect(hiCount).toBeGreaterThan(0);
    expect(mfCount).toBeGreaterThanOrEqual(hiCount);
  });

  it('valid pack: manifest_files must include all binding artifacts', () => {
    createValidPack(packDir);
    const manifestContent = fs.readFileSync(
      path.join(packDir, '09_release/prod_ready_manifest_files.txt'), 'utf-8'
    );
    for (const artifact of [
      '09_release/prod_ready_manifest_files.txt',
      '09_release/prod_ready_manifest_sha256.txt',
      '09_release/prod_ready_manifest_hash_inputs.txt',
      '09_release/prod_ready_packhash.txt',
      '09_release/prod_ready_manifest_exclusions.txt',
    ]) {
      expect(manifestContent, `manifest must include ${artifact}`).toContain(artifact);
    }
  });

  it('valid pack: exclusions must include stdout/stderr and NOT include binding artifacts', () => {
    createValidPack(packDir);
    const exclusions = fs.readFileSync(
      path.join(packDir, '09_release/prod_ready_manifest_exclusions.txt'), 'utf-8'
    );
    expect(exclusions).toContain('stdout.txt');
    expect(exclusions).toContain('stderr.txt');
    expect(exclusions).not.toContain('prod_ready_manifest_files.txt');
    expect(exclusions).not.toContain('prod_ready_manifest_sha256.txt');
    expect(exclusions).not.toContain('prod_ready_packhash.txt');
  });

  it('valid pack: hash_inputs must NOT include manifest_sha256 or packhash, but MUST include full.log', () => {
    createValidPack(packDir);
    const hashInputs = fs.readFileSync(
      path.join(packDir, '09_release/prod_ready_manifest_hash_inputs.txt'), 'utf-8'
    );
    expect(hashInputs).not.toContain('prod_ready_manifest_sha256.txt');
    expect(hashInputs).not.toContain('prod_ready_packhash.txt');
    // full.log IS in hash_inputs: all writes to it finish before binding generation
    expect(hashInputs).toContain('run_prod_ready_audit.full.log');
  });
});
