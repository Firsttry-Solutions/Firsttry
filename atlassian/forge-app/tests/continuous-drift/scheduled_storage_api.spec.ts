import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * REGRESSION TEST: scheduled.ts Storage API
 * 
 * Ensures that scheduled.ts uses the correct storage API pattern:
 *   ✅ import { storage } from '@forge/api'
 *   ❌ NO api.asApp().requestStorage() (invalid method, causes runtime crash)
 * 
 * Background: Production crash occurred when api.asApp().requestStorage() was called.
 * This method does not exist in @forge/api v12.14.0. The correct pattern is to
 * directly import storage: import { storage } from '@forge/api'
 * 
 * This test prevents re-introduction of the invalid pattern.
 */

describe('scheduled.ts - Storage API Correct Usage', () => {
  const scheduledFilePath = resolve(__dirname, '../../src/continuous-drift/scheduled.ts');
  
  it('should NOT contain requestStorage call (prevents runtime crash)', () => {
    const source = readFileSync(scheduledFilePath, 'utf-8');
    
    // CRITICAL: Ensure invalid pattern is absent
    expect(source).not.toMatch(/requestStorage/i);
    console.log('[FT_PROOF_TEST_NO_REQUESTSTORAGE_PASS]', { 
      marker: 'FT_PROOF_TEST_NO_REQUESTSTORAGE_PASS',
      reason: 'scheduled.ts does not contain invalid requestStorage() call'
    });
  });

  it('should import storage from @forge/api', () => {
    const source = readFileSync(scheduledFilePath, 'utf-8');
    
    // REQUIRED: Correct import pattern
    expect(source).toMatch(/import\s+{\s*storage\s*}\s+from\s+['"]@forge\/api['"]/);
  });

  it('should use storage.get() directly (not through api.asApp())', () => {
    const source = readFileSync(scheduledFilePath, 'utf-8');
    
    // VERIFY: Direct usage pattern (not through api.asApp())
    expect(source).toMatch(/await\s+storage\.get/);
    // And ensure no api.asApp().requestStorage pattern
    expect(source).not.toMatch(/api\.asApp\(\).*requestStorage/);
  });

  it('should wrap storage.get in error handling (fail-closed)', () => {
    const source = readFileSync(scheduledFilePath, 'utf-8');
    
    // VERIFY: Error handling wraps storage.get call
    // Pattern: try { ... await storage.get(...) ... } catch (storageErr: any)
    expect(source).toMatch(/try\s*{\s*.*await\s+storage\.get/s);
    expect(source).toMatch(/FT_PROOF_DRIFT_STORAGE_API_FAIL/);
  });
});
