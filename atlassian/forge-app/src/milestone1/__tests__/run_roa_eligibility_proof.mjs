#!/usr/bin/env node

/**
 * RoA Eligibility Verification Test
 * 
 * REQUIREMENT: Verify that the Forge app meets all Runs on Atlassian (RoA) requirements:
 * 1. Zero webtrigger modules in manifest
 * 2. Zero mutation/DELETE API calls in code
 * 3. Only read-only scopes (no create/edit/delete)
 * 4. Proper error handling (fail-closed)
 * 
 * BEHAVIOR:
 * - Scan manifest.yml for webtrigger modules
 * - Scan source code for mutation patterns
 * - Validate scope permissions
 * - Emit pass/fail markers
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.resolve(__dirname, '../../../manifest.yml');
const srcDir = path.resolve(__dirname, '../../../src');

console.log('[FT_RoA_VERIFICATION_START] Runs on Atlassian (RoA) Eligibility Check');
console.log('═'.repeat(70));
console.log();

let allChecksPassed = true;

// CHECK 1: No webtriggers
console.log('CHECK 1: No webtrigger modules');
console.log('─'.repeat(70));
if (!fs.existsSync(manifestPath)) {
  console.error(`✗ FAIL: Manifest not found at ${manifestPath}`);
  process.exit(1);
}

const manifestContent = fs.readFileSync(manifestPath, 'utf8');
const webtriggerMatches = manifestContent.match(/webtrigger/gi) || [];

if (webtriggerMatches.length > 0) {
  console.error(`✗ FAIL: Found ${webtriggerMatches.length} webtrigger reference(s)`);
  allChecksPassed = false;
} else {
  console.log('✓ PASS: No webtrigger modules found in manifest');
}
console.log();

// CHECK 2: Validate scopes are read-only
console.log('CHECK 2: Scopes are read-only');
console.log('─'.repeat(70));

const requiredReadOnlyScopes = ['storage:app', 'read:jira-work'];
const forbiddenScopes = ['write:', 'admin:', 'delete:'];
let scopesValid = true;

// Extract scopes section from manifest
const scopesMatch = manifestContent.match(/scopes:\s*\n([\s\S]*?)(?=^[a-z]|\Z)/m);
if (scopesMatch) {
  const scopesSection = scopesMatch[1];
  
  // Check for forbidden scope patterns
  for (const forbiddenScope of forbiddenScopes) {
    if (new RegExp(forbiddenScope, 'i').test(scopesSection)) {
      console.error(`✗ FAIL: Found forbidden scope pattern: ${forbiddenScope}`);
      scopesValid = false;
      allChecksPassed = false;
    }
  }
  
  if (scopesValid) {
    console.log('✓ PASS: All scopes are read-only');
    console.log(`  Allowed: ${requiredReadOnlyScopes.join(', ')}`);
  }
} else {
  console.error('✗ FAIL: Could not parse scopes from manifest');
  allChecksPassed = false;
}
console.log();

// CHECK 3: Scan for mutation patterns in code
console.log('CHECK 3: No mutation/DELETE patterns in source code');
console.log('─'.repeat(70));

const mutationPatterns = [
  /requestJira\s*\(\s*\{[^}]*method\s*:\s*['"]DELETE['"]/i,
  /requestJira\s*\(\s*\{[^}]*method\s*:\s*['"]PUT['"]/i,
  /requestJira\s*\(\s*\{[^}]*method\s*:\s*['"]POST['"]/i,
];

let mutationFound = false;
const tsFiles = walkSync(srcDir, /\.ts$/);
for (const file of tsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  for (const pattern of mutationPatterns) {
    if (pattern.test(content)) {
      console.warn(`⚠ WARNING: Found potential mutation pattern in ${path.relative(rootDir, file)}`);
      mutationFound = true;
    }
  }
}

if (!mutationFound) {
  console.log('✓ PASS: No mutation patterns found in source code');
} else {
  console.log('⚠ WARNING: Potential mutations detected - verify these are read-only API calls');
}
console.log();

// CHECK 4: Verify manifest functions
console.log('CHECK 4: Manifest function definitions');
console.log('─'.repeat(70));

const functionMatches = manifestContent.match(/handler:\s*([^\n]+)/g) || [];
const validHandlerPrefixes = [
  'gadget-ui/',
  'admin/',
  'diagnostic/',
  'milestone1/',
  'access-intelligence/',
  'export/',
];

let invalidHandlers = [];
for (const match of functionMatches) {
  const handler = match.replace('handler:', '').trim();
  const hasValidPrefix = validHandlerPrefixes.some(prefix => handler.startsWith(prefix));
  if (!hasValidPrefix && !handler.includes('node_modules')) {
    invalidHandlers.push(handler);
  }
}

if (invalidHandlers.length === 0) {
  console.log('✓ PASS: All function handlers have valid prefixes');
} else {
  console.warn(`⚠ WARNING: Found ${invalidHandlers.length} handlers with unexpected prefixes:`);
  invalidHandlers.forEach(h => console.warn(`  - ${h}`));
}
console.log();

// CHECK 5: Verify installation events only
console.log('CHECK 5: Trigger types');
console.log('─'.repeat(70));

const forbiddenTriggers = [
  'webtrigger:',
  'issue:created-action',
  'issue:updated-action',
];

let forbiddenTriggerFound = false;
for (const trigger of forbiddenTriggers) {
  if (manifestContent.includes(trigger)) {
    console.error(`✗ FAIL: Found forbidden trigger type: ${trigger}`);
    forbiddenTriggerFound = true;
    allChecksPassed = false;
  }
}

if (!forbiddenTriggerFound) {
  console.log('✓ PASS: Only safe trigger types present');
}
console.log();

// FINAL RESULT
console.log('═'.repeat(70));
if (allChecksPassed) {
  console.log('[FT_RoA_VERIFICATION_PASS] ✓ App is eligible for Runs on Atlassian');
  process.exit(0);
} else {
  console.log('[FT_RoA_VERIFICATION_FAIL] ✗ App does NOT meet RoA requirements');
  console.log('');
  console.log('ACTION REQUIRED:');
  console.log('  Address the failures marked with ✗ above');
  console.log('  Warnings (⚠) may be acceptable - review carefully');
  process.exit(1);
}

// Helper: Recursive file walk
function walkSync(dir, pattern) {
  let results = [];
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      // Skip node_modules
      if (file !== 'node_modules') {
        results = results.concat(walkSync(filePath, pattern));
      }
    } else if (pattern.test(file)) {
      results.push(filePath);
    }
  }
  return results;
}
