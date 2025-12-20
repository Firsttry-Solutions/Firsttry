#!/usr/bin/env node

/**
 * PHASE-5 VERIFICATION HARNESS
 * 
 * Compiles Phase-5 TypeScript and runs Phase-5 vitest tests.
 * Fails hard if any step fails.
 * Produces deterministic evidence file.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

const COMMANDS = [
  {
    name: 'TypeScript Compilation',
    cmd: 'npx tsc src/phase5_report_contract.ts src/phase5_report_generator.ts --noEmit --lib es2020 --skipLibCheck',
    description: 'Compile Phase-5 contract and generator',
  },
  {
    name: 'Phase-5 Validation Tests',
    cmd: 'npx vitest run tests/test_phase5_validation.ts --reporter=verbose',
    description: 'Run Phase-5 validation test suite (17 tests)',
  },
];

const AUDIT_DIR = 'audit_artifacts/phase_4_5';
const EVIDENCE_FILE = path.join(AUDIT_DIR, 'VERIFY_PHASE5.txt');

async function ensureAuditDir() {
  try {
    await fs.mkdir(AUDIT_DIR, { recursive: true });
  } catch (err) {
    console.error(`Failed to create audit directory: ${err.message}`);
    throw err;
  }
}

async function runCommand(cmdObj) {
  console.log(`\n[${new Date().toISOString()}] Running: ${cmdObj.description}`);
  console.log(`   Command: ${cmdObj.cmd}`);
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

function extractTestSummary(output) {
  // Look for vitest summary
  const vitestMatch = output.match(/Test Files\s+\d+\s+passed.*\n\s+Tests\s+(\d+)\s+passed/);
  if (vitestMatch) {
    return vitestMatch[0].trim();
  }

  // Look for compilation success
  if (output.includes('0 errors') || !output.match(/error|fail/i)) {
    return 'No errors detected';
  }

  return null;
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       PHASE-5 VERIFICATION HARNESS (CI-READY)            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  const startTime = new Date();
  const evidence = {
    timestamp: startTime.toISOString(),
    repo_root: process.cwd(),
    phase: 'PHASE-5',
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
      const summary = extractTestSummary(result.output);
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
    console.log('✅ PHASE-5 VERIFICATION: ALL TESTS PASSED');
    evidence.overall_status = 'PASS';
  } else {
    console.log('❌ PHASE-5 VERIFICATION: SOME TESTS FAILED');
    evidence.overall_status = 'FAIL';
  }

  // Write evidence file
  const evidenceText = `PHASE-5 VERIFICATION EVIDENCE
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
