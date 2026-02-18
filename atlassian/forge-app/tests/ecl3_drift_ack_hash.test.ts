/**
 * Hash Recomputation Test for ECL-3 Drift Acknowledgement
 *
 * Verifies deterministic hashing, tamper detection, RBAC validation,
 * and fail-closed semantics for drift acknowledgement records.
 */

import { describe, it, expect } from 'vitest';
import { sha256Hex, canonicalJsonString } from '../src/milestone1/canonicalize';
import { DriftAckRecord, EclDriftAckReasonCode, verifyDriftAckHash } from '../src/governance/driftAck';
import { EclRole } from '../src/governance/rbac';

describe('ECL-3 Drift Acknowledgement Hash & RBAC', () => {
  it('should produce consistent hash for canonical drift ack record', () => {
    // Create a test drift ack record with deterministic values
    const testRecord: DriftAckRecord = {
      driftId: 'drift_proj_public_001',
      ticketId: 'TICKET-12345',
      reasonCode: EclDriftAckReasonCode.AUTHORIZED_CHANGE,
      approverRole: EclRole.Approver,
      ackTimestampUtc: '2026-02-18T05:40:00Z',
      buildShaShort: 'def67890',
      buildUtc: '2026-02-18T05:00:00Z',
      schemaVersion: 'ecl.driftAck@1',
      ackHash: '' // Will be computed
    };

    // Compute the expected hash (without the hash field itself)
    const recordForHashing = {
      driftId: testRecord.driftId,
      ticketId: testRecord.ticketId,
      reasonCode: testRecord.reasonCode,
      approverRole: testRecord.approverRole,
      ackTimestampUtc: testRecord.ackTimestampUtc,
      buildShaShort: testRecord.buildShaShort,
      buildUtc: testRecord.buildUtc,
      schemaVersion: testRecord.schemaVersion
    };

    const canonical = canonicalJsonString(recordForHashing);
    const expectedHash = sha256Hex(canonical);

    // Set the hash in the record
    const completeRecord: DriftAckRecord = {
      ...testRecord,
      ackHash: expectedHash
    };

    // Verify the record
    const isValid = verifyDriftAckHash(completeRecord);
    expect(isValid).toBe(true);
  });

  it('should detect hash tampering on drift ack record', () => {
    const testRecord: DriftAckRecord = {
      driftId: 'drift_proj_public_002',
      ticketId: null,
      reasonCode: EclDriftAckReasonCode.FALSE_POSITIVE,
      approverRole: EclRole.Operator,
      ackTimestampUtc: '2026-02-18T05:40:00Z',
      buildShaShort: 'def67890',
      buildUtc: '2026-02-18T05:00:00Z',
      schemaVersion: 'ecl.driftAck@1',
      ackHash: 'invalid_hash_value_0123456789abcdef'
    };

    // Verify should fail with wrong hash
    const isValid = verifyDriftAckHash(testRecord);
    expect(isValid).toBe(false);
  });

  it('should enforce RBAC: Viewer role cannot accept drift', async () => {
    const { acknowledgeDrift } = await import('../src/governance/driftAck');

    // Attempt to acknowledge drift with Viewer role (does not have ACCEPT_DRIFT permission)
    try {
      await acknowledgeDrift(
        'drift_test_001',
        null,
        EclDriftAckReasonCode.ACCEPTED_RISK,
        EclRole.Viewer
      );
      // If we get here, the test should fail
      expect.fail('RBAC should have denied Viewer role');
    } catch (err: any) {
      const errMsg = String(err);
      expect(errMsg).toContain('FT_ECL_RBAC_DENY');
      expect(errMsg).toContain('ACCEPT_DRIFT');
    }
  });

  it('should fail closed: ticketId undefined is rejected', async () => {
    const { acknowledgeDrift } = await import('../src/governance/driftAck');

    // Attempt to acknowledge drift without explicitly providing ticketId (pass undefined)
    try {
      await acknowledgeDrift(
        'drift_test_002',
        undefined, // explicitly undefined (not null)
        EclDriftAckReasonCode.TEMP_EXCEPTION,
        EclRole.Approver
      );
      // If we get here, the test should fail
      expect.fail('ticketId undefined should have been rejected');
    } catch (err: any) {
      const errMsg = String(err);
      expect(errMsg).toContain('FT_ECL_TICKET_UNSET');
    }
  });

  it('should accept ticketId as explicitly null (allowed)', () => {
    // This test verifies that null IS valid for ticketId
    // While we can't fully test acknowledgeDrift without mocking storage,
    // we can verify the pattern by checking record structure

    const recordWithNullTicket: DriftAckRecord = {
      driftId: 'drift_test_003',
      ticketId: null, // Explicitly null is allowed
      reasonCode: EclDriftAckReasonCode.ACCEPTED_RISK,
      approverRole: EclRole.Owner,
      ackTimestampUtc: '2026-02-18T05:40:00Z',
      buildShaShort: 'def67890',
      buildUtc: '2026-02-18T05:00:00Z',
      schemaVersion: 'ecl.driftAck@1',
      ackHash: ''
    };

    // Compute hash
    const recordForHashing = {
      driftId: recordWithNullTicket.driftId,
      ticketId: recordWithNullTicket.ticketId,
      reasonCode: recordWithNullTicket.reasonCode,
      approverRole: recordWithNullTicket.approverRole,
      ackTimestampUtc: recordWithNullTicket.ackTimestampUtc,
      buildShaShort: recordWithNullTicket.buildShaShort,
      buildUtc: recordWithNullTicket.buildUtc,
      schemaVersion: recordWithNullTicket.schemaVersion
    };

    const canonical = canonicalJsonString(recordForHashing);
    const ackHash = sha256Hex(canonical);

    const completeRecord: DriftAckRecord = {
      ...recordWithNullTicket,
      ackHash
    };

    // Verify it passes hash verification
    const isValid = verifyDriftAckHash(completeRecord);
    expect(isValid).toBe(true);
  });

  it('should detect metadata tampering on ticketId modification', () => {
    // Create original record with correct hash
    const originalRecord: DriftAckRecord = {
      driftId: 'drift_test_004',
      ticketId: 'TICKET-99999',
      reasonCode: EclDriftAckReasonCode.AUTHORIZED_CHANGE,
      approverRole: EclRole.Approver,
      ackTimestampUtc: '2026-02-18T05:40:00Z',
      buildShaShort: 'def67890',
      buildUtc: '2026-02-18T05:00:00Z',
      schemaVersion: 'ecl.driftAck@1',
      ackHash: ''
    };

    // Compute correct hash
    const recordForHashing = {
      driftId: originalRecord.driftId,
      ticketId: originalRecord.ticketId,
      reasonCode: originalRecord.reasonCode,
      approverRole: originalRecord.approverRole,
      ackTimestampUtc: originalRecord.ackTimestampUtc,
      buildShaShort: originalRecord.buildShaShort,
      buildUtc: originalRecord.buildUtc,
      schemaVersion: originalRecord.schemaVersion
    };

    const canonical = canonicalJsonString(recordForHashing);
    const correctHash = sha256Hex(canonical);

    // Tamper with ticketId but keep the original hash
    const tamperedRecord: DriftAckRecord = {
      ...originalRecord,
      ticketId: 'TICKET-88888', // Changed!
      ackHash: correctHash // But hash is unchanged (tampered)
    };

    // Verify should fail because ticketId changed but hash didn't
    const isValid = verifyDriftAckHash(tamperedRecord);
    expect(isValid).toBe(false);
  });
});
