/**
 * verify_golden_export.mjs — Golden Export Regression Gate
 *
 * Reads docs/artifacts/golden_export_combined.json, runs it through the offline
 * verifier (tools/verify_ecl_state.mjs), and requires VERIFIER_RESULT=FULL_PASS.
 *
 * Usage:  node tools/verify_golden_export.mjs
 * Exit:   0 on GOLDEN_VERIFY=PASS, 1 on any failure
 *
 * No external dependencies. Fail-closed.
 *
 * // FT_PROOF: GOLDEN_VERIFY_GATE_V1
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOOLS_DIR = __dirname;
const REPO_ROOT = path.resolve(TOOLS_DIR, '..');
const VERIFIER = path.join(TOOLS_DIR, 'verify_ecl_state.mjs');
const GOLDEN = path.join(REPO_ROOT, 'docs', 'artifacts', 'golden_export_combined.json');

// Precondition: required files must exist
if (!fs.existsSync(VERIFIER)) {
  console.error(`[GOLDEN_GATE] FAIL: verifier not found: ${VERIFIER}`);
  process.exit(1);
}
if (!fs.existsSync(GOLDEN)) {
  console.error(`[GOLDEN_GATE] FAIL: golden artifact not found: ${GOLDEN}`);
  process.exit(1);
}

let stdout = '';
let rc = 0;

try {
  stdout = execFileSync(process.execPath, [VERIFIER, GOLDEN], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (err) {
  stdout = err.stdout ?? '';
  rc = err.status ?? 1;
  if (err.stderr) {
    process.stderr.write('[GOLDEN_GATE] verifier stderr:\n' + err.stderr + '\n');
  }
}

// Print verifier output for traceability
process.stdout.write(stdout);

const fullPass = stdout.split('\n').some((line) => line.trim() === 'VERIFIER_RESULT=FULL_PASS');

if (!fullPass || rc !== 0) {
  console.error(`[GOLDEN_GATE] FAIL: verifier result not FULL_PASS (rc=${rc})`);
  process.exit(1);
}

console.log('GOLDEN_VERIFY=PASS');
process.exit(0);
