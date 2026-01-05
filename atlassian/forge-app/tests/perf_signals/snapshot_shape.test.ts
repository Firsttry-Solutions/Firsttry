/**
 * SNAPSHOT SHAPE & CONSTANTS TEST
 * 
 * Verify PerfSignalsSnapshot structure:
 * - Exact constants (mode, boundaries)
 * - Completeness transitions (EMPTY/PARTIAL/COMPLETE)
 * - Rate limit aggregation correctness
 */

import { describe, it, expect } from 'vitest';
import type { PerfSignalsSnapshot, RequestRecord } from '../../src/core/perf_signals/jira_get_wrapper';
import { computePerfSignalsSnapshot } from '../../src/core/perf_signals/computeSnapshot';

describe('Snapshot Shape & Constants', () => {
  describe('Snapshot Constants', () => {
    it('has mode = "scheduled-read-only"', () => {
      const now = new Date().toISOString();
      const snapshot = computePerfSignalsSnapshot(now, null, []);
      expect(snapshot.mode).toBe('scheduled-read-only');
    });

    it('has all boundaries = true', () => {
      const now = new Date().toISOString();
      const snapshot = computePerfSignalsSnapshot(now, null, []);
      expect(snapshot.boundaries.noJiraWrites).toBe(true);
      expect(snapshot.boundaries.noConfigChanges).toBe(true);
      expect(snapshot.boundaries.noEnforcement).toBe(true);
    });

    it('has evaluatedAtISO set to nowISO', () => {
      const now = '2024-01-01T12:00:00Z';
      const snapshot = computePerfSignalsSnapshot(now, null, []);
      expect(snapshot.evaluatedAtISO).toBe(now);
    });

    it('has window = "last-24h"', () => {
      const now = new Date().toISOString();
      const snapshot = computePerfSignalsSnapshot(now, null, []);
      expect(snapshot.jiraApi.window).toBe('last-24h');
    });
  });

  describe('Completeness Transitions', () => {
    it('returns EMPTY when no data', () => {
      const now = new Date().toISOString();
      const snapshot = computePerfSignalsSnapshot(now, null, []);
      expect(snapshot.completeness).toBe('EMPTY');
    });

    it('returns PARTIAL when only scheduler data present', () => {
      const now = new Date().toISOString();
      const schedulerData = {
        lastRunAtISO: '2024-01-01T11:00:00Z',
        lastSuccessAtISO: '2024-01-01T11:00:00Z',
        lastDurationMs: 100,
        consecutiveSuccessDays: 5,
        lastFailureReason: null,
      };
      const snapshot = computePerfSignalsSnapshot(now, schedulerData, []);
      expect(snapshot.completeness).toBe('PARTIAL');
    });

    it('returns PARTIAL when only Jira API data present', () => {
      const now = new Date().toISOString();
      const records: RequestRecord[] = [
        {
          durationMs: 100,
          ok: true,
          rateLimitRemaining: 500,
          rateLimitLimit: 1000,
        }
      ];
      const snapshot = computePerfSignalsSnapshot(now, null, records);
      expect(snapshot.completeness).toBe('PARTIAL');
    });

    it('returns COMPLETE when both scheduler and Jira API data present', () => {
      const now = new Date().toISOString();
      const schedulerData = {
        lastRunAtISO: '2024-01-01T11:00:00Z',
        lastSuccessAtISO: '2024-01-01T11:00:00Z',
        lastDurationMs: 100,
        consecutiveSuccessDays: 5,
        lastFailureReason: null,
      };
      const records: RequestRecord[] = [
        { durationMs: 50, ok: true }
      ];
      const snapshot = computePerfSignalsSnapshot(now, schedulerData, records);
      expect(snapshot.completeness).toBe('COMPLETE');
    });
  });

  describe('Snapshot Data Binding', () => {
    it('stores scheduler data when provided', () => {
      const now = new Date().toISOString();
      const schedulerData = {
        lastRunAtISO: '2024-01-01T11:00:00Z',
        lastSuccessAtISO: '2024-01-01T11:00:00Z',
        lastDurationMs: 250,
        consecutiveSuccessDays: 7,
        lastFailureReason: null,
      };
      const snapshot = computePerfSignalsSnapshot(now, schedulerData, []);
      
      expect(snapshot.scheduler.lastRunAtISO).toBe(schedulerData.lastRunAtISO);
      expect(snapshot.scheduler.lastSuccessAtISO).toBe(schedulerData.lastSuccessAtISO);
      expect(snapshot.scheduler.lastDurationMs).toBe(250);
      expect(snapshot.scheduler.consecutiveSuccessDays).toBe(7);
    });

    it('has null scheduler fields when no scheduler data', () => {
      const now = new Date().toISOString();
      const snapshot = computePerfSignalsSnapshot(now, null, []);
      
      expect(snapshot.scheduler.lastRunAtISO).toBeNull();
      expect(snapshot.scheduler.lastSuccessAtISO).toBeNull();
      expect(snapshot.scheduler.lastDurationMs).toBeNull();
      expect(snapshot.scheduler.consecutiveSuccessDays).toBeNull();
      expect(snapshot.scheduler.lastFailureReason).toBeNull();
    });

    it('stores failure reason when present', () => {
      const now = new Date().toISOString();
      const failureMsg = 'Timeout connecting to Jira Cloud instance';
      const schedulerData = {
        lastRunAtISO: '2024-01-01T11:00:00Z',
        lastSuccessAtISO: null,
        lastDurationMs: 5000,
        consecutiveSuccessDays: 0,
        lastFailureReason: failureMsg,
      };
      const snapshot = computePerfSignalsSnapshot(now, schedulerData, []);
      
      expect(snapshot.scheduler.lastFailureReason).toBe(failureMsg);
    });

    it('counts Jira API requests correctly', () => {
      const now = new Date().toISOString();
      const records: RequestRecord[] = [
        { durationMs: 50, ok: true },
        { durationMs: 100, ok: true },
        { durationMs: 75, ok: false },
      ];
      const snapshot = computePerfSignalsSnapshot(now, null, records);
      
      expect(snapshot.jiraApi.requestCount).toBe(3);
      expect(snapshot.jiraApi.errorCount).toBe(1);
    });

    it('computes latency summary from request records', () => {
      const now = new Date().toISOString();
      const records: RequestRecord[] = [
        { durationMs: 10, ok: true },
        { durationMs: 20, ok: true },
        { durationMs: 30, ok: true },
        { durationMs: 40, ok: true },
        { durationMs: 50, ok: true },
      ];
      const snapshot = computePerfSignalsSnapshot(now, null, records);
      
      expect(snapshot.jiraApi.latency.count).toBe(5);
      expect(snapshot.jiraApi.latency.maxMs).toBe(50);
      expect(snapshot.jiraApi.latency.p50ms).not.toBeNull();
      expect(snapshot.jiraApi.latency.p95ms).not.toBeNull();
    });

    it('extracts rate limit from most recent record', () => {
      const now = new Date().toISOString();
      const records: RequestRecord[] = [
        { durationMs: 50, ok: true, rateLimitRemaining: 900 },
        { durationMs: 60, ok: true, rateLimitRemaining: 800 },
        { durationMs: 70, ok: true, rateLimitRemaining: 700 },
      ];
      const snapshot = computePerfSignalsSnapshot(now, null, records);
      
      expect(snapshot.jiraApi.rateLimit.remaining).toBe(700);
      expect(snapshot.jiraApi.rateLimit.available).toBe(true);
    });
  });

  describe('Snapshot Invariants', () => {
    it('issues array is always empty in Phase 3', () => {
      const now = new Date().toISOString();
      const snapshot = computePerfSignalsSnapshot(now, null, []);
      expect(snapshot.issues).toEqual([]);
    });

    it('successCount7d is always null', () => {
      const now = new Date().toISOString();
      const snapshot = computePerfSignalsSnapshot(now, null, []);
      expect(snapshot.scheduler.successCount7d).toBeNull();
    });

    it('failureCount7d is always null', () => {
      const now = new Date().toISOString();
      const snapshot = computePerfSignalsSnapshot(now, null, []);
      expect(snapshot.scheduler.failureCount7d).toBeNull();
    });
  });
});
