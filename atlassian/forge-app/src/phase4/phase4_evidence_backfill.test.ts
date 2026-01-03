/**
 * Unit Tests for Phase-4 Evidence Backfill
 * 
 * Tests verify:
 * 1. Idempotence (can call multiple times safely)
 * 2. Fail-closed semantics (missing cloudId throws)
 * 3. Deterministic behavior (same input → same result)
 * 4. Write verification (confirms backfill persisted)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { storage } from '@forge/api';
import {
  ensurePhase4EvidenceOrFailClosed,
  type Phase4BackfillResult,
} from '../src/phase4/phase4_evidence_backfill';

// ============================================================================
// MOCK SETUP
// ============================================================================

jest.mock('@forge/api', () => ({
  storage: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

const mockStorage = storage as jest.Mocked<typeof storage>;

describe('Phase-4 Evidence Backfill', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // TEST 1: FAIL-CLOSED ON MISSING CLOUD ID
  // ==========================================================================

  it('FAIL_CLOSED: Throws when cloudId is undefined', async () => {
    await expect(
      ensurePhase4EvidenceOrFailClosed(undefined)
    ).rejects.toThrow(
      expect.stringMatching(/FAIL_CLOSED.*cloudId must be a non-empty string/)
    );
    expect(mockStorage.get).not.toHaveBeenCalled();
    expect(mockStorage.set).not.toHaveBeenCalled();
  });

  it('FAIL_CLOSED: Throws when cloudId is null', async () => {
    await expect(
      ensurePhase4EvidenceOrFailClosed(null as any)
    ).rejects.toThrow(
      expect.stringMatching(/FAIL_CLOSED.*cloudId must be a non-empty string/)
    );
  });

  it('FAIL_CLOSED: Throws when cloudId is empty string', async () => {
    await expect(
      ensurePhase4EvidenceOrFailClosed('')
    ).rejects.toThrow(
      expect.stringMatching(/FAIL_CLOSED.*cloudId must be a non-empty string/)
    );
  });

  it('FAIL_CLOSED: Throws when cloudId is whitespace-only', async () => {
    await expect(
      ensurePhase4EvidenceOrFailClosed('   ')
    ).rejects.toThrow(
      expect.stringMatching(/FAIL_CLOSED.*cloudId must be a non-empty string/)
    );
  });

  // ==========================================================================
  // TEST 2: NO-OP WHEN EVIDENCE EXISTS AND VALID
  // ==========================================================================

  it('NO-OP: Returns didBackfill=false when Phase-4 evidence exists', async () => {
    const cloudId = 'test-cloud-id-123';
    const existingTimestamp = '2026-01-03T15:00:00.000Z';

    mockStorage.get.mockResolvedValueOnce({
      installed_at: existingTimestamp,
    });

    const result = await ensurePhase4EvidenceOrFailClosed(cloudId);

    expect(result).toEqual({
      didBackfill: false,
      reason: 'phase4_exists',
    });
    expect(mockStorage.get).toHaveBeenCalledWith(
      `phase4:evidence:installation:${cloudId}`
    );
    expect(mockStorage.set).not.toHaveBeenCalled(); // No write needed
  });

  // ==========================================================================
  // TEST 3: FAIL-CLOSED ON INVALID EXISTING TIMESTAMP
  // ==========================================================================

  it('FAIL_CLOSED: Throws when existing timestamp is invalid ISO 8601', async () => {
    const cloudId = 'test-cloud-id-123';

    mockStorage.get.mockResolvedValueOnce({
      installed_at: 'not-a-valid-timestamp',
    });

    await expect(
      ensurePhase4EvidenceOrFailClosed(cloudId)
    ).rejects.toThrow(
      expect.stringMatching(/FAIL_CLOSED.*Invalid timestamp.*not-a-valid-timestamp/)
    );
    expect(mockStorage.set).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // TEST 4: BACKFILL WHEN EVIDENCE MISSING
  // ==========================================================================

  it('BACKFILL: Creates evidence when missing', async () => {
    const cloudId = 'test-cloud-id-456';

    // First call: no evidence
    mockStorage.get.mockResolvedValueOnce(null);

    // Second call (verification): evidence now present
    const verificationEvidence = {
      installed_at: expect.any(String),
      backfilled: true,
      backfilled_at: expect.any(String),
      backfill_reason: 'missing_phase4_evidence_on_upgrade',
    };
    mockStorage.get.mockResolvedValueOnce(verificationEvidence);

    const result = await ensurePhase4EvidenceOrFailClosed(cloudId);

    expect(result.didBackfill).toBe(true);
    expect(result.reason).toBe('missing_phase4_evidence_on_upgrade');
    expect(result.timestamp).toBeDefined();

    // Verify storage.set was called with correct structure
    expect(mockStorage.set).toHaveBeenCalledWith(
      `phase4:evidence:installation:${cloudId}`,
      expect.objectContaining({
        installed_at: expect.any(String),
        backfilled: true,
        backfilled_at: expect.any(String),
        backfill_reason: 'missing_phase4_evidence_on_upgrade',
      })
    );

    // Verify both get calls
    expect(mockStorage.get).toHaveBeenCalledTimes(2);
  });

  // ==========================================================================
  // TEST 5: IDEMPOTENCE (Call Multiple Times)
  // ==========================================================================

  it('IDEMPOTENT: Second call returns no-op when evidence already backfilled', async () => {
    const cloudId = 'test-cloud-id-idempotent';
    const backfilledTimestamp = '2026-01-03T15:30:00.000Z';

    // First call: no evidence → backfill
    mockStorage.get.mockResolvedValueOnce(null); // initial read
    mockStorage.get.mockResolvedValueOnce({
      // verification read
      installed_at: backfilledTimestamp,
      backfilled: true,
    });

    const result1 = await ensurePhase4EvidenceOrFailClosed(cloudId);
    expect(result1.didBackfill).toBe(true);

    // Reset mocks
    jest.clearAllMocks();

    // Second call: evidence now exists → no-op
    mockStorage.get.mockResolvedValueOnce({
      installed_at: backfilledTimestamp,
      backfilled: true,
    });

    const result2 = await ensurePhase4EvidenceOrFailClosed(cloudId);

    expect(result2).toEqual({
      didBackfill: false,
      reason: 'phase4_exists',
    });
    expect(mockStorage.set).not.toHaveBeenCalled(); // No second write
  });

  // ==========================================================================
  // TEST 6: FAIL-CLOSED ON WRITE VERIFICATION FAILURE
  // ==========================================================================

  it('FAIL_CLOSED: Throws when write verification fails (evidence still missing)', async () => {
    const cloudId = 'test-cloud-id-write-verify';

    // First call: no evidence
    mockStorage.get.mockResolvedValueOnce(null);
    // Second call (verification): evidence still missing (write failed)
    mockStorage.get.mockResolvedValueOnce(null);

    await expect(
      ensurePhase4EvidenceOrFailClosed(cloudId)
    ).rejects.toThrow(
      expect.stringMatching(/FAIL_CLOSED.*Write verification failed.*evidence still missing/)
    );
  });

  // ==========================================================================
  // TEST 7: DETERMINISTIC BACKFILL (Same Input → Same Behavior)
  // ==========================================================================

  it('DETERMINISTIC: Same cloudId produces consistent results', async () => {
    const cloudId = 'test-cloud-deterministic';

    // First execution: backfill
    mockStorage.get.mockResolvedValueOnce(null); // initial read
    mockStorage.get.mockResolvedValueOnce({
      installed_at: '2026-01-03T16:00:00.000Z',
      backfilled: true,
    });

    const result1 = await ensurePhase4EvidenceOrFailClosed(cloudId);
    const timestamp1 = result1.timestamp;

    jest.clearAllMocks();

    // Second execution: no-op (evidence exists)
    mockStorage.get.mockResolvedValueOnce({
      installed_at: '2026-01-03T16:00:00.000Z',
      backfilled: true,
    });

    const result2 = await ensurePhase4EvidenceOrFailClosed(cloudId);

    // Both should complete without error; timestamp1 should be preserved
    expect(result1.didBackfill).toBe(true);
    expect(result2.didBackfill).toBe(false);
    expect(timestamp1).toBeDefined();
  });

  // ==========================================================================
  // TEST 8: STORAGE ISOLATION (Different cloudIds)
  // ==========================================================================

  it('ISOLATED: Different cloudIds use separate storage keys', async () => {
    const cloudId1 = 'cloud-id-1';
    const cloudId2 = 'cloud-id-2';

    // Call for cloudId1
    mockStorage.get.mockResolvedValueOnce(null); // cloudId1 initial
    mockStorage.get.mockResolvedValueOnce({
      installed_at: '2026-01-03T17:00:00.000Z',
      backfilled: true,
    });

    await ensurePhase4EvidenceOrFailClosed(cloudId1);

    // Call for cloudId2
    mockStorage.get.mockResolvedValueOnce(null); // cloudId2 initial
    mockStorage.get.mockResolvedValueOnce({
      installed_at: '2026-01-03T17:05:00.000Z',
      backfilled: true,
    });

    await ensurePhase4EvidenceOrFailClosed(cloudId2);

    // Verify separate storage keys used
    const setCalls = (mockStorage.set as jest.Mock).mock.calls;
    expect(setCalls[0][0]).toContain(`phase4:evidence:installation:${cloudId1}`);
    expect(setCalls[1][0]).toContain(`phase4:evidence:installation:${cloudId2}`);
  });

  // ==========================================================================
  // TEST 9: UNEXPECTED STORAGE ERROR (Non-FAIL-CLOSED)
  // ==========================================================================

  it('ERROR_WRAPPED: Wraps unexpected storage errors as FAIL_CLOSED', async () => {
    const cloudId = 'test-cloud-storage-error';

    mockStorage.get.mockRejectedValueOnce(new Error('Connection timeout'));

    await expect(
      ensurePhase4EvidenceOrFailClosed(cloudId)
    ).rejects.toThrow(
      expect.stringMatching(/FAIL_CLOSED.*Unexpected error.*Connection timeout/)
    );
  });
});
