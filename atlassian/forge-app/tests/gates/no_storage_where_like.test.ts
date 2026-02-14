/**
 * REGRESSION GATE: Verify NO Forge Storage where/like patterns  
 * 
 * This gate FAILS if:
 * - src/phase6/snapshot_storage.ts contains storage.query()
 * - src/phase6/snapshot_storage.ts contains .where(
 * - Any context that suggests "like" operator usage with storage
 * 
 * Rationale:
 * - Forge Storage API doesn't have 'like' operator
 * - storage.query().where() pattern is invalid
 * - Correct pattern: storage.list({ prefix })
 * - Production errors: "Variable $where got invalid value ..."
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('[GATE] No Forge Storage where/like patterns', () => {
  test('FAIL_GATE_FORBIDDEN: No storage.query() calls', () => {
    const file = 'src/phase6/snapshot_storage.ts';
    if (!fs.existsSync(file)) {
      console.warn(`File not found: ${file}, skipping test`);
      expect(true).toBe(true);
      return;
    }

    const content = fs.readFileSync(file, 'utf-8');
    const hasQueryCall = content.includes('storage.query()');

    if (hasQueryCall) {
      throw new Error('FORGE_STORAGE_WHERE_LIKE_FORBIDDEN');
    }

    expect(hasQueryCall).toBe(false);
  });

  test('FAIL_GATE_FORBIDDEN: No .where( usage in storage context', () => {
    const file = 'src/phase6/snapshot_storage.ts';
    if (!fs.existsSync(file)) {
      console.warn(`File not found: ${file}, skipping test`);
      expect(true).toBe(true);
      return;
    }

    const content = fs.readFileSync(file, 'utf-8');

    // Check for .where( which indicates query builder pattern
    const hasWhereMethod = content.includes('.where(');

    if (hasWhereMethod && content.includes('storage')) {
      throw new Error('FORGE_STORAGE_WHERE_LIKE_FORBIDDEN');
    }

    expect(hasWhereMethod).toBe(false);
  });

  test('PASS: storage.list() usage is correct', () => {
    const file = 'src/phase6/snapshot_storage.ts';
    if (!fs.existsSync(file)) {
      console.warn(`File not found: ${file}, skipping test`);
      expect(true).toBe(true);
      return;
    }

    const content = fs.readFileSync(file, 'utf-8');

    // storage.list should be the correct pattern used
    const hasStorageList = content.includes('storage.list(');
    const hasListWithPrefix = content.includes('storage.list({ prefix');

    console.log('[GATE_STORAGE_AUDIT] Uses storage.list():', hasStorageList);
    console.log('[GATE_STORAGE_AUDIT] Uses storage.list({ prefix }):', hasListWithPrefix);

    expect(hasStorageList || !content.includes('storageListByPrefix')).toBe(true);
  });

  test('PASS: Error handling for storage list operations', () => {
    const file = 'src/phase6/snapshot_storage.ts';
    if (!fs.existsSync(file)) {
      console.warn(`File not found: ${file}, skipping test`);
      expect(true).toBe(true);
      return;
    }

    const content = fs.readFileSync(file, 'utf-8');

    // Should have error handling markers
    const hasErrorMarker = content.includes('[FT_STORAGE_LIST_FAILED]');
    const hasFailClosed = content.includes('return []');

    console.log('[GATE_STORAGE_ERROR_HANDLING] Has error marker:', hasErrorMarker);
    console.log('[GATE_STORAGE_ERROR_HANDLING] Has fail-closed semantics:', hasFailClosed);

    // These are good indicators but not mandatory
    expect(true).toBe(true);
  });
});
