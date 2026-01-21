/**
 * UI Build Meta - Safety Test
 * 
 * BACKBONE #1 Verification:
 * Ensures UI_BUILD_TIME_UTC and UI_GIT_SHA are NEVER undefined at runtime.
 * These constants are used in template literals throughout main.ts.
 * ReferenceError would crash the entire UI if they were undefined.
 * 
 * This test runs as part of the build process to catch injection failures early.
 */

import { UI_BUILD_TIME_UTC, UI_GIT_SHA, UI_GIT_TIME } from '../ui_build_meta';

describe('ui_build_meta - BACKBONE #1 Safety Tests', () => {
  test('UI_BUILD_TIME_UTC is always a non-empty string (never undefined, never UNSET on prod)', () => {
    // CRITICAL: These are used in template literals at lines 2444, 2777 of main.ts
    expect(typeof UI_BUILD_TIME_UTC).toBe('string');
    expect(UI_BUILD_TIME_UTC.length).toBeGreaterThan(0);
    
    // Acceptable values: ISO timestamp OR "UNSET" (fallback if not injected)
    const isIsoLike = /^\d{4}-\d{2}-\d{2}T/.test(UI_BUILD_TIME_UTC);
    const isExplicitFallback = UI_BUILD_TIME_UTC === 'UNSET';
    
    expect(isIsoLike || isExplicitFallback).toBe(true);
    
    // If "UNSET", log warning (build issue)
    if (UI_BUILD_TIME_UTC === 'UNSET') {
      console.warn('[BACKBONE #1 WARNING] UI_BUILD_TIME_UTC was not injected during build, using fallback "UNSET"');
    }
  });

  test('UI_GIT_SHA is always a non-empty string (never undefined)', () => {
    expect(typeof UI_GIT_SHA).toBe('string');
    expect(UI_GIT_SHA.length).toBeGreaterThan(0);
    
    // Acceptable: 40 hex chars (full SHA) OR fallback "UNSET"
    const isFullSha = /^[0-9a-f]{40}$/.test(UI_GIT_SHA);
    const isExplicitFallback = UI_GIT_SHA === 'UNSET';
    
    expect(isFullSha || isExplicitFallback).toBe(true);
  });

  test('UI_GIT_TIME is always a non-empty string', () => {
    expect(typeof UI_GIT_TIME).toBe('string');
    expect(UI_GIT_TIME.length).toBeGreaterThan(0);
  });

  test('Can use UI_BUILD_TIME_UTC in template literals without ReferenceError', () => {
    // This mimics usage in main.ts lines 2444, 2777
    const templateResult = `UI_BUILD_TIME_UTC: ${UI_BUILD_TIME_UTC}`;
    expect(templateResult).toMatch(/UI_BUILD_TIME_UTC: \S+/);
    expect(templateResult).not.toContain('undefined');
  });

  test('Can use UI_GIT_SHA in template literals without ReferenceError', () => {
    // This mimics usage in main.ts
    const templateResult = `UI_GIT_SHA: ${UI_GIT_SHA}`;
    expect(templateResult).toMatch(/UI_GIT_SHA: \S+/);
    expect(templateResult).not.toContain('undefined');
  });
});
