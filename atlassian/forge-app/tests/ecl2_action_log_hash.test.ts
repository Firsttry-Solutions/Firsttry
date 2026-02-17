/**
 * Hash Recomputation Test for ECL-2 Governance Action Log
 * 
 * Verifies that the deterministic hashing of governance action records
 * produces consistent and verifiable hashes.
 */

import { describe, it, expect } from 'vitest';
import { sha256Hex, canonicalJsonString } from '../src/milestone1/canonicalize';
import { GovernanceActionRecord } from '../src/governance/actionLog';
import { verifyGovernanceActionHash } from '../src/governance/actionLog';

describe('ECL-2 Governance Action Hash Recomputation', () => {
  it('should produce consistent hash for canonical action record', () => {
    // Create a test record with deterministic values
    const testRecord: GovernanceActionRecord = {
      timestampUtc: '2026-02-17T17:00:00Z',
      buildShaShort: 'abc12345',
      buildUtc: '2026-02-17T16:00:00Z',
      schemaVersion: 'ecl.audit@1',
      actionType: 'view_dashboard' as any,
      actorRole: 'owner' as any,
      metadata: {
        source: 'test',
        context: 'hash_verification'
      },
      recordSha256: '' // Will be computed
    };

    // Compute the expected hash (without the hash field itself)
    const recordForHashing = {
      timestampUtc: testRecord.timestampUtc,
      buildShaShort: testRecord.buildShaShort,
      buildUtc: testRecord.buildUtc,
      schemaVersion: testRecord.schemaVersion,
      actionType: testRecord.actionType,
      actorRole: testRecord.actorRole,
      metadata: testRecord.metadata
    };

    const canonical = canonicalJsonString(recordForHashing);
    const expectedHash = sha256Hex(canonical);

    // Set the hash in the record
    const completeRecord: GovernanceActionRecord = {
      ...testRecord,
      recordSha256: expectedHash
    };

    // Verify the record
    const isValid = verifyGovernanceActionHash(completeRecord);
    expect(isValid).toBe(true);
  });

  it('should detect hash tampering', () => {
    const testRecord: GovernanceActionRecord = {
      timestampUtc: '2026-02-17T17:00:00Z',
      buildShaShort: 'abc12345',
      buildUtc: '2026-02-17T16:00:00Z',
      schemaVersion: 'ecl.audit@1',
      actionType: 'view_dashboard' as any,
      actorRole: 'owner' as any,
      metadata: {
        source: 'test'
      },
      recordSha256: 'invalid_hash_value_12345'
    };

    // Verify should fail with wrong hash
    const isValid = verifyGovernanceActionHash(testRecord);
    expect(isValid).toBe(false);
  });

  it('should detect metadata tampering', () => {
    // Create original record
    const originalRecord: GovernanceActionRecord = {
      timestampUtc: '2026-02-17T17:00:00Z',
      buildShaShort: 'abc12345',
      buildUtc: '2026-02-17T16:00:00Z',
      schemaVersion: 'ecl.audit@1',
      actionType: 'view_dashboard' as any,
      actorRole: 'owner' as any,
      metadata: {
        source: 'test'
      },
      recordSha256: ''
    };

    // Compute correct hash
    const recordForHashing = {
      timestampUtc: originalRecord.timestampUtc,
      buildShaShort: originalRecord.buildShaShort,
      buildUtc: originalRecord.buildUtc,
      schemaVersion: originalRecord.schemaVersion,
      actionType: originalRecord.actionType,
      actorRole: originalRecord.actorRole,
      metadata: originalRecord.metadata
    };

    const canonical = canonicalJsonString(recordForHashing);
    const correctHash = sha256Hex(canonical);

    // Tamper with metadata
    const tamperedRecord: GovernanceActionRecord = {
      ...originalRecord,
      metadata: { source: 'malicious' },
      recordSha256: correctHash
    };

    // Verify should fail because metadata changed but hash didn't
    const isValid = verifyGovernanceActionHash(tamperedRecord);
    expect(isValid).toBe(false);
  });

  it('should produce consistent hash across multiple computations', () => {
    const record: GovernanceActionRecord = {
      timestampUtc: '2026-02-17T17:00:00Z',
      buildShaShort: 'abc12345',
      buildUtc: '2026-02-17T16:00:00Z',
      schemaVersion: 'ecl.audit@1',
      actionType: 'generate_export' as any,
      actorRole: 'auditor' as any,
      metadata: {
        exportFormat: 'json',
        includePayload: true
      },
      recordSha256: ''
    };

    // Compute hash three times
    const computeHash = () => {
      const recordForHashing = {
        timestampUtc: record.timestampUtc,
        buildShaShort: record.buildShaShort,
        buildUtc: record.buildUtc,
        schemaVersion: record.schemaVersion,
        actionType: record.actionType,
        actorRole: record.actorRole,
        metadata: record.metadata
      };
      return sha256Hex(canonicalJsonString(recordForHashing));
    };

    const hash1 = computeHash();
    const hash2 = computeHash();
    const hash3 = computeHash();

    // All three should be identical
    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
  });
});
