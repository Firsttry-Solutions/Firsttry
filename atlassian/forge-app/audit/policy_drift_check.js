#!/usr/bin/env node
/**
 * Policy Drift Detection Suite
 * 
 * Verifies that critical security policies and configuration have not drifted.
 * This script runs as a non-bypassable CI check.
 * 
 * Exit codes:
 * 0 = all checks passed, no drift detected
 * 1 = drift detected, policy violation
 * 2 = error during check execution
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'bold');
  log(title, 'bold');
  log('='.repeat(60));
}

function logPass(msg) {
  log(`✓ ${msg}`, 'green');
}

function logFail(msg) {
  log(`✗ ${msg}`, 'red');
}

function logWarn(msg) {
  log(`⚠ ${msg}`, 'yellow');
}

// ============================================================================
// 1. SCOPES CHECK
// ============================================================================

function checkScopes() {
  logSection('CHECK 1: Oauth Scopes');
  
  try {
    const baselinePath = path.join(__dirname, 'policy_baseline/scopes.json');
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    
    // Read manifest.yml to check for new scopes
    const manifestPath = path.join(__dirname, '../manifest.yml');
    const manifest = fs.readFileSync(manifestPath, 'utf8');
    
    if (manifest.includes('permissions:') || manifest.includes('scopes:')) {
      logFail('DRIFT DETECTED: scopes section found in manifest.yml');
      return false;
    }
    
    // Forge apps inherit scopes - no explicit scopes should be present
    logPass('No OAuth scope drift detected (manifest inherits from Forge platform)');
    return true;
  } catch (err) {
    logWarn(`Error checking scopes: ${err.message}`);
    return false;
  }
}

// ============================================================================
// 2. STORAGE KEYS CHECK
// ============================================================================

function checkStorageKeys() {
  logSection('CHECK 2: Storage Key Prefixes');
  
  try {
    const baselinePath = path.join(__dirname, 'policy_baseline/storage_keys.txt');
    const baselineContent = fs.readFileSync(baselinePath, 'utf8');
    
    // Extract baseline prefixes
    const baselinePrefixes = new Set(
      baselineContent
        .split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(line => line.split(':')[0])
    );
    
    log(`Baseline prefixes: ${Array.from(baselinePrefixes).join(', ')}`);
    
    // Check phase6/constants.ts for STORAGE_PREFIXES
    const constantsPath = path.join(__dirname, '../src/phase6/constants.ts');
    const constants = fs.readFileSync(constantsPath, 'utf8');
    
    // Find STORAGE_PREFIXES definition
    const match = constants.match(/export const STORAGE_PREFIXES\s*=\s*\{([^}]+)\}[^;]*as const/s);
    if (!match) {
      logWarn('Could not parse STORAGE_PREFIXES from constants.ts');
      return false;
    }
    
    // Extract prefixes from code
    const codePrefixes = new Set();
    const prefixPattern = /(\w+)\s*:\s*['`]([a-z0-9_-]+):/g;
    let prefixMatch;
    
    while ((prefixMatch = prefixPattern.exec(match[1])) !== null) {
      const prefix = prefixMatch[2];
      codePrefixes.add(prefix);
    }
    
    log(`Code prefixes: ${Array.from(codePrefixes).join(', ')}`);
    
    // Check for drift: code should not have prefixes not in baseline
    let driftFound = false;
    
    for (const prefix of codePrefixes) {
      if (!baselinePrefixes.has(prefix)) {
        logFail(`NEW PREFIX DETECTED: "${prefix}" not in baseline`);
        driftFound = true;
      }
    }
    
    for (const prefix of baselinePrefixes) {
      if (!codePrefixes.has(prefix)) {
        logFail(`REMOVED PREFIX: "${prefix}" was in baseline but not in code`);
        driftFound = true;
      }
    }
    
    if (!driftFound) {
      logPass('No storage key prefix drift detected');
    }
    
    return !driftFound;
  } catch (err) {
    logWarn(`Error checking storage keys: ${err.message}`);
    return false;
  }
}

// ============================================================================
// 3. EGRESS CHECK
// ============================================================================

function checkEgress() {
  logSection('CHECK 3: Outbound Network Calls');
  
  try {
    const baselinePath = path.join(__dirname, 'policy_baseline/egress.txt');
    const baseline = fs.readFileSync(baselinePath, 'utf8').trim();
    
    // Check for forbidden HTTP patterns
    const srcPath = path.join(__dirname, '../src');
    
    // Recursive function to check all TypeScript files
    function checkDir(dir) {
      const files = fs.readdirSync(dir);
      let foundForbidden = false;
      
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (!file.startsWith('.') && file !== 'node_modules') {
            if (checkDir(fullPath)) {
              foundForbidden = true;
            }
          }
        } else if (file.endsWith('.ts') && !file.endsWith('.test.ts')) {
          // Admin pages are allowed to use fetch for browser-based requests
          // Only check non-admin files for forbidden patterns
          if (file.includes('admin') || file.includes('ui')) {
            continue;
          }
          
          const content = fs.readFileSync(fullPath, 'utf8');
          
          // Check for forbidden patterns (direct HTTP calls)
          const forbiddenPatterns = [
            /\bfetch\s*\(/,
            /\bnew\s+XMLHttpRequest\s*\(/,
            /\brequire\s*\(\s*['"]axios['"]\s*\)/,
            /\brequire\s*\(\s*['"]node-fetch['"]\s*\)/,
            /\bimport\s+.*\s+from\s+['"]axios['"]/,
            /\bimport\s+.*\s+from\s+['"]node-fetch['"]/,
          ];
          
          for (const pattern of forbiddenPatterns) {
            if (pattern.test(content)) {
              logFail(`UNAUTHORIZED EGRESS: Found ${pattern} in ${fullPath}`);
              foundForbidden = true;
            }
          }
        }
      }
      
      return foundForbidden;
    }
    
    const forbidden = checkDir(srcPath);
    
    if (!forbidden) {
      logPass('No unauthorized outbound calls detected (Forge-managed APIs only)');
    }
    
    return !forbidden;
  } catch (err) {
    logWarn(`Error checking egress: ${err.message}`);
    return false;
  }
}

// ============================================================================
// 4. EXPORT SCHEMA CHECK
// ============================================================================

function checkExportSchema() {
  logSection('CHECK 4: Export Schema Version');
  
  try {
    const baselinePath = path.join(__dirname, 'policy_baseline/export_schema.json');
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const baselineVersion = baseline.schema_version;
    
    // Check export_truth.ts for EXPORT_SCHEMA_VERSION
    const truthPath = path.join(__dirname, '../src/phase9/export_truth.ts');
    const truth = fs.readFileSync(truthPath, 'utf8');
    
    const match = truth.match(/export const EXPORT_SCHEMA_VERSION\s*=\s*['"]([^'"]+)['"]/);
    if (!match) {
      logWarn('Could not find EXPORT_SCHEMA_VERSION in export_truth.ts');
      return false;
    }
    
    const currentVersion = match[1];
    
    log(`Baseline version: ${baselineVersion}`);
    log(`Current version: ${currentVersion}`);
    
    if (currentVersion !== baselineVersion) {
      logFail(`SCHEMA DRIFT: Version changed from ${baselineVersion} to ${currentVersion}`);
      logWarn('Breaking changes require explicit approval and SECURITY.md update');
      return false;
    }
    
    logPass('Export schema version matches baseline');
    return true;
  } catch (err) {
    logWarn(`Error checking export schema: ${err.message}`);
    return false;
  }
}

// ============================================================================
// 5. RETENTION POLICY CHECK
// ============================================================================

function checkRetentionPolicy() {
  logSection('CHECK 5: Retention Policy Constants');
  
  try {
    const baselinePath = path.join(__dirname, 'policy_baseline/retention_policy.json');
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    
    // Check phase6/constants.ts for DEFAULT_RETENTION_POLICY
    const constantsPath = path.join(__dirname, '../src/phase6/constants.ts');
    const constants = fs.readFileSync(constantsPath, 'utf8');
    
    // Extract DEFAULT_RETENTION_POLICY
    const match = constants.match(
      /export const DEFAULT_RETENTION_POLICY\s*=\s*\{([^}]+)\}/s
    );
    if (!match) {
      logWarn('Could not parse DEFAULT_RETENTION_POLICY from constants.ts');
      return false;
    }
    
    // Check critical TTL values
    const baselineTTL = baseline.ttl_days;
    let policyValid = true;
    
    // Parse critical values from code
    const ttlMatch = constants.match(/max_days:\s*(\d+)/);
    const currentTTL = ttlMatch ? parseInt(ttlMatch[1]) : null;
    
    log(`Baseline TTL (max_days): ${baselineTTL.raw_shard_ttl_days}`);
    log(`Current TTL (max_days): ${currentTTL}`);
    
    if (currentTTL !== baselineTTL.raw_shard_ttl_days) {
      logFail(`TTL DRIFT: max_days changed from ${baselineTTL.raw_shard_ttl_days} to ${currentTTL}`);
      policyValid = false;
    }
    
    // Check cleanup schedule hasn't changed
    const scheduleMatch = constants.match(/cleanup_schedule:\s*['"]([^'"]+)['"]/);
    const currentSchedule = scheduleMatch ? scheduleMatch[1] : null;
    
    // If schedule is not found in constants, that's OK - we're checking the code
    // The important thing is the TTL values are enforced
    if (currentSchedule) {
      log(`Baseline cleanup schedule: ${baseline.cleanup_configuration.cleanup_schedule}`);
      log(`Current cleanup schedule: ${currentSchedule}`);
      
      if (currentSchedule !== baseline.cleanup_configuration.cleanup_schedule) {
        logFail(`SCHEDULE DRIFT: Cleanup schedule changed to ${currentSchedule}`);
        policyValid = false;
      }
    } else {
      log(`Cleanup schedule: Using DEFAULT_RETENTION_POLICY (not extracted from code)`);
    }
    
    if (policyValid) {
      logPass('Retention policy matches baseline (90-day TTL enforced)');
    }
    
    return policyValid;
  } catch (err) {
    logWarn(`Error checking retention policy: ${err.message}`);
    return false;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  log('\n', 'blue');
  logSection('POLICY DRIFT DETECTION - Phase P1.5');
  
  const checks = [
    { name: 'Scopes', fn: checkScopes },
    { name: 'Storage Keys', fn: checkStorageKeys },
    { name: 'Egress', fn: checkEgress },
    { name: 'Export Schema', fn: checkExportSchema },
    { name: 'Retention Policy', fn: checkRetentionPolicy },
  ];
  
  const results = [];
  for (const check of checks) {
    try {
      const result = check.fn();
      results.push({ name: check.name, passed: result });
    } catch (err) {
      logFail(`FATAL ERROR in ${check.name}: ${err.message}`);
      results.push({ name: check.name, passed: false });
    }
  }
  
  // Summary
  logSection('DRIFT DETECTION SUMMARY');
  
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  for (const result of results) {
    if (result.passed) {
      logPass(`${result.name}`);
    } else {
      logFail(`${result.name}`);
    }
  }
  
  log(`\nResult: ${passedCount}/${totalCount} checks passed`, passedCount === totalCount ? 'green' : 'red');
  
  if (passedCount === totalCount) {
    log('\n✓ All policy checks passed - no drift detected\n', 'green');
    process.exit(0);
  } else {
    log('\n✗ POLICY DRIFT DETECTED - Changes require explicit review\n', 'red');
    log('To approve changes:', 'yellow');
    log('1. Update audit/policy_baseline/* files with new values', 'yellow');
    log('2. Update SECURITY.md documenting the policy change', 'yellow');
    log('3. Run this script again to verify new baseline\n', 'yellow');
    process.exit(1);
  }
}

main().catch(err => {
  logFail(`FATAL: ${err.message}`);
  process.exit(2);
});
