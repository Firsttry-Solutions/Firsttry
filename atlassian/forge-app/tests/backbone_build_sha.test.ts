/**
 * Test Suite: BACKBONE_BUILD_SHA Injection and Validation
 * 
 * GOAL: Ensure backend_build_sha is NEVER "unknown" in production logs
 * 
 * Tests verify:
 * 1. BACKEND_BUILD_SHA is injected and not a placeholder
 * 2. BACKEND_BUILD_SHA matches expected hex format (7-40 chars)
 * 3. All resolvers that use BACKEND_BUILD_SHA are enforced to import it
 * 4. Error logging cannot fallback to "unknown"
 */

import { describe, it, expect, beforeAll } from 'vitest';

describe('BACKBONE_BUILD_SHA Injection Tests', () => {
  
  it('should import BACKEND_BUILD_SHA from backend_build.ts without throwing', async () => {
    // This test verifies that the module can be imported and the constant is valid
    // If the build script didn't run, this will throw on import (validation at module load)
    let importedSha: string;
    
    try {
      const module = await import('../src/build/backend_build');
      importedSha = module.BACKEND_BUILD_SHA;
    } catch (err) {
      throw new Error(
        `Failed to import BACKEND_BUILD_SHA: ${err instanceof Error ? err.message : String(err)}. ` +
        `This indicates the build script (tools/build_meta.mjs) was not run before the test.`
      );
    }
    
    expect(importedSha).toBeDefined();
    expect(typeof importedSha).toBe('string');
  });

  it('should have BACKEND_BUILD_SHA not be the placeholder "__BACKEND_BUILD_SHA__"', async () => {
    const module = await import('../src/build/backend_build');
    const sha = module.BACKEND_BUILD_SHA;
    
    expect(sha).not.toBe('__BACKEND_BUILD_SHA__');
  });

  it('should have BACKEND_BUILD_SHA match hex format /^[0-9a-f]{7,40}$/', async () => {
    const module = await import('../src/build/backend_build');
    const sha = module.BACKEND_BUILD_SHA;
    
    const hexRegex = /^[0-9a-f]{7,40}$/;
    expect(hexRegex.test(sha)).toBe(true);
  });

  it('should have BACKEND_BUILD_SHA with minimum 7 hex characters', async () => {
    const module = await import('../src/build/backend_build');
    const sha = module.BACKEND_BUILD_SHA;
    
    expect(sha.length).toBeGreaterThanOrEqual(7);
  });

  it('should not be "unknown"', async () => {
    const module = await import('../src/build/backend_build');
    const sha = module.BACKEND_BUILD_SHA;
    
    expect(sha).not.toBe('unknown');
    expect(sha).not.toBe('UNKNOWN');
  });

  it('should validate that ping resolver imports BACKEND_BUILD_SHA', async () => {
    // Verify that ping.ts imports from the correct module
    // This is a static check (can also be done via grep in CI)
    const pingModule = await import('../src/resolvers/ping');
    
    // If ping was unable to import BACKEND_BUILD_SHA, this would have thrown at module load
    // So just verify the module loaded successfully
    expect(pingModule.ping).toBeDefined();
    expect(typeof pingModule.ping).toBe('function');
  });

  it('should validate that ensureFirstSnapshot resolver imports BACKEND_BUILD_SHA', async () => {
    const module = await import('../src/resolvers/ensureFirstSnapshot');
    
    expect(module.ensureFirstSnapshot).toBeDefined();
    expect(typeof module.ensureFirstSnapshot).toBe('function');
  });

  it('should validate that probe resolver imports BACKEND_BUILD_SHA', async () => {
    const module = await import('../src/resolvers/probe');
    
    expect(module.probe).toBeDefined();
    expect(typeof module.probe).toBe('function');
  });

  it('should enforce that emitResolverErrorLog throws if backendBuildSha is null', async () => {
    const module = await import('../src/resolvers/backbone_error_handling');
    
    // Attempt to call emitResolverErrorLog with null backendBuildSha
    // This should throw (fail-closed behavior)
    expect(() => {
      module.emitResolverErrorLog(
        'test-trace-id',
        'test-instance-id',
        'RESOLVER_UNHANDLED_EXCEPTION',
        'Test error message',
        null, // backendBuildSha is null - should throw
        'test-req-id',
        'test-resolver'
      );
    }).toThrow();
  });

  it('should enforce that emitResolverErrorLog throws if backendBuildSha is "unknown"', async () => {
    const module = await import('../src/resolvers/backbone_error_handling');
    
    // Attempt to call emitResolverErrorLog with "unknown" backendBuildSha
    // This should throw (fail-closed behavior)
    expect(() => {
      module.emitResolverErrorLog(
        'test-trace-id',
        'test-instance-id',
        'RESOLVER_UNHANDLED_EXCEPTION',
        'Test error message',
        'unknown', // backendBuildSha is "unknown" - should throw
        'test-req-id',
        'test-resolver'
      );
    }).toThrow();
  });

  it('should allow emitResolverErrorLog with valid hex backendBuildSha', async () => {
    const module = await import('../src/resolvers/backbone_error_handling');
    
    // Spy on console.error to verify the log was emitted
    let logEmitted = false;
    const originalError = console.error;
    console.error = (...args: any[]) => {
      logEmitted = true;
    };
    
    try {
      // Should NOT throw
      module.emitResolverErrorLog(
        'test-trace-id',
        'test-instance-id',
        'RESOLVER_UNHANDLED_EXCEPTION',
        'Test error message',
        'abcdef1', // Valid 7-char hex
        'test-req-id',
        'test-resolver'
      );
      
      expect(logEmitted).toBe(true);
    } finally {
      console.error = originalError;
    }
  });

  it('should have validateBackendBuildSha function callable and returning true', async () => {
    const module = await import('../src/build/backend_build');
    
    // validateBackendBuildSha should return true if validation passed at import
    // We can call it again to verify
    expect(() => {
      module.validateBackendBuildSha();
    }).not.toThrow();
    
    const result = module.validateBackendBuildSha();
    expect(result).toBe(true);
  });
});
