#!/usr/bin/env node

/**
 * PHASE-4 VERIFICATION HARNESS
 * 
 * Runs all Phase-4 verification executables and captures output.
 * Fails hard if any exit code != 0.
 * Produces deterministic evidence file.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

const COMMANDS = [
  {
    name: 'test_phase4_standalone.js',
    cmd: 'node dist/test_phase4_standalone.js',
  },
  {
    name: 'test_disclosure_standalone.js',
    cmd: 'node dist/test_disclosure_standalone.js',
  },
  {
    name: 'test_gaps_a_f_enforcement.js',
    cmd: 'node dist/tests/tests/test_gaps_a_f_enforcement.js',
  },
];

const AUDIT_DIR = 'audit_artifacts/phase_4_5';
const EVIDENCE_FILE = path.join(AUDIT_DIR, 'VERIFY_PHASE4.txt');

async function ensureAuditDir() {
  try {
    await fs.mkdir(AUDIT_DIR, { recursive: true });
  } catch (err) {
    console.error(`Failed to create audit directory: ${err.message}`);
    throw err;
  }
}

async function runCommand(cmdObj) {
  console.log(`\n[${new Date().toISOString()}] Running: ${cmdObj.cmd}`);
  console.log('─'.repeat(80));

  try {
    const { stdout, stderr } = await execAsync(cmdObj.cmd, {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      shell: '/bin/bash',
    });

    const output = stdout + (stderr ? '\n' + stderr : '');
    return {
      name: cmdObj.name,
      cmd: cmdObj.cmd,
      exitCode: 0,
      output,
      success: true,
    };
  } catch (err) {
    const output = err.stdout + (err.stderr ? '\n' + err.stderr : '');
    return {
      name: cmdObj.name,
      cmd: cmdObj.cmd,
      exitCode: err.code || 1,
      output,
      success: false,
      error: err.message,
    };
  }
}

function summarizeOutput(output) {
  const lines = output.split('\n');
  if (lines.length <= 50) {
    return output;
  }
  return lines.slice(-50).join('\n');
}

function parseTestSummary(output) {
  // Look for common test summary patterns
  const patterns = [
    /(\d+)\/(\d+) tests passed/i,
    /passed: (\d+),\s*failed: (\d+)/i,
    /✓ .* \((\d+)\)/,
  ];

  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match) {
      return output.match(/.*(?:passed|PASS).*/i)?.[0] || 'Test summary found';
    }
  }

  // Look for PASS marker
  if (output.includes('PASS') || output.includes('passed')) {
    return 'Tests completed with PASS indicator';
  }

  return null;
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       PHASE-4 VERIFICATION HARNESS (CI-READY)            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  const startTime = new Date();
  const evidence = {
    timestamp: startTime.toISOString(),
    repo_root: process.cwd(),
    phase: 'PHASE-4',
    commands_executed: [],
    overall_status: 'PASS',
  };

  try {
    await ensureAuditDir();
  } catch (err) {
    console.error('❌ Cannot create audit directory');
    process.exit(1);
  }

  let allPassed = true;

  for (const cmdObj of COMMANDS) {
    const result = await runCommand(cmdObj);
    evidence.commands_executed.push({
      name: result.name,
      command: result.cmd,
      exit_code: result.exitCode,
      status: result.success ? 'PASS' : 'FAIL',
    });

    if (result.success) {
      console.log(`✅ PASS: ${result.name}`);
      const summary = parseTestSummary(result.output);
      if (summary) {
        console.log(`   → ${summary}`);
      }
    } else {
      console.log(`❌ FAIL: ${result.name}`);
      console.log(`   → Exit code: ${result.exitCode}`);
      console.log(`   → Error: ${result.error}`);
      allPassed = false;
    }

    console.log(`   → Output (last 50 lines):`);
    const summary = summarizeOutput(result.output);
    summary
      .split('\n')
      .forEach((line) => console.log(`      ${line}`));
  }

  const endTime = new Date();
  const duration = (endTime - startTime) / 1000;

  console.log('\n' + '═'.repeat(80));
  console.log(`Duration: ${duration.toFixed(2)}s`);

  if (allPassed) {
    console.log('✅ PHASE-4 VERIFICATION: ALL TESTS PASSED');
    evidence.overall_status = 'PASS';
  } else {
    console.log('❌ PHASE-4 VERIFICATION: SOME TESTS FAILED');
    evidence.overall_status = 'FAIL';
  }

  // Write evidence file
  const evidenceText = `PHASE-4 VERIFICATION EVIDENCE
Generated: ${startTime.toISOString()}
Repo Root: ${process.cwd()}
Duration: ${duration.toFixed(2)}s

COMMANDS EXECUTED:
${COMMANDS.map((c, i) => `${i + 1}. ${c.cmd}`).join('\n')}

RESULTS:
${evidence.commands_executed
  .map((cmd) => `${cmd.name}: ${cmd.status} (exit code: ${cmd.exit_code})`)
  .join('\n')}

OVERALL STATUS: ${evidence.overall_status}

FINAL RESULT: ${allPassed ? 'PASS ✅' : 'FAIL ❌'}
`;

  try {
    await fs.writeFile(EVIDENCE_FILE, evidenceText);
    console.log(`\n📄 Evidence written to: ${EVIDENCE_FILE}`);
  } catch (err) {
    console.error(`❌ Failed to write evidence file: ${err.message}`);
    process.exit(1);
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('❌ Verification harness fatal error:', err.message);
  process.exit(1);
});
