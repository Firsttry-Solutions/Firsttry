#!/usr/bin/env node

/**
 * BACKBONE LAYER 0: CI Guard Test (JavaScript/ESM version)
 *
 * Ensures that:
 * 1. All UI invocations match registered backend resolvers
 * 2. No direct invoke() calls exist in main.ts (all use invokeWithUiReqId wrapper)
 *
 * This test FAILS the build if instrumentation wiring is broken.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// File paths
const mainTsPath = path.join(__dirname, '..', 'src', 'gadget-ui', 'src', 'main.ts');
const resolverTsPath = path.join(__dirname, '..', 'src', 'gadget-resolver.ts');

console.log('[BACKBONE_GUARD] Starting CI wiring validation...\n');

// ============================================================================
// TEST 1: Extract UI resolver invocations using invokeWithUiReqId wrapper
// ============================================================================
console.log('[TEST 1] Checking UI resolver invocations...');

const mainContent = fs.readFileSync(mainTsPath, 'utf8');

// Find all invokeWithUiReqId('NAME', ...) calls
const uiInvocationRegex = /invokeWithUiReqId\s*\(\s*['"]([^'"]+)['"]/g;
const uiInvocations = new Set();
let match;

while ((match = uiInvocationRegex.exec(mainContent)) !== null) {
  uiInvocations.add(match[1]);
}

console.log(`  ✓ Found ${uiInvocations.size} unique UI resolver invocations`);
console.log(`    Resolvers: ${Array.from(uiInvocations).sort().join(', ')}`);

if (uiInvocations.size === 0) {
  console.error('  ✗ FAIL: No UI resolver invocations found!');
  process.exit(1);
}

// ============================================================================
// TEST 2: Verify NO direct invoke() calls remain in main.ts
// ============================================================================
console.log('\n[TEST 2] Checking for direct invoke() calls (should be ZERO)...');

// Look for direct invoke(...) calls that are NOT invokeWithUiReqId
// Split by lines and filter out comments
const lines = mainContent.split('\n');
let directInvokeCount = 0;

for (const line of lines) {
  // Skip comments and strings that mention invoke
  if (line.trim().startsWith('//') || line.includes('invoke() is') || line.includes('invoke Not Available')) {
    continue;
  }
  
  // Look for await invoke( or = invoke(
  if (line.includes('await invoke(') && !line.includes('invokeWithUiReqId')) {
    console.error(`  ✗ Found direct invoke() call: ${line.trim().substring(0, 80)}`);
    directInvokeCount++;
  }
}

if (directInvokeCount > 0) {
  console.error(`  ✗ FAIL: Found ${directInvokeCount} direct invoke() calls (should use invokeWithUiReqId)`);
  process.exit(1);
}

console.log('  ✓ No direct invoke() calls found - all using wrapper');

// ============================================================================
// TEST 3: Extract backend resolver definitions
// ============================================================================
console.log('\n[TEST 3] Checking backend resolver registrations...');

const resolverContent = fs.readFileSync(resolverTsPath, 'utf8');

// Find all resolver.define('NAME', ...) calls
const resolverRegex = /resolver\.define\s*\(\s*['"]([^'"]+)['"]/g;
const backendResolvers = new Set();

while ((match = resolverRegex.exec(resolverContent)) !== null) {
  backendResolvers.add(match[1]);
}

console.log(`  ✓ Found ${backendResolvers.size} registered backend resolvers`);
console.log(`    Resolvers: ${Array.from(backendResolvers).sort().join(', ')}`);

// ============================================================================
// TEST 4: Verify UI ⊆ Backend (all UI calls have backend handlers)
// ============================================================================
console.log('\n[TEST 4] Validating UI ⊆ Backend resolver wiring...');

const missingResolvers = [];
for (const uiResolver of uiInvocations) {
  if (!backendResolvers.has(uiResolver)) {
    missingResolvers.push(uiResolver);
  }
}

if (missingResolvers.length > 0) {
  console.error(`  ✗ FAIL: ${missingResolvers.length} UI resolvers NOT registered in backend:`);
  missingResolvers.forEach(resolver => {
    console.error(`    - ${resolver}`);
  });
  process.exit(1);
}

console.log(`  ✓ All ${uiInvocations.size} UI resolvers are registered in backend`);

// ============================================================================
// TEST 5: Extract backend_build.ts and verify format
// ============================================================================
console.log('\n[TEST 5] Checking backend_build.ts injection...');

const backendBuildPath = path.join(__dirname, '..', 'src', 'build', 'backend_build.ts');
if (!fs.existsSync(backendBuildPath)) {
  console.error(`  ✗ FAIL: backend_build.ts not found at ${backendBuildPath}`);
  process.exit(1);
}

const backendBuildContent = fs.readFileSync(backendBuildPath, 'utf8');
const shaRegex = /export const BACKEND_BUILD_SHA = "([^"]+)"/;
const shaMatch = shaRegex.exec(backendBuildContent);

if (!shaMatch) {
  console.error('  ✗ FAIL: BACKEND_BUILD_SHA not found in backend_build.ts');
  process.exit(1);
}

const injectedSha = shaMatch[1];
const shaFormatOk = /^[0-9a-f]{7}$/.test(injectedSha) || injectedSha === '<INJECTED_GIT_SHA>';

if (!shaFormatOk) {
  console.error(`  ✗ FAIL: BACKEND_BUILD_SHA has invalid format: "${injectedSha}"`);
  console.error('    Expected: 7 hex digits or "<INJECTED_GIT_SHA>"');
  process.exit(1);
}

console.log(`  ✓ backend_build.ts found with BACKEND_BUILD_SHA="${injectedSha}"`);

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n' + '='.repeat(70));
console.log('✅ BACKBONE LAYER 0 CI GUARD: ALL CHECKS PASSED');
console.log('='.repeat(70));
console.log(`
Summary:
  ✓ UI invokes ${uiInvocations.size} resolvers using invokeWithUiReqId wrapper
  ✓ Zero direct invoke() calls detected
  ✓ All ${uiInvocations.size} UI resolvers registered in backend
  ✓ backend_build.ts properly created
  ✓ No wiring mismatches

Build can proceed safely.
`);

process.exit(0);
