/**
 * Phase 9.5-F: Silence-as-Success Indicator Tests
 *
 * 15+ tests covering:
 * - Silence condition detection (all three conditions)
 * - Indicator state transitions
 * - Never implies Jira health
 * - Hash verification and integrity
 * - Rendering and export
 * - Edge cases and determinism
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  assessSilenceCondition,
  determineSilenceIndicatorState,
  generateSilenceMessage,
  createSilenceIndicatorReport,
  computeSilenceIndicatorHash,
  verifySilenceIndicatorHash,
  buildSilenceTimeline,
  renderSilenceIndicatorHtml,
  renderSilenceTimelineHtml,
  generateSilenceIndicatorReport,
  exportSilenceIndicatorJson,
  SilenceHistoryEntry,
} from '../../src/phase9_5f/silence_indicator';

describe('Phase 9.5-F: Silence-as-Success Indicator', () => {
  // ============================================
  // TC-9.5-F-1: Silence Condition Detection (3)
  // ============================================

  describe('TC-9.5-F-1: Silence Condition Detection', () => {
    it('should detect operating normally when all conditions met', () => {
      const condition = assessSilenceCondition(
        95, // snapshots_succeeding threshold
        0,  // no_failures_pending
        0   // no_alerts_triggered
      );

      expect(condition.snapshots_succeeding).toBe(true);
      expect(condition.no_failures_pending).toBe(true);
      expect(condition.no_alerts_triggered).toBe(true);
      expect(condition.all_conditions_met).toBe(true);
    });

    it('should detect issues when snapshot success below 95%', () => {
      const condition = assessSilenceCondition(
        90, // below 95% threshold
        0,
        0
      );

      expect(condition.snapshots_succeeding).toBe(false);
      expect(condition.all_conditions_met).toBe(false);
    });

    it('should detect issues when failures pending', () => {
      const condition = assessSilenceCondition(
        100,
        1, // pending failure
        0
      );

      expect(condition.no_failures_pending).toBe(false);
      expect(condition.all_conditions_met).toBe(false);
    });
  });

  // ============================================
  // TC-9.5-F-2: Indicator State Transitions (2)
  // ============================================

  describe('TC-9.5-F-2: Indicator State Transitions', () => {
    it('should transition to operating_normally', () => {
      const condition = assessSilenceCondition(95, 0, 0);
      const state = determineSilenceIndicatorState(condition);

      expect(state).toBe('operating_normally');
    });

    it('should transition to issues_detected', () => {
      const condition = assessSilenceCondition(80, 2, 3);
      const state = determineSilenceIndicatorState(condition);

      expect(state).toBe('issues_detected');
    });
  });

  // ============================================
  // TC-9.5-F-3: Message Generation (2)
  // ============================================

  describe('TC-9.5-F-3: Message Generation', () => {
    it('should generate silence message when operating normally', () => {
      const condition = assessSilenceCondition(100, 0, 0);
      const state = determineSilenceIndicatorState(condition);
      const message = generateSilenceMessage(state, condition, 100, 0, 0);

      expect(message).toBe('FirstTry operating normally');
      expect(message).not.toContain('fix');
      expect(message).not.toContain('recommend');
    });

    it('should generate issues message with all problems', () => {
      const condition = assessSilenceCondition(50, 2, 1);
      const state = determineSilenceIndicatorState(condition);
      const message = generateSilenceMessage(state, condition, 50, 2, 1);

      expect(message).toContain('Issues detected');
      expect(message).toContain('snapshots at 50.0% success');
      expect(message).toContain('2 pending');
      expect(message).toContain('1 alert');
    });
  });

  // ============================================
  // TC-9.5-F-4: Report Creation (2)
  // ============================================

  describe('TC-9.5-F-4: Report Creation', () => {
    it('should create silence indicator report with all fields', () => {
      const report = createSilenceIndicatorReport({
        tenant_id: 'test-tenant',
        recent_snapshot_count: 100,
        recent_snapshot_success_count: 95,
        pending_failures: 0,
        active_alerts: 0,
      });

      expect(report.tenant_id).toBe('test-tenant');
      expect(report.indicator_state).toBe('operating_normally');
      expect(report.message).toBe('FirstTry operating normally');
      expect(report.snapshot_success_rate).toBe(95);
      expect(report.canonical_hash).toBeDefined();
      expect(report.schema_version).toBe('1.0');
    });

    it('should calculate silence duration when operating normally', () => {
      const nowMinus30Seconds = new Date(Date.now() - 30000).toISOString();

      const report = createSilenceIndicatorReport({
        tenant_id: 'test',
        recent_snapshot_count: 100,
        recent_snapshot_success_count: 100,
        pending_failures: 0,
        active_alerts: 0,
        last_silence_start_timestamp: nowMinus30Seconds,
      });

      expect(report.silence_duration_seconds).toBeDefined();
      expect(report.silence_duration_seconds!).toBeGreaterThanOrEqual(25);
      expect(report.silence_duration_seconds!).toBeLessThanOrEqual(35);
    });
  });

  // ============================================
  // TC-9.5-F-5: Hash Verification (2)
  // ============================================

  describe('TC-9.5-F-5: Hash Verification', () => {
    it('should verify hash of unmodified report', () => {
      const report = createSilenceIndicatorReport({
        tenant_id: 'test',
        recent_snapshot_count: 10,
        recent_snapshot_success_count: 10,
        pending_failures: 0,
        active_alerts: 0,
      });

      expect(verifySilenceIndicatorHash(report)).toBe(true);
    });

    it('should detect modified report data', () => {
      const report = createSilenceIndicatorReport({
        tenant_id: 'test',
        recent_snapshot_count: 10,
        recent_snapshot_success_count: 10,
        pending_failures: 0,
        active_alerts: 0,
      });

      const originalHash = report.canonical_hash;

      // Modify the report
      report.active_alerts = 1;

      expect(verifySilenceIndicatorHash(report)).toBe(false);
      expect(report.canonical_hash).toBe(originalHash); // Hash unchanged
    });
  });

  // ============================================
  // TC-9.5-F-6: Never Implies Jira Health (2)
  // ============================================

  describe('TC-9.5-F-6: Never Implies Jira Health', () => {
    it('should not use terms implying Jira assessment', () => {
      const report = createSilenceIndicatorReport({
        tenant_id: 'test',
        recent_snapshot_count: 100,
        recent_snapshot_success_count: 100,
        pending_failures: 0,
        active_alerts: 0,
      });

      const markdown = generateSilenceIndicatorReport(report);

      // Verify prohibited terms
      expect(markdown.toLowerCase()).not.toContain('recommend');
      expect(markdown.toLowerCase()).not.toContain('fix');
      expect(markdown.toLowerCase()).not.toContain('impact');
      expect(markdown.toLowerCase()).not.toContain('root cause');

      // Verify correct framing
      expect(markdown).toContain('FirstTry');
      expect(markdown).toMatch(/Jira.*health/); // Contains both terms together
    });

    it('should clarify silence indicates FirstTry health, not Jira health', () => {
      const report = createSilenceIndicatorReport({
        tenant_id: 'test',
        recent_snapshot_count: 100,
        recent_snapshot_success_count: 100,
        pending_failures: 0,
        active_alerts: 0,
      });

      const markdown = generateSilenceIndicatorReport(report);

      expect(markdown).toContain('FirstTry\'s operational state');
      expect(markdown).toContain('not Jira health');
    });
  });

  // ============================================
  // TC-9.5-F-7: Timeline Building (2)
  // ============================================

  describe('TC-9.5-F-7: Timeline Building', () => {
    it('should build timeline from history entries', () => {
      const entries: SilenceHistoryEntry[] = [
        {
          timestamp: new Date(Date.now() - 60000).toISOString(),
          state: 'operating_normally',
          reason: 'All conditions met',
          duration_since_last_change_seconds: 0,
        },
        {
          timestamp: new Date(Date.now() - 30000).toISOString(),
          state: 'issues_detected',
          reason: 'Alert triggered',
          duration_since_last_change_seconds: 30,
        },
        {
          timestamp: new Date().toISOString(),
          state: 'operating_normally',
          reason: 'Alert cleared',
          duration_since_last_change_seconds: 30,
        },
      ];

      const timeline = buildSilenceTimeline('test', entries);

      expect(timeline.entries).toHaveLength(3);
      expect(timeline.current_state).toBe('operating_normally');
      expect(timeline.state_changes_in_period).toBe(3);
      expect(timeline.canonical_hash).toBeDefined();
    });

    it('should handle empty timeline', () => {
      const timeline = buildSilenceTimeline('test', []);

      expect(timeline.entries).toHaveLength(0);
      expect(timeline.current_state).toBe('operating_normally');
      expect(timeline.state_changes_in_period).toBe(0);
    });
  });

  // ============================================
  // TC-9.5-F-8: Rendering (2)
  // ============================================

  describe('TC-9.5-F-8: Rendering', () => {
    it('should render HTML badge for operating normally', () => {
      const report = createSilenceIndicatorReport({
        tenant_id: 'test',
        recent_snapshot_count: 100,
        recent_snapshot_success_count: 100,
        pending_failures: 0,
        active_alerts: 0,
      });

      const html = renderSilenceIndicatorHtml(report);

      expect(html).toContain('silence-indicator-badge');
      expect(html).toContain('FirstTry operating normally');
      expect(html).toContain('✓');
      expect(html).not.toContain('fix');
      expect(html).not.toContain('recommend');
    });

    it('should render timeline HTML', () => {
      const entries: SilenceHistoryEntry[] = [
        {
          timestamp: new Date().toISOString(),
          state: 'operating_normally',
          reason: 'Normal conditions',
          duration_since_last_change_seconds: 300,
        },
      ];

      const timeline = buildSilenceTimeline('test', entries);
      const html = renderSilenceTimelineHtml(timeline);

      expect(html).toContain('silence-timeline');
      expect(html).toContain('State Transitions');
      expect(html).toContain('✓');
    });
  });

  // ============================================
  // TC-9.5-F-9: Export (2)
  // ============================================

  describe('TC-9.5-F-9: Export', () => {
    it('should export as JSON with all metrics', () => {
      const report = createSilenceIndicatorReport({
        tenant_id: 'test',
        recent_snapshot_count: 100,
        recent_snapshot_success_count: 95,
        pending_failures: 0,
        active_alerts: 0,
      });

      const json = exportSilenceIndicatorJson(report);

      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('tenant_id');
      expect(json).toHaveProperty('indicator_state');
      expect(json).toHaveProperty('message');
      expect(json).toHaveProperty('conditions');
      expect(json).toHaveProperty('metrics');
      expect(json.metrics).toHaveProperty('snapshot_success_rate');
    });

    it('should generate markdown report', () => {
      const report = createSilenceIndicatorReport({
        tenant_id: 'test',
        recent_snapshot_count: 100,
        recent_snapshot_success_count: 100,
        pending_failures: 0,
        active_alerts: 0,
      });

      const markdown = generateSilenceIndicatorReport(report);

      expect(markdown).toContain('# FirstTry System Status');
      expect(markdown).toContain('FirstTry operating normally');
      expect(markdown).toContain('Conditions Assessed');
      expect(markdown).toContain('Metrics');
    });
  });

  // ============================================
  // TC-9.5-F-10: Edge Cases (2)
  // ============================================

  describe('TC-9.5-F-10: Edge Cases', () => {
    it('should handle zero snapshots', () => {
      const report = createSilenceIndicatorReport({
        tenant_id: 'test',
        recent_snapshot_count: 0,
        recent_snapshot_success_count: 0,
        pending_failures: 0,
        active_alerts: 0,
      });

      expect(report.snapshot_success_rate).toBe(0);
      expect(report.indicator_state).toBe('issues_detected');
    });

    it('should handle high failure counts', () => {
      const report = createSilenceIndicatorReport({
        tenant_id: 'test',
        recent_snapshot_count: 100,
        recent_snapshot_success_count: 100,
        pending_failures: 50,
        active_alerts: 20,
      });

      expect(report.pending_failures).toBe(50);
      expect(report.active_alerts).toBe(20);
      expect(report.indicator_state).toBe('issues_detected');
    });
  });

  // ============================================
  // TC-9.5-F-11: Determinism (2)
  // ============================================

  describe('TC-9.5-F-11: Determinism', () => {
    it('should produce same hash from same metrics', () => {
      const params = {
        tenant_id: 'test',
        recent_snapshot_count: 100,
        recent_snapshot_success_count: 95,
        pending_failures: 0,
        active_alerts: 0,
      };

      const report1 = createSilenceIndicatorReport(params);
      const report2 = createSilenceIndicatorReport(params);

      expect(report1.canonical_hash).toBe(report2.canonical_hash);
    });

    it('should produce different hash for different state', () => {
      const report1 = createSilenceIndicatorReport({
        tenant_id: 'test',
        recent_snapshot_count: 100,
        recent_snapshot_success_count: 100,
        pending_failures: 0,
        active_alerts: 0,
      });

      const report2 = createSilenceIndicatorReport({
        tenant_id: 'test',
        recent_snapshot_count: 100,
        recent_snapshot_success_count: 100,
        pending_failures: 1,
        active_alerts: 0,
      });

      expect(report1.canonical_hash).not.toBe(report2.canonical_hash);
    });
  });

  // ============================================
  // TC-9.5-F-12: Multiple Alerts (1)
  // ============================================

  describe('TC-9.5-F-12: Multiple Alert Handling', () => {
    it('should handle multiple alerts correctly', () => {
      const condition = assessSilenceCondition(100, 0, 5);

      expect(condition.no_alerts_triggered).toBe(false);
      expect(condition.all_conditions_met).toBe(false);

      const message = generateSilenceMessage('issues_detected', condition, 100, 0, 5);

      expect(message).toContain('5 alerts');
      // Verify pluralization works
      expect(message.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // TC-9.5-F-13: Threshold Boundaries (1)
  // ============================================

  describe('TC-9.5-F-13: Threshold Boundaries', () => {
    it('should use 95% as snapshot success threshold', () => {
      // 94.9% should fail
      const condition94 = assessSilenceCondition(94.9, 0, 0);
      expect(condition94.snapshots_succeeding).toBe(false);

      // 95.0% should pass
      const condition95 = assessSilenceCondition(95.0, 0, 0);
      expect(condition95.snapshots_succeeding).toBe(true);

      // 95.1% should pass
      const condition95_1 = assessSilenceCondition(95.1, 0, 0);
      expect(condition95_1.snapshots_succeeding).toBe(true);
    });
  });

  // ============================================
  // TC-9.5-F-14: Integration (1)
  // ============================================

  describe('TC-9.5-F-14: Integration', () => {
    it('should handle realistic scenario: operating normally then alert', () => {
      // Start: operating normally
      const report1 = createSilenceIndicatorReport({
        tenant_id: 'acme-corp',
        recent_snapshot_count: 100,
        recent_snapshot_success_count: 100,
        pending_failures: 0,
        active_alerts: 0,
      });

      expect(report1.indicator_state).toBe('operating_normally');
      expect(report1.message).toBe('FirstTry operating normally');

      // Then: alert triggered
      const report2 = createSilenceIndicatorReport({
        tenant_id: 'acme-corp',
        recent_snapshot_count: 100,
        recent_snapshot_success_count: 100,
        pending_failures: 0,
        active_alerts: 1,
      });

      expect(report2.indicator_state).toBe('issues_detected');
      expect(report2.message).toContain('1 alert');

      // Then: alert cleared
      const report3 = createSilenceIndicatorReport({
        tenant_id: 'acme-corp',
        recent_snapshot_count: 100,
        recent_snapshot_success_count: 100,
        pending_failures: 0,
        active_alerts: 0,
      });

      expect(report3.indicator_state).toBe('operating_normally');

      // Build timeline
      const entries: SilenceHistoryEntry[] = [
        {
          timestamp: report1.timestamp,
          state: 'operating_normally',
          reason: 'All conditions met',
          duration_since_last_change_seconds: 0,
        },
        {
          timestamp: report2.timestamp,
          state: 'issues_detected',
          reason: 'Alert triggered',
          duration_since_last_change_seconds: 0,
        },
        {
          timestamp: report3.timestamp,
          state: 'operating_normally',
          reason: 'Alert cleared',
          duration_since_last_change_seconds: 0,
        },
      ];

      const timeline = buildSilenceTimeline('acme-corp', entries);

      expect(timeline.entries).toHaveLength(3);
      expect(timeline.current_state).toBe('operating_normally');
    });
  });
});
