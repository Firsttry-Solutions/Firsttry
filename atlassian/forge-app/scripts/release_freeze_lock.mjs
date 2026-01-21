#!/usr/bin/env node
/**
 * release_freeze_lock.mjs
 *
 * Generates deterministic RELEASE freeze lock from git snapshot.
 * Computes frozenContentSha from git tree at RELEASE_PAYLOAD_COMMIT, not working tree.
 * 
 * CRITICAL: Avoids self-referential commit loop by:
 * 1. Accepting RELEASE_PAYLOAD_COMMIT as input (env var or default to HEAD)
 * 2. Computing content hash from git snapshot at that commit
 * 3. Excluding FREEZE_LOCK.json itself from hash computation
 * 4. Running all git commands from git root directory
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const REPO_ROOT = process.cwd();
const AUDIT_DIR = join(REPO_ROOT, 'audit');
const FREEZE_LOCK_PATH = join(AUDIT_DIR, 'marketplace_submission', 'FREEZE_LOCK.json');

/**
 * Compute frozenContentSha from git snapshot at given commit.
 * Hash is from git tree at that commit (deterministic, replicable).
 */
function computeFrozenContentShaFromGitSnapshot(commitSha) {
  console.log(`  Computing hash from git snapshot at ${commitSha}...`);
  
  // Find git root directory
  let gitRoot;
  try {
    gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8', cwd: REPO_ROOT }).trim();
  } catch (err) {
    throw new Error('Could not find git root');
  }
  
  // Get all files tracked in git at this commit under atlassian/forge-app/
  const filesOutput = execSync(
    `git ls-tree -r --name-only ${commitSha} -- atlassian/forge-app/`,
    { encoding: 'utf-8', cwd: gitRoot }
  );
  
  let files = filesOutput.split('\n').filter(f => f.trim());
  console.log(`  [DEBUG] Files before filtering: ${files.length}`);
  
  // Filter out excluded patterns
  const excludePatterns = [
    'audit/proof_runs',
    'OV_RESULTS',
    'SHK_REPORT',
    'audit/verification_reports',
    'audit/out_runs',
    'audit/.*OUT',
    'audit/state_assessment/run_',
    'audit/marketplace_submission/FREEZE_LOCK\\.json',  // CRITICAL: exclude lock file itself
    'node_modules/',
    'dist/'
  ];
  
  const excludeRegex = new RegExp(excludePatterns.join('|'));
  const beforeFilter = files.length;
  files = files.filter(f => !excludeRegex.test(f));
  console.log(`  [DEBUG] Files after filtering: ${files.length} (excluded: ${beforeFilter - files.length})`);
  
  // Sort lexicographically
  files.sort();
  
  // Build manifest: for each file, get blob content from git and hash it
  const manifest = [];
  for (const file of files) {
    try {
      // Pipe git show through sha256sum (bash-compatible)
      const hashOutput = execSync(
        `git show ${commitSha}:"${file}" | sha256sum`,
        { encoding: 'utf-8', cwd: gitRoot, stdio: ['pipe', 'pipe', 'pipe'] }
      );
      
      // Extract just the hex hash (first 64 chars)
      const blobHash = hashOutput.trim().split(/\s+/)[0];
      
      if (blobHash && blobHash.length === 64) {
        manifest.push(`${blobHash}  ${file}`);
      }
    } catch (err) {
      console.warn(`  ⚠ Could not hash ${file} at ${commitSha}`);
    }
  }
  
  // Sort manifest lines
  manifest.sort();
  
  // SHA256 of entire manifest = frozenContentSha
  // CRITICAL: Add trailing newline to match bash behavior (pipes include final newline)
  const manifestStr = manifest.join('\n') + '\n';
  const frozenSha = createHash('sha256').update(manifestStr).digest('hex');
  
  return frozenSha;
}

function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('RELEASE FREEZE LOCK GENERATOR');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // Accept payload commit from env var or use current HEAD
  let payloadCommit = process.env.RELEASE_PAYLOAD_COMMIT;
  if (!payloadCommit) {
    try {
      payloadCommit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
      console.log('ℹ RELEASE_PAYLOAD_COMMIT not set, using current HEAD');
    } catch (err) {
      console.error('❌ FAIL: Could not determine commit SHA');
      process.exit(1);
    }
  }
  console.log(`✓ Payload commit: ${payloadCommit}`);
  console.log('');

  // Get branch name
  let branch;
  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch (err) {
    branch = 'unknown';
  }

  // Validate payload commit exists
  try {
    execSync(`git cat-file -t ${payloadCommit}`, { encoding: 'utf-8', stdio: 'pipe' });
  } catch (err) {
    console.error(`❌ FAIL: Commit ${payloadCommit} not found`);
    process.exit(1);
  }

  // Compute frozenContentSha from git snapshot at payload commit
  console.log('📋 Computing frozenContentSha from git snapshot...');
  let frozenContentSha;
  try {
    frozenContentSha = computeFrozenContentShaFromGitSnapshot(payloadCommit);
  } catch (err) {
    console.error('❌ FAIL: Could not compute frozen content SHA');
    console.error(err.message);
    process.exit(1);
  }
  console.log(`✓ Frozen SHA: ${frozenContentSha}`);
  console.log('');

  // Write release freeze lock
  try {
    const releaseLock = {
      commitSha: payloadCommit,
      createdAtUtc: new Date().toISOString(),
      source: 'release_freeze_lock',
      frozenContentSha,
      method: 'git-tracked-files+sha256-manifest'
    };

    console.log(`📝 Writing release freeze lock to: ${FREEZE_LOCK_PATH}`);
    writeFileSync(FREEZE_LOCK_PATH, JSON.stringify(releaseLock, null, 2) + '\n');

    console.log('✅ Release freeze lock updated successfully');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('Payload commit snapshot frozen:');
    console.log(`  Commit:  ${payloadCommit}`);
    console.log(`  Branch:  ${branch}`);
    console.log(`  Time:    ${releaseLock.createdAtUtc}`);
    console.log(`  Content: ${frozenContentSha}`);
    console.log('═══════════════════════════════════════════════════════════════');
    
  } catch (err) {
    console.error('❌ FAIL: Could not write freeze lock');
    console.error(err.message);
    process.exit(1);
  }
}

main();
