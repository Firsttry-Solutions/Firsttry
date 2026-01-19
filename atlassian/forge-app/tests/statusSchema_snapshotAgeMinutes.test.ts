/**
 * Test: statusSchema.normalizeStatusV1 snapshotAgeMinutes invariant
 * CRITICAL: snapshotAgeMinutes must NEVER be undefined - must be number|null only
 */

import { describe, it, expect } from 'vitest';
import { normalizeStatusV1, EMPTY_STATUS_V1 } from '../src/shared/statusSchema';

describe('statusSchema.normalizeStatusV1 - snapshotAgeMinutes invariant', () => {
  it('should return snapshotAgeMinutes === null when missing from input', () => {
    const input = {
      // No snapshotAgeMinutes field
      tenantAri: 'ari:cloud:test',
      backendBuild: 'abc123'
    };

    const result = normalizeStatusV1(input as any, 'ari:test', 'build', 'v1.0');

    expect(result.snapshotAgeMinutes).not.toBeUndefined();
    expect(result.snapshotAgeMinutes).toBeNull();
  });

  it('should return snapshotAgeMinutes === null when input is null', () => {
    const input = {
      tenantAri: 'ari:cloud:test',
      backendBuild: 'abc123',
      snapshotAgeMinutes: null
    };

    const result = normalizeStatusV1(input as any, 'ari:test', 'build', 'v1.0');

    expect(result.snapshotAgeMinutes).not.toBeUndefined();
    expect(result.snapshotAgeMinutes).toBeNull();
  });

  it('should preserve snapshotAgeMinutes when input is a number', () => {
    const input = {
      tenantAri: 'ari:cloud:test',
      backendBuild: 'abc123',
      snapshotAgeMinutes: 45
    };

    const result = normalizeStatusV1(input as any, 'ari:test', 'build', 'v1.0');

    expect(result.snapshotAgeMinutes).not.toBeUndefined();
    expect(result.snapshotAgeMinutes).toBe(45);
  });

  it('should return snapshotAgeMinutes === null for zero (edge case)', () => {
    const input = {
      tenantAri: 'ari:cloud:test',
      backendBuild: 'abc123',
      snapshotAgeMinutes: 0
    };

    const result = normalizeStatusV1(input as any, 'ari:test', 'build', 'v1.0');

    expect(result.snapshotAgeMinutes).toBe(0); // 0 is a valid number
  });

  it('should NEVER produce undefined for snapshotAgeMinutes', () => {
    const testCases = [
      { snapshotAgeMinutes: undefined },
      { snapshotAgeMinutes: null },
      { snapshotAgeMinutes: 10 },
      { snapshotAgeMinutes: 0 },
      { snapshotAgeMinutes: 99999 },
      { /* missing field */ }
    ];

    for (const testCase of testCases) {
      const input = {
        tenantAri: 'ari:cloud:test',
        backendBuild: 'abc123',
        ...testCase
      };

      const result = normalizeStatusV1(input as any, 'ari:test', 'build', 'v1.0');

      // CRITICAL INVARIANT: snapshotAgeMinutes must NEVER be undefined
      expect(result.snapshotAgeMinutes).not.toBeUndefined();
      
      // Must be either a number or null
      const isValid = typeof result.snapshotAgeMinutes === 'number' || result.snapshotAgeMinutes === null;
      expect(isValid).toBe(true);
    }
  });

  it('should handle EMPTY_STATUS_V1 without producing undefined', () => {
    const empty = EMPTY_STATUS_V1('test-ari', 'build', 'v1');

    expect(empty.snapshotAgeMinutes).not.toBeUndefined();
    expect(typeof empty.snapshotAgeMinutes === 'number' || empty.snapshotAgeMinutes === null).toBe(true);
  });
});
