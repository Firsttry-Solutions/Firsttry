#!/usr/bin/env node
/**
 * EXTERNAL PREFLIGHT PARSE HELPER
 * 
 * Purpose: Parse build metadata and distribution artifacts for cache verification
 * Read-only diagnostic tool - no modifications
 * 
 * Usage: node tools/external_preflight_parse.mjs [command]
 * Commands:
 *   build-meta    - Parse tools/.build_meta.json
 *   dist-compare  - Compare dist artifacts with build meta
 *   all           - Run all checks
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// UTILITIES
// ============================================================================

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function error(msg) {
  console.error(`[${new Date().toISOString()}] ERROR: ${msg}`);
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function computeFileHash(filePath, algorithm = 'sha256') {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash(algorithm).update(content).digest('hex');
  } catch (err) {
    error(`Failed to hash ${filePath}: ${err.message}`);
    return null;
  }
}

// ============================================================================
// PARSE BUILD METADATA
// ============================================================================

function parseBuildMeta() {
  const buildMetaPath = path.join(__dirname, '..', 'tools', '.build_meta.json');
  
  log('Parsing build metadata...');
  
  if (!fileExists(buildMetaPath)) {
    error(`Build meta file not found: ${buildMetaPath}`);
    console.log('Build metadata: NOT FOUND');
    return null;
  }
  
  try {
    const content = fs.readFileSync(buildMetaPath, 'utf8');
    const meta = JSON.parse(content);
    
    console.log('Build Metadata:');
    console.log(`  FT_BUILD_SHA: ${meta.FT_BUILD_SHA || 'MISSING'}`);
    console.log(`  FT_BUILD_TIME_UTC: ${meta.FT_BUILD_TIME_UTC || 'MISSING'}`);
    console.log(`  NODE_ENV: ${meta.NODE_ENV || 'MISSING'}`);
    console.log(`  Git HEAD at build: ${meta.GIT_HEAD_AT_BUILD || 'MISSING'}`);
    
    return meta;
  } catch (err) {
    error(`Failed to parse build metadata: ${err.message}`);
    return null;
  }
}

// ============================================================================
// COMPARE DIST ARTIFACTS
// ============================================================================

function compareDist(buildMeta) {
  const distPath = path.join(__dirname, '..', 'src', 'gadget-ui', 'dist');
  
  log('Comparing distribution artifacts...');
  
  if (!fileExists(distPath)) {
    error(`Distribution directory not found: ${distPath}`);
    console.log('Distribution artifacts: NOT FOUND');
    console.log('ACTION: Run "npm run build:gadget" to generate distribution');
    return null;
  }
  
  console.log('Distribution Artifacts:');
  
  // List files
  try {
    const files = [];
    function walkDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else {
          const relPath = path.relative(distPath, fullPath);
          const size = fs.statSync(fullPath).size;
          const hash = computeFileHash(fullPath);
          files.push({ relPath, size, hash });
        }
      }
    }
    walkDir(distPath);
    
    console.log(`  Total files: ${files.length}`);
    console.log(`  Total size: ${files.reduce((sum, f) => sum + f.size, 0)} bytes`);
    console.log('');
    console.log('  Files:');
    for (const file of files.sort((a, b) => a.relPath.localeCompare(b.relPath))) {
      console.log(`    ${file.relPath} (${file.size} bytes, SHA256: ${file.hash.substring(0, 16)}...)`);
    }
    
    return files;
  } catch (err) {
    error(`Failed to analyze distribution: ${err.message}`);
    return null;
  }
}

// ============================================================================
// VERIFY BUILD AND DIST CONSISTENCY
// ============================================================================

function verifyConsistency(buildMeta, distFiles) {
  log('Verifying build and distribution consistency...');
  
  console.log('Consistency Check:');
  
  if (!buildMeta) {
    console.log('  Build metadata: NOT FOUND');
    console.log('  VERDICT: UNKNOWN (build meta missing)');
    return { status: 'UNKNOWN', reason: 'Build metadata not found' };
  }
  
  if (!distFiles) {
    console.log('  Distribution artifacts: NOT FOUND');
    console.log('  VERDICT: UNKNOWN (distribution not found)');
    return { status: 'UNKNOWN', reason: 'Distribution artifacts not found' };
  }
  
  const checks = [];
  
  // Check 1: Build SHA exists
  if (buildMeta.FT_BUILD_SHA) {
    console.log(`  ✓ Build SHA present: ${buildMeta.FT_BUILD_SHA}`);
    checks.push(true);
  } else {
    console.log('  ✗ Build SHA missing');
    checks.push(false);
  }
  
  // Check 2: Build time is recent (within 24 hours)
  if (buildMeta.FT_BUILD_TIME_UTC) {
    const buildTime = new Date(buildMeta.FT_BUILD_TIME_UTC);
    const now = new Date();
    const diffHours = (now - buildTime) / (1000 * 60 * 60);
    if (diffHours < 24) {
      console.log(`  ✓ Build time recent: ${diffHours.toFixed(1)} hours ago`);
      checks.push(true);
    } else {
      console.log(`  ⚠ Build time old: ${diffHours.toFixed(1)} hours ago (may indicate stale assets)`);
      checks.push(false);
    }
  } else {
    console.log('  ✗ Build time missing');
    checks.push(false);
  }
  
  // Check 3: Distribution has core files
  const coreFiles = ['index.html', 'assets'];
  const hasCoreFiles = coreFiles.every(name => distFiles.some(f => f.relPath.includes(name)));
  if (hasCoreFiles) {
    console.log('  ✓ Core distribution files present');
    checks.push(true);
  } else {
    console.log('  ✗ Missing core distribution files');
    checks.push(false);
  }
  
  // Check 4: Distribution has assets
  const hasAssets = distFiles.some(f => f.relPath.includes('.js') || f.relPath.includes('.css'));
  if (hasAssets) {
    console.log('  ✓ JavaScript and CSS assets present');
    checks.push(true);
  } else {
    console.log('  ✗ Missing JavaScript/CSS assets');
    checks.push(false);
  }
  
  console.log('');
  
  const passCount = checks.filter(c => c).length;
  const totalCount = checks.length;
  
  if (passCount === totalCount) {
    console.log(`VERDICT: PASS (${passCount}/${totalCount} checks passed)`);
    return { status: 'PASS', reason: `All ${totalCount} consistency checks passed` };
  } else if (passCount >= totalCount / 2) {
    console.log(`VERDICT: CONDITIONAL (${passCount}/${totalCount} checks passed)`);
    return { status: 'CONDITIONAL', reason: `${passCount}/${totalCount} checks passed; may have stale assets` };
  } else {
    console.log(`VERDICT: FAIL (${passCount}/${totalCount} checks passed)`);
    return { status: 'FAIL', reason: `Only ${passCount}/${totalCount} checks passed; distribution may be broken` };
  }
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  const command = process.argv[2] || 'all';
  
  console.log('='.repeat(80));
  console.log('EXTERNAL PREFLIGHT PARSE HELPER');
  console.log('='.repeat(80));
  console.log('');
  
  let buildMeta = null;
  let distFiles = null;
  
  if (command === 'build-meta' || command === 'all') {
    buildMeta = parseBuildMeta();
    console.log('');
  }
  
  if (command === 'dist-compare' || command === 'all') {
    distFiles = compareDist(buildMeta);
    console.log('');
  }
  
  if ((command === 'all' || command === 'verify') && buildMeta && distFiles) {
    const result = verifyConsistency(buildMeta, distFiles);
    console.log('');
    console.log('='.repeat(80));
    console.log(`Overall Status: ${result.status}`);
    console.log(`Reason: ${result.reason}`);
    console.log('='.repeat(80));
    
    if (result.status === 'FAIL') {
      process.exit(1);
    }
  }
  
  console.log('');
  console.log('Parse complete');
}

main();
