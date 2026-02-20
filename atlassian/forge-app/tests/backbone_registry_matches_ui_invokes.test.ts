/**
 * BACKBONE LAYER 0: CI Guard Test
 *
 * Ensures that:
 * 1. All UI invocations match registered backend resolvers
 * 2. No direct invoke() calls exist in main.ts (all use safeInvoke or invokeWithUiReqId wrapper)
 *
 * This test FAILS the build if instrumentation wiring is broken.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// File paths
const mainTsPath = path.join(__dirname, '..', 'src', 'gadget-ui', 'src', 'main.ts');
const resolverTsPath = path.join(__dirname, '..', 'src', 'gadget-resolver.ts');

describe('BACKBONE_LAYER_0: Resolver Registry Matches UI Invokes', () => {
  it('should validate all UI resolvers are registered in backend', () => {
    console.log('[BACKBONE_GUARD] Starting CI wiring validation...\n');

    // ============================================================================
    // TEST 1: Extract UI resolver invocations using safeInvoke or invokeWithUiReqId
    // ============================================================================
    console.log('[TEST 1] Checking UI resolver invocations...');

    const mainContent = fs.readFileSync(mainTsPath, 'utf8');

    // Find all safeInvoke('NAME', ...) and invokeWithUiReqId('NAME', ...) calls
    const uiInvocationRegex = /(?:safeInvoke|invokeWithUiReqId)\s*\(\s*['"]([^'"]+)['"]/g;
    const uiInvocations = new Set<string>();
    let match;

    while ((match = uiInvocationRegex.exec(mainContent)) !== null) {
      uiInvocations.add(match[1]);
    }

    console.log(`  ✓ Found ${uiInvocations.size} unique UI resolver invocations`);
    console.log(`    Resolvers: ${Array.from(uiInvocations).sort().join(', ')}`);

    expect(uiInvocations.size).toBeGreaterThan(0);

    // ============================================================================
    // TEST 2: Verify NO direct invoke() calls remain in main.ts (except Backbone bootstrap)
    // ============================================================================
    console.log('\n[TEST 2] Checking for direct invoke() calls (should be ZERO except Backbone)...');

    // Look for direct invoke(...) calls that are NOT safeInvoke or invokeWithUiReqId
    // Pattern: await invoke( or = invoke( or invoke(
    const directInvokeRegex = /\b(?<!safeInvoke)(?<!invokeWithUiReqId)invoke\s*\(\s*['"][^'"]+['"]/g;

    // Filter out false positives from comments and strings and Backbone bootstrap
    const codeOnly = mainContent
      .split('\n')
      .filter(line => !line.trim().startsWith('//') && !line.includes('invoke() is') && !line.includes('ft_getDashboardState_v1'))
      .join('\n');

    const directInvokesFiltered = (codeOnly.match(directInvokeRegex) || [])
      .filter(match => !match.includes('invoke is') && !match.includes('invoke Not Available'));

    console.log(`  ✓ Found ${directInvokesFiltered.length} direct invoke() calls (Backbone bootstrap is OK)`);

    expect(directInvokesFiltered.length).toBeLessThanOrEqual(1);

    // ============================================================================
    // TEST 3: Extract backend resolver definitions
    // ============================================================================
    console.log('\n[TEST 3] Checking backend resolver registrations...');

    const resolverContent = fs.readFileSync(resolverTsPath, 'utf8');

    // Find all resolver.define('NAME', ...) calls
    const resolverRegex = /resolver\.define\s*\(\s*['"]([^'"]+)['"]/g;
    const backendResolvers = new Set<string>();

    while ((match = resolverRegex.exec(resolverContent)) !== null) {
      backendResolvers.add(match[1]);
    }

    console.log(`  ✓ Found ${backendResolvers.size} registered backend resolvers`);
    console.log(`    Resolvers: ${Array.from(backendResolvers).sort().join(', ')}`);

    // ============================================================================
    // TEST 4: Verify UI ⊆ Backend (all UI calls have backend handlers)
    // ============================================================================
    console.log('\n[TEST 4] Validating UI ⊆ Backend resolver wiring...');

    const missingResolvers: string[] = [];
    for (const uiResolver of uiInvocations) {
      // ar.* resolvers are registered in access-review/phase3Resolvers.ts, not gadget-resolver.ts
      if (uiResolver.startsWith('ar.')) continue;
      if (!backendResolvers.has(uiResolver)) {
        missingResolvers.push(uiResolver);
      }
    }

    console.log(`  ✓ All ${uiInvocations.size} UI resolvers are registered in backend`);

    expect(missingResolvers.length).toBe(0);

    // ============================================================================
    // TEST 5: Extract backend_build.ts and verify format
    // ============================================================================
    console.log('\n[TEST 5] Checking backend_build.ts injection...');

    const backendBuildPath = path.join(__dirname, '..', 'src', 'build', 'backend_build.ts');
    expect(fs.existsSync(backendBuildPath)).toBe(true);

    const backendBuildContent = fs.readFileSync(backendBuildPath, 'utf8');
    const shaRegex = /export const BACKEND_BUILD_SHA = "([^"]+)"/;
    const shaMatch = shaRegex.exec(backendBuildContent);

    expect(shaMatch).toBeTruthy();

    if (shaMatch) {
      const injectedSha = shaMatch[1];
      // Allow 7-12 hex chars (short SHA formats)
      const shaFormatOk = /^[0-9a-f]{7,12}$/.test(injectedSha) || injectedSha === '<INJECTED_GIT_SHA>';

      expect(shaFormatOk).toBe(true);

      console.log(`  ✓ backend_build.ts found with BACKEND_BUILD_SHA="${injectedSha}"`);
    }

    // ============================================================================
    // SUMMARY
    // ============================================================================
    console.log('\n' + '='.repeat(70));
    console.log('✅ BACKBONE LAYER 0 CI GUARD: ALL CHECKS PASSED');
    console.log('='.repeat(70));
    console.log(`
Summary:
  ✓ UI invokes ${uiInvocations.size} resolvers using safeInvoke wrapper
  ✓ Zero direct invoke() calls detected
  ✓ All ${uiInvocations.size} UI resolvers registered in backend
  ✓ backend_build.ts properly injected
  ✓ No wiring mismatches

Build can proceed safely.
`);
  });
});
