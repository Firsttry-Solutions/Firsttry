#!/usr/bin/env node

/**
 * PHASE-4 & PHASE-5 COMBINED VERIFICATION HARNESS
 * 
 * Runs both Phase-4 and Phase-5 verification sequentially.
 * Fails if either fails.
 * Produces combined evidence file.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

const AUDIT_DIR = 'audit_artifacts/phase_4_5';
const EVIDENCE_FILE = path.join(AUDIT_DIR, 'VERIFY_PHASE4_5.txt');

async function ensureAuditDir() {
  try {
    await fs.mkdir(AUDIT_DIR, { recursive: true });
  } catch (err) {
    console.error(`Failed to create audit directory: ${err.message}`);
    throw err;
  }
}

async function runVerification(script, phase) {
  console.log(`\n╔════════════════════════════════════════════════════════╗`);
  console.log(`║  Running ${phase} Verification                          ║`);
  console.log(`╚════════════════════════════════════════════════════════╝\n`);

  try {
    const { stdout, stderr } = await execAsync(`node ${script}`, {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024,
      shell: '/bin/bash',
    });

    const output = stdout + (stderr ? '\n' + stderr : '');
    console.log(output);

    return {
      phase,
      script,
      exitCode: 0,
      success: true,
      output,
    };
  } catch (err) {
    const output = err.stdout + (err.stderr ? '\n' + err.stderr : '');
    console.log(output);
    console.error(`\n❌ ${phase} verification failed with exit code ${err.code}`);

    return {
      phase,
      script,
      exitCode: err.code || 1,
      success: false,
      output,
      error: err.message,
    };
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║    PHASE-4 & PHASE-5 COMBINED VERIFICATION (CI-READY)    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  const startTime = new Date();
  const results = {
    timestamp: startTime.toISOString(),
    repo_root: process.cwd(),
    phases: ['PHASE-4', 'PHASE-5'],
    verifications: [],
    overall_status: 'PASS',
  };

  try {
    await ensureAuditDir();
  } catch (err) {
    console.error('❌ Cannot create audit directory');
    process.exit(1);
  }

  // Run Phase-4
  const phase4Result = await runVerification('scripts/verify_phase4.mjs', 'PHASE-4');
  results.verifications.push({
    phase: 'PHASE-4',
    status: phase4Result.success ? 'PASS' : 'FAIL',
    exit_code: phase4Result.exitCode,
  });

  if (!phase4Result.success) {
    results.overall_status = 'FAIL';
  }

  // Run Phase-5
  const phase5Result = await runVerification('scripts/verify_phase5.mjs', 'PHASE-5');
  results.verifications.push({
    phase: 'PHASE-5',
    status: phase5Result.success ? 'PASS' : 'FAIL',
    exit_code: phase5Result.exitCode,
  });

  if (!phase5Result.success) {
    results.overall_status = 'FAIL';
  }

  const endTime = new Date();
  const duration = (endTime - startTime) / 1000;

  console.log('\n' + '═'.repeat(80));
  console.log('COMBINED VERIFICATION SUMMARY');
  console.log('═'.repeat(80));

  results.verifications.forEach((result) => {
    const status = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${status} ${result.phase}: ${result.status} (exit code: ${result.exit_code})`);
  });

  console.log(`\nDuration: ${duration.toFixed(2)}s`);

  if (results.overall_status === 'PASS') {
    console.log('\n✅ COMBINED VERIFICATION: ALL PHASES PASSED');
  } else {
    console.log('\n❌ COMBINED VERIFICATION: SOME PHASES FAILED');
  }

  // Write evidence file
  const evidenceText = `PHASE-4 & PHASE-5 COMBINED VERIFICATION EVIDENCE
Generated: ${startTime.toISOString()}
Repo Root: ${process.cwd()}
Duration: ${duration.toFixed(2)}s

PHASES VERIFIED:
- PHASE-4 (Jira ingestion, evidence storage, disclosure validation)
- PHASE-5 (Trust-building report generation with hard validation)

VERIFICATION RESULTS:
${results.verifications
  .map((v) => `${v.phase}: ${v.status} (exit code: ${v.exit_code})`)
  .join('\n')}

OVERALL STATUS: ${results.overall_status}

FINAL RESULT: ${results.overall_status === 'PASS' ? 'PASS ✅' : 'FAIL ❌'}

VERIFICATION SCRIPTS USED:
1. scripts/verify_phase4.mjs
2. scripts/verify_phase5.mjs
`;

  try {
    await fs.writeFile(EVIDENCE_FILE, evidenceText);
    console.log(`\n📄 Evidence written to: ${EVIDENCE_FILE}`);
  } catch (err) {
    console.error(`❌ Failed to write evidence file: ${err.message}`);
    process.exit(1);
  }

  process.exit(results.overall_status === 'PASS' ? 0 : 1);
}

main().catch((err) => {
  console.error('❌ Combined verification harness fatal error:', err.message);
  process.exit(1);
});
