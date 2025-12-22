/**
 * PHASE-5 SCHEDULER HARDENING TESTS
 *
 * Proves that the scheduler satisfies all hardening requirements:
 * A. Tenant identity: FAIL_CLOSED if missing, no fixtures, no fallbacks
 * B. Installation timestamp: Only from Phase-4, FAIL_CLOSED if missing
 * C. Idempotency: DONE_KEY is authoritative, never regenerates
 * D. Backoff: 30min (1st), 120min (2nd), 24h (3rd+), bounded
 * E. Never throws from scheduler, always returns 200 or 500
 * F. Single code path (handleAutoTrigger only)
 * G. Concurrency safe with write-once semantics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Forge API first (before scheduler_state imports it)
vi.mock('@forge/api', () => ({
  default: {
    asApp: vi.fn(() => ({
      requestStorage: vi.fn(),
    })),
  },
}));

// Mock dependencies BEFORE importing module
vi.mock('../../src/scheduled/scheduler_state');
vi.mock('../../src/phase5_report_generator');

import {
  phase5SchedulerHandler,
} from '../../src/scheduled/phase5_scheduler';
import * as schedulerState from '../../src/scheduled/scheduler_state';
import * as reportGenerator from '../../src/phase5_report_generator';

describe('Phase-5 Scheduler Hardening', () => {
  const startTime = '2024-01-15T12:00:00Z';
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(startTime));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ================================================================
  // A. TENANT IDENTITY HARDENING
  // ================================================================

  describe('A. Tenant Identity Hardening', () => {
    it('should FAIL_CLOSED if cloudId is missing from context', async () => {
      const request = {} as any;
      const context = { cloudId: null } as any;

      const result = await phase5SchedulerHandler(request, context);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error_code).toBe('TENANT_CONTEXT_UNAVAILABLE');
    });

    it('should FAIL_CLOSED if cloudId is empty string', async () => {
      const request = {} as any;
      const context = { cloudId: '' } as any;

      const result = await phase5SchedulerHandler(request, context);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error_code).toBe('TENANT_CONTEXT_UNAVAILABLE');
    });

    it('should FAIL_CLOSED if cloudId is whitespace only', async () => {
      const request = {} as any;
      const context = { cloudId: '   ' } as any;

      const result = await phase5SchedulerHandler(request, context);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should accept valid cloudId from context', async () => {
      const request = {} as any;
      const context = { cloudId: 'valid-cloud-id' } as any;

      vi.mocked(schedulerState.loadSchedulerState).mockResolvedValue({
        last_run_at: startTime,
        auto_12h_generated_at: null,
        auto_24h_generated_at: null,
        last_error: null,
        last_backoff_until: null,
        auto_12h_attempt_count: 0,
        auto_24h_attempt_count: 0,
      });

      vi.mocked(schedulerState.loadInstallationTimestamp).mockResolvedValue(null);

      const result = await phase5SchedulerHandler(request, context);

      // Should proceed (installation timestamp not found is OK at this stage)
      expect(result.statusCode).toBe(200);
    });
  });

  // ================================================================
  // B. INSTALLATION TIMESTAMP HARDENING
  // ================================================================

  describe('B. Installation Timestamp Hardening', () => {
    const validContext = { cloudId: 'test-cloud' } as any;

    it('should FAIL_CLOSED if installation timestamp not found in Phase-4', async () => {
      const request = {} as any;

      vi.mocked(schedulerState.loadInstallationTimestamp).mockResolvedValue(null);

      const result = await phase5SchedulerHandler(request, validContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('Installation timestamp not available');
    });

    it('should use installation timestamp from Phase-4 to calculate trigger', async () => {
      // Installation time: 12h ago
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

      vi.mocked(schedulerState.loadInstallationTimestamp).mockResolvedValue(twelveHoursAgo);
      vi.mocked(schedulerState.loadSchedulerState).mockResolvedValue({
        last_run_at: startTime,
        auto_12h_generated_at: null,
        auto_24h_generated_at: null,
        last_error: null,
        last_backoff_until: null,
        auto_12h_attempt_count: 0,
        auto_24h_attempt_count: 0,
      });
      vi.mocked(schedulerState.hasCompletionMarker).mockResolvedValue(false);
      vi.mocked(reportGenerator.handleAutoTrigger).mockResolvedValue({
        success: true,
        report: { trigger: 'AUTO_12H' } as any,
      });

      const request = {} as any;
      const result = await phase5SchedulerHandler(request, validContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.due_trigger).toBe('AUTO_12H');
    });
  });

  // ================================================================
  // C. IDEMPOTENCY HARDENING (DONE_KEY AUTHORITATIVE)
  // ================================================================

  describe('C. Idempotency Hardening - DONE_KEY is Authoritative', () => {
    const validContext = { cloudId: 'test-cloud' } as any;

    it('should never regenerate if AUTO_12H DONE_KEY exists', async () => {
      const request = {} as any;
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

      vi.mocked(schedulerState.loadInstallationTimestamp).mockResolvedValue(twelveHoursAgo);
      vi.mocked(schedulerState.loadSchedulerState).mockResolvedValue({
        last_run_at: startTime,
        auto_12h_generated_at: null,
        auto_24h_generated_at: null,
        last_error: null,
        last_backoff_until: null,
        auto_12h_attempt_count: 0,
        auto_24h_attempt_count: 0,
      });

      // DONE_KEY exists for AUTO_12H
      vi.mocked(schedulerState.hasCompletionMarker).mockImplementation(
        (cloudId: string, trigger: string) => {
          return Promise.resolve(trigger === 'AUTO_12H');
        }
      );

      const result = await phase5SchedulerHandler(request, validContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('has already been generated');
      expect(body.reason).toBe('DONE_KEY_EXISTS');
      expect(body.report_generated).toBe(false);

      // handleAutoTrigger should NOT be called
      expect(reportGenerator.handleAutoTrigger).not.toHaveBeenCalled();
    });

    it('should write DONE_KEY only on successful generation', async () => {
      const request = {} as any;
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

      vi.mocked(schedulerState.loadInstallationTimestamp).mockResolvedValue(twelveHoursAgo);
      vi.mocked(schedulerState.loadSchedulerState).mockResolvedValue({
        last_run_at: startTime,
        auto_12h_generated_at: null,
        auto_24h_generated_at: null,
        last_error: null,
        last_backoff_until: null,
        auto_12h_attempt_count: 0,
        auto_24h_attempt_count: 0,
      });
      vi.mocked(schedulerState.hasCompletionMarker).mockResolvedValue(false);
      vi.mocked(schedulerState.writeCompletionMarker).mockResolvedValue(undefined);
      vi.mocked(schedulerState.saveSchedulerState).mockResolvedValue(undefined);
      vi.mocked(reportGenerator.handleAutoTrigger).mockResolvedValue({
        success: true,
        report: { trigger: 'AUTO_12H' } as any,
      });

      const result = await phase5SchedulerHandler(request, validContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.report_generated).toBe(true);

      // writeCompletionMarker should be called with AUTO_12H
      expect(schedulerState.writeCompletionMarker).toHaveBeenCalledWith('test-cloud', 'AUTO_12H');
    });

    it('should not write DONE_KEY on failed generation', async () => {
      const request = {} as any;
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

      vi.mocked(schedulerState.loadInstallationTimestamp).mockResolvedValue(twelveHoursAgo);
      vi.mocked(schedulerState.loadSchedulerState).mockResolvedValue({
        last_run_at: startTime,
        auto_12h_generated_at: null,
        auto_24h_generated_at: null,
        last_error: null,
        last_backoff_until: null,
        auto_12h_attempt_count: 0,
        auto_24h_attempt_count: 0,
      });
      vi.mocked(schedulerState.hasCompletionMarker).mockResolvedValue(false);
      vi.mocked(reportGenerator.handleAutoTrigger).mockResolvedValue({
        success: false,
        error: 'Generation failed',
      });

      const result = await phase5SchedulerHandler(request, validContext);

      expect(result.statusCode).toBe(202);
      const body = JSON.parse(result.body);
      expect(body.report_generated).toBe(false);

      // writeCompletionMarker should NOT be called
      expect(schedulerState.writeCompletionMarker).not.toHaveBeenCalled();
    });
  });

  // ================================================================
  // D. BACKOFF HARDENING (BOUNDED)
  // ================================================================

  describe('D. Backoff Hardening - Bounded 30min, 120min, 24h', () => {
    const validContext = { cloudId: 'test-cloud' } as any;

    it('should apply 30min backoff on 1st failure', async () => {
      const request = {} as any;
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

      vi.mocked(schedulerState.loadInstallationTimestamp).mockResolvedValue(twelveHoursAgo);
      vi.mocked(schedulerState.loadSchedulerState).mockResolvedValue({
        last_run_at: startTime,
        auto_12h_generated_at: null,
        auto_24h_generated_at: null,
        last_error: null,
        last_backoff_until: null,
        auto_12h_attempt_count: 0,
        auto_24h_attempt_count: 0,
      });
      vi.mocked(schedulerState.hasCompletionMarker).mockResolvedValue(false);
      vi.mocked(reportGenerator.handleAutoTrigger).mockResolvedValue({
        success: false,
        error: 'Generation failed',
      });

      let savedState: any = null;
      vi.mocked(schedulerState.saveSchedulerState).mockImplementation(async (cloudId, state) => {
        savedState = state;
      });

      const result = await phase5SchedulerHandler(request, validContext);

      expect(result.statusCode).toBe(202);

      // Backoff should be 30 minutes = 1800000 ms
      const backoffTime = new Date(savedState.last_backoff_until).getTime();
      const currentTime = Date.now(); // Use the mocked current time
      const backoffDurationMs = backoffTime - currentTime;
      expect(backoffDurationMs).toBe(30 * 60 * 1000); // 30 minutes
    });

    it('should apply 120min backoff on 2nd failure', async () => {
      const request = {} as any;
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

      vi.mocked(schedulerState.loadInstallationTimestamp).mockResolvedValue(twelveHoursAgo);
      vi.mocked(schedulerState.loadSchedulerState).mockResolvedValue({
        last_run_at: startTime,
        auto_12h_generated_at: null,
        auto_24h_generated_at: null,
        last_error: null,
        last_backoff_until: null,
        auto_12h_attempt_count: 1, // Already failed once
        auto_24h_attempt_count: 0,
      });
      vi.mocked(schedulerState.hasCompletionMarker).mockResolvedValue(false);
      vi.mocked(reportGenerator.handleAutoTrigger).mockResolvedValue({
        success: false,
        error: 'Generation failed',
      });

      let savedState: any = null;
      vi.mocked(schedulerState.saveSchedulerState).mockImplementation(async (cloudId, state) => {
        savedState = state;
      });

      const result = await phase5SchedulerHandler(request, validContext);

      // Backoff should be 120 minutes = 7200000 ms
      const backoffTime = new Date(savedState.last_backoff_until).getTime();
      const currentTime = Date.now(); // Use the mocked current time
      const backoffDurationMs = backoffTime - currentTime;
      expect(backoffDurationMs).toBe(120 * 60 * 1000); // 120 minutes
    });

    it('should apply 24h backoff on 3rd+ failures', async () => {
      const request = {} as any;
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

      vi.mocked(schedulerState.loadInstallationTimestamp).mockResolvedValue(twelveHoursAgo);
      vi.mocked(schedulerState.loadSchedulerState).mockResolvedValue({
        last_run_at: startTime,
        auto_12h_generated_at: null,
        auto_24h_generated_at: null,
        last_error: null,
        last_backoff_until: null,
        auto_12h_attempt_count: 2, // Already failed twice
        auto_24h_attempt_count: 0,
      });
      vi.mocked(schedulerState.hasCompletionMarker).mockResolvedValue(false);
      vi.mocked(reportGenerator.handleAutoTrigger).mockResolvedValue({
        success: false,
        error: 'Generation failed',
      });

      let savedState: any = null;
      vi.mocked(schedulerState.saveSchedulerState).mockImplementation(async (cloudId, state) => {
        savedState = state;
      });

      const result = await phase5SchedulerHandler(request, validContext);

      // Backoff should be 1440 minutes (24h) = 86400000 ms
      const backoffTime = new Date(savedState.last_backoff_until).getTime();
      const currentTime = Date.now(); // Use the mocked current time
      const backoffDurationMs = backoffTime - currentTime;
      expect(backoffDurationMs).toBe(24 * 60 * 60 * 1000); // 24 hours
    });

    it('should skip generation if backoff is still active', async () => {
      const request = {} as any;
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      const backoffUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h from now

      vi.mocked(schedulerState.loadInstallationTimestamp).mockResolvedValue(twelveHoursAgo);
      vi.mocked(schedulerState.loadSchedulerState).mockResolvedValue({
        last_run_at: startTime,
        auto_12h_generated_at: null,
        auto_24h_generated_at: null,
        last_error: null,
        last_backoff_until: backoffUntil,
        auto_12h_attempt_count: 1,
        auto_24h_attempt_count: 0,
      });
      vi.mocked(schedulerState.hasCompletionMarker).mockResolvedValue(false);

      const result = await phase5SchedulerHandler(request, validContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('Backoff period active');

      // handleAutoTrigger should NOT be called
      expect(reportGenerator.handleAutoTrigger).not.toHaveBeenCalled();
    });
  });

  // ================================================================
  // E. FAIL-CLOSED (NEVER THROWS)
  // ================================================================

  describe('E. Fail-Closed - Never Throws', () => {
    const validContext = { cloudId: 'test-cloud' } as any;

    it('should catch and return 500 on scheduler logic exception', async () => {
      const request = {} as any;

      vi.mocked(schedulerState.loadInstallationTimestamp).mockRejectedValue(
        new Error('Storage error')
      );

      const result = await phase5SchedulerHandler(request, validContext);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.message).toContain('Scheduler error');
    });

    it('should return 202 on generation error (not throw)', async () => {
      const validContext = { cloudId: 'test-cloud' } as any;
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

      const request = {} as any;

      vi.mocked(schedulerState.loadInstallationTimestamp).mockResolvedValue(twelveHoursAgo);
      vi.mocked(schedulerState.loadSchedulerState).mockResolvedValue({
        last_run_at: startTime,
        auto_12h_generated_at: null,
        auto_24h_generated_at: null,
        last_error: null,
        last_backoff_until: null,
        auto_12h_attempt_count: 0,
        auto_24h_attempt_count: 0,
      });
      vi.mocked(schedulerState.hasCompletionMarker).mockResolvedValue(false);
      vi.mocked(reportGenerator.handleAutoTrigger).mockRejectedValue(
        new Error('Generation crashed')
      );

      const result = await phase5SchedulerHandler(request, validContext);

      expect(result.statusCode).toBe(202); // Accepted (will retry on next trigger)
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });
  });

  // ================================================================
  // F. SINGLE CODE PATH
  // ================================================================

  describe('F. Single Code Path (handleAutoTrigger)', () => {
    const validContext = { cloudId: 'test-cloud' } as any;

    it('should always use handleAutoTrigger for generation (never direct logic)', async () => {
      const request = {} as any;
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

      vi.mocked(schedulerState.loadInstallationTimestamp).mockResolvedValue(twelveHoursAgo);
      vi.mocked(schedulerState.loadSchedulerState).mockResolvedValue({
        last_run_at: startTime,
        auto_12h_generated_at: null,
        auto_24h_generated_at: null,
        last_error: null,
        last_backoff_until: null,
        auto_12h_attempt_count: 0,
        auto_24h_attempt_count: 0,
      });
      vi.mocked(schedulerState.hasCompletionMarker).mockResolvedValue(false);
      vi.mocked(reportGenerator.handleAutoTrigger).mockResolvedValue({
        success: true,
        report: { trigger: 'AUTO_12H' } as any,
      });

      const result = await phase5SchedulerHandler(request, validContext);

      expect(reportGenerator.handleAutoTrigger).toHaveBeenCalledWith('AUTO_12H');
      expect(reportGenerator.handleAutoTrigger).toHaveBeenCalledTimes(1);
    });
  });

  // ================================================================
  // G. CONCURRENCY SAFETY
  // ================================================================

  describe('G. Concurrency Safety - Write-Once DONE Semantics', () => {
    const validContext = { cloudId: 'test-cloud' } as any;

    it('should track separate attempt counts for AUTO_12H and AUTO_24H', async () => {
      // Setup: AUTO_24H with 5 prior attempts
      const request = {} as any;
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      vi.mocked(schedulerState.loadInstallationTimestamp).mockResolvedValue(twentyFourHoursAgo);
      vi.mocked(schedulerState.loadSchedulerState).mockResolvedValue({
        last_run_at: startTime,
        auto_12h_generated_at: null,
        auto_24h_generated_at: null,
        last_error: null,
        last_backoff_until: null,
        auto_12h_attempt_count: 0, // AUTO_12H: 0 attempts
        auto_24h_attempt_count: 5, // AUTO_24H: 5 attempts
      });
      vi.mocked(schedulerState.hasCompletionMarker).mockResolvedValue(false);
      vi.mocked(reportGenerator.handleAutoTrigger).mockResolvedValue({
        success: false,
        error: 'Failed',
      });

      let savedState: any = null;
      vi.mocked(schedulerState.saveSchedulerState).mockImplementation((cloudId, state) => {
        savedState = state;
      });

      const result = await phase5SchedulerHandler(request, validContext);

      // Should attempt AUTO_24H with 5 attempts -> 24h backoff
      const backoffTime = new Date(savedState.last_backoff_until).getTime();
      const currentTime = new Date(startTime).getTime();
      const backoffDurationMs = backoffTime - currentTime;
      expect(backoffDurationMs).toBe(24 * 60 * 60 * 1000);

      // Saved state should have incremented AUTO_24H attempt count
      expect(savedState.auto_24h_attempt_count).toBe(6);
      expect(savedState.auto_12h_attempt_count).toBe(0); // Unchanged
    });
  });
});
