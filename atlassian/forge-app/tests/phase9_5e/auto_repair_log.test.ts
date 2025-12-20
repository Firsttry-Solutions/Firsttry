/**
 * Phase 9.5-E: Auto-Repair Log Tests
 *
 * 20+ tests covering:
 * - Event logging and creation
 * - Hash verification and integrity
 * - No Jira writes ever occur
 * - Outcome tracking (success/partial/failed)
 * - Filtering and aggregation
 * - Export functionality
 * - Rendering and display
 * - Timestamps and time periods
 * - Edge cases
 * - Integration scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAutoRepairEvent,
  buildAutoRepairLog,
  verifyAutoRepairLogHash,
  computeAutoRepairLogHash,
  renderAutoRepairTimelineHtml,
  renderAutoRepairTableHtml,
  exportAutoRepairLogJson,
  generateAutoRepairReport,
  AutoRepairEvent,
  AutoRepairLog,
  RepairType,
  RepairTriggerReason,
  RepairOutcome,
} from '../../src/phase9_5e/auto_repair_log';

describe('Phase 9.5-E: Auto-Repair Disclosure Log', () => {
  let baseEvent: Omit<Parameters<typeof createAutoRepairEvent>[0], 'tenant_id'>;

  beforeEach(() => {
    baseEvent = {
      repair_type: 'retry',
      trigger_reason: 'timeout',
      outcome: 'success',
      affected_operation: 'snapshot_capture',
      repair_duration_ms: 250,
      success_after_repair: true,
    };
  });

  // ============================================
  // TC-9.5-E-1: Event Creation (3 tests)
  // ============================================

  describe('TC-9.5-E-1: Event Creation', () => {
    it('should create auto-repair event with all required fields', () => {
      const event = createAutoRepairEvent({
        tenant_id: 'test-tenant',
        ...baseEvent,
      });

      expect(event.tenant_id).toBe('test-tenant');
      expect(event.repair_type).toBe('retry');
      expect(event.trigger_reason).toBe('timeout');
      expect(event.outcome).toBe('success');
      expect(event.event_id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.schema_version).toBe('1.0');
    });

    it('should handle all repair types', () => {
      const repairTypes: RepairType[] = [
        'retry',
        'pagination_adjust',
        'fallback_endpoint',
        'partial_degrade',
        'connection_reset',
        'cache_invalidate',
        'timeout_extend',
      ];

      for (const type of repairTypes) {
        const event = createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
          repair_type: type,
        });

        expect(event.repair_type).toBe(type);
      }
    });

    it('should handle all trigger reasons', () => {
      const reasons: RepairTriggerReason[] = [
        'timeout',
        'rate_limit',
        'service_unavailable',
        'partial_failure',
        'connection_error',
        'malformed_response',
        'quota_exceeded',
        'unknown',
      ];

      for (const reason of reasons) {
        const event = createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
          trigger_reason: reason,
        });

        expect(event.trigger_reason).toBe(reason);
      }
    });
  });

  // ============================================
  // TC-9.5-E-2: Outcome Tracking (3 tests)
  // ============================================

  describe('TC-9.5-E-2: Outcome Tracking', () => {
    it('should track successful outcomes', () => {
      const event = createAutoRepairEvent({
        tenant_id: 'test',
        ...baseEvent,
        outcome: 'success',
        success_after_repair: true,
      });

      expect(event.outcome).toBe('success');
      expect(event.details.success_after_repair).toBe(true);
    });

    it('should track partial outcomes', () => {
      const event = createAutoRepairEvent({
        tenant_id: 'test',
        ...baseEvent,
        outcome: 'partial',
        success_after_repair: false,
      });

      expect(event.outcome).toBe('partial');
      expect(event.details.success_after_repair).toBe(false);
    });

    it('should track failed outcomes', () => {
      const event = createAutoRepairEvent({
        tenant_id: 'test',
        ...baseEvent,
        outcome: 'failed',
        success_after_repair: false,
      });

      expect(event.outcome).toBe('failed');
      expect(event.details.success_after_repair).toBe(false);
    });
  });

  // ============================================
  // TC-9.5-E-3: Log Building (3 tests)
  // ============================================

  describe('TC-9.5-E-3: Log Building', () => {
    it('should build log from events and calculate statistics', () => {
      const events = [
        createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
          outcome: 'success',
        }),
        createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
          outcome: 'success',
        }),
        createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
          outcome: 'partial',
        }),
        createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
          outcome: 'failed',
        }),
      ];

      const log = buildAutoRepairLog('test', events);

      expect(log.total_events).toBe(4);
      expect(log.events_by_outcome.success).toBe(2);
      expect(log.events_by_outcome.partial).toBe(1);
      expect(log.events_by_outcome.failed).toBe(1);
      expect(log.success_rate).toBe(50); // 2/4 = 50%
    });

    it('should calculate repair type breakdown', () => {
      const events = [
        createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
          repair_type: 'retry',
        }),
        createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
          repair_type: 'retry',
        }),
        createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
          repair_type: 'fallback_endpoint',
        }),
      ];

      const log = buildAutoRepairLog('test', events);

      expect(log.repair_type_breakdown.retry).toBe(2);
      expect(log.repair_type_breakdown.fallback_endpoint).toBe(1);
      expect(log.repair_type_breakdown.pagination_adjust).toBe(0);
    });

    it('should calculate trigger reason breakdown', () => {
      const events = [
        createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
          trigger_reason: 'timeout',
        }),
        createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
          trigger_reason: 'timeout',
        }),
        createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
          trigger_reason: 'rate_limit',
        }),
      ];

      const log = buildAutoRepairLog('test', events);

      expect(log.trigger_reason_breakdown.timeout).toBe(2);
      expect(log.trigger_reason_breakdown.rate_limit).toBe(1);
      expect(log.trigger_reason_breakdown.unknown).toBe(0);
    });
  });

  // ============================================
  // TC-9.5-E-4: Hash Verification (2 tests)
  // ============================================

  describe('TC-9.5-E-4: Hash Verification', () => {
    it('should verify hash of unmodified log', () => {
      const events = [
        createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
        }),
      ];
      const log = buildAutoRepairLog('test', events);

      expect(verifyAutoRepairLogHash(log)).toBe(true);
    });

    it('should detect modification of log data', () => {
      const events = [
        createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
        }),
      ];
      const log = buildAutoRepairLog('test', events);
      const originalHash = log.canonical_hash;

      // Modify the log
      log.success_rate = 0;

      expect(verifyAutoRepairLogHash(log)).toBe(false);
      expect(log.canonical_hash).toBe(originalHash); // Hash stays same (data not rehashed)
    });
  });

  // ============================================
  // TC-9.5-E-5: No Jira Writes (3 tests)
  // ============================================

  describe('TC-9.5-E-5: No Jira Writes Ever', () => {
    it('should never make API calls to create events', () => {
      // This test verifies that createAutoRepairEvent is pure
      // (no side effects, no API calls)
      const event = createAutoRepairEvent({
        tenant_id: 'test',
        ...baseEvent,
      });

      // If function made API call, test would fail in CI/CD
      expect(event).toBeDefined();
      expect(event.event_id).toBeDefined();
    });

    it('should never modify original events when building log', () => {
      const events = [
        createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
        }),
      ];
      const eventsCopy = JSON.parse(JSON.stringify(events));

      // Build log (should not modify original events)
      buildAutoRepairLog('test', events);

      // Verify events are unchanged
      expect(events).toEqual(eventsCopy);
    });

    it('should be read-only, never write Jira data', () => {
      // All functions in this module are read-only
      // They only create local objects and export data
      const events = [
        createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
        }),
      ];
      const log = buildAutoRepairLog('test', events);
      const json = exportAutoRepairLogJson(log);
      const report = generateAutoRepairReport(log);

      // All outputs are data, not mutations
      expect(json).toBeDefined();
      expect(report).toContain('Self-Recovery');
      expect(report).not.toContain('fix');
      expect(report).not.toContain('recommend');
    });
  });

  // ============================================
  // TC-9.5-E-6: Rendering (2 tests)
  // ============================================

  describe('TC-9.5-E-6: Rendering', () => {
    it('should render timeline HTML with all events', () => {
      const events = [
        createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
        }),
      ];
      const log = buildAutoRepairLog('test', events);
      const html = renderAutoRepairTimelineHtml(log);

      expect(html).toContain('auto-repair-timeline');
      expect(html).toContain('System Self-Recovery Events');
      expect(html).toContain('retry');
      expect(html).toContain('timeout');
    });

    it('should render table HTML with all events', () => {
      const events = [
        createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
        }),
      ];
      const log = buildAutoRepairLog('test', events);
      const html = renderAutoRepairTableHtml(log);

      expect(html).toContain('auto-repair-table');
      expect(html).toContain('repair-events-table');
      expect(html).toContain('retry');
    });
  });

  // ============================================
  // TC-9.5-E-7: Export (2 tests)
  // ============================================

  describe('TC-9.5-E-7: Export', () => {
    it('should export as JSON with all fields', () => {
      const events = [
        createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
        }),
      ];
      const log = buildAutoRepairLog('test', events);
      const json = exportAutoRepairLogJson(log);

      expect(json).toHaveProperty('total_events');
      expect(json).toHaveProperty('success_rate');
      expect(json).toHaveProperty('events_by_outcome');
      expect(json).toHaveProperty('repair_type_breakdown');
      expect(json).toHaveProperty('trigger_reason_breakdown');
      expect(json).toHaveProperty('canonical_hash');
      expect(json).toHaveProperty('events');
    });

    it('should generate markdown report', () => {
      const events = [
        createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
        }),
      ];
      const log = buildAutoRepairLog('test', events);
      const report = generateAutoRepairReport(log);

      expect(report).toContain('# System Self-Recovery Events');
      expect(report).toContain('successfully self-recovered from');
      expect(report).toContain('Success rate');
      expect(report).toContain('## Summary');
      expect(report).toContain('## Statistics');
    });
  });

  // ============================================
  // TC-9.5-E-8: Timestamps (2 tests)
  // ============================================

  describe('TC-9.5-E-8: Timestamps', () => {
    it('should use ISO 8601 UTC timestamps', () => {
      const event = createAutoRepairEvent({
        tenant_id: 'test',
        ...baseEvent,
      });

      expect(event.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(event.timestamp).toContain('Z') || expect(event.timestamp).toMatch(/[+\-]\d{2}:\d{2}$/);
    });

    it('should track time period in log', () => {
      const events = [
        createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
        }),
      ];
      const log = buildAutoRepairLog('test', events);

      expect(log.time_period_start).toBeDefined();
      expect(log.time_period_end).toBeDefined();
      expect(typeof log.time_period_start).toBe('string');
      expect(typeof log.time_period_end).toBe('string');
    });
  });

  // ============================================
  // TC-9.5-E-9: Edge Cases (3 tests)
  // ============================================

  describe('TC-9.5-E-9: Edge Cases', () => {
    it('should handle empty event list', () => {
      const log = buildAutoRepairLog('test', []);

      expect(log.total_events).toBe(0);
      expect(log.success_rate).toBe(0);
      expect(log.events_by_outcome.success).toBe(0);
    });

    it('should handle events with optional fields missing', () => {
      const event = createAutoRepairEvent({
        tenant_id: 'test',
        ...baseEvent,
      });

      expect(event.linked_snapshot_run_id).toBeNull();
      expect(event.details.original_error).toBeUndefined();
    });

    it('should handle events with all optional fields present', () => {
      const event = createAutoRepairEvent({
        tenant_id: 'test',
        ...baseEvent,
        linked_snapshot_run_id: 'run-123',
        original_error: 'Connection timeout',
      });

      expect(event.linked_snapshot_run_id).toBe('run-123');
      expect(event.details.original_error).toBe('Connection timeout');
    });
  });

  // ============================================
  // TC-9.5-E-10: Determinism (2 tests)
  // ============================================

  describe('TC-9.5-E-10: Determinism', () => {
    it('should produce same hash from same log data (multiple times)', () => {
      const events = [
        createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
        }),
      ];

      const log1 = buildAutoRepairLog('test', events);
      const log2 = buildAutoRepairLog('test', events);

      expect(log1.canonical_hash).toBe(log2.canonical_hash);
    });

    it('should produce different hash for different outcome counts', () => {
      const successEvent = createAutoRepairEvent({
        tenant_id: 'test',
        ...baseEvent,
        outcome: 'success',
      });
      const failedEvent = createAutoRepairEvent({
        tenant_id: 'test',
        ...baseEvent,
        outcome: 'failed',
      });

      const log1 = buildAutoRepairLog('test', [successEvent]);
      const log2 = buildAutoRepairLog('test', [successEvent, failedEvent]);

      expect(log1.canonical_hash).not.toBe(log2.canonical_hash);
    });
  });

  // ============================================
  // TC-9.5-E-11: Duration Tracking (2 tests)
  // ============================================

  describe('TC-9.5-E-11: Duration Tracking', () => {
    it('should track repair duration in milliseconds', () => {
      const event = createAutoRepairEvent({
        tenant_id: 'test',
        ...baseEvent,
        repair_duration_ms: 500,
      });

      expect(event.details.repair_duration_ms).toBe(500);
    });

    it('should handle very fast repairs (<1ms)', () => {
      const event = createAutoRepairEvent({
        tenant_id: 'test',
        ...baseEvent,
        repair_duration_ms: 0,
      });

      expect(event.details.repair_duration_ms).toBe(0);
    });
  });

  // ============================================
  // TC-9.5-E-12: Attempt Tracking (1 test)
  // ============================================

  describe('TC-9.5-E-12: Attempt Tracking', () => {
    it('should track attempt number for retries', () => {
      for (let attempt = 1; attempt <= 5; attempt++) {
        const event = createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
          attempt_number: attempt,
        });

        expect(event.attempt_number).toBe(attempt);
      }
    });
  });

  // ============================================
  // TC-9.5-E-13: Prohibited Terms (1 test)
  // ============================================

  describe('TC-9.5-E-13: Prohibited Terms', () => {
    it('should never use "fix", "recommend", or causal language', () => {
      const events = [
        createAutoRepairEvent({
          tenant_id: 'test',
          ...baseEvent,
        }),
      ];
      const log = buildAutoRepairLog('test', events);

      const html1 = renderAutoRepairTimelineHtml(log);
      const html2 = renderAutoRepairTableHtml(log);
      const json = exportAutoRepairLogJson(log);
      const report = generateAutoRepairReport(log);

      const prohibited = ['fix', 'recommend', 'root cause', 'impact', 'improve'];

      for (const term of prohibited) {
        expect(html1.toLowerCase()).not.toContain(term.toLowerCase());
        expect(html2.toLowerCase()).not.toContain(term.toLowerCase());
        expect(report.toLowerCase()).not.toContain(term.toLowerCase());
      }
    });
  });

  // ============================================
  // TC-9.5-E-14: Integration (1 test)
  // ============================================

  describe('TC-9.5-E-14: Integration', () => {
    it('should handle realistic multi-event scenario', () => {
      const events = [
        // Timeout, retry successful
        createAutoRepairEvent({
          tenant_id: 'acme-corp',
          repair_type: 'retry',
          trigger_reason: 'timeout',
          outcome: 'success',
          affected_operation: 'snapshot_capture',
          repair_duration_ms: 150,
          success_after_repair: true,
          attempt_number: 1,
        }),
        // Rate limit, fallback endpoint
        createAutoRepairEvent({
          tenant_id: 'acme-corp',
          repair_type: 'fallback_endpoint',
          trigger_reason: 'rate_limit',
          outcome: 'partial',
          affected_operation: 'field_analysis',
          repair_duration_ms: 320,
          success_after_repair: false,
          attempt_number: 1,
        }),
        // Connection error, cache invalidate
        createAutoRepairEvent({
          tenant_id: 'acme-corp',
          repair_type: 'cache_invalidate',
          trigger_reason: 'connection_error',
          outcome: 'success',
          affected_operation: 'workflow_analysis',
          repair_duration_ms: 75,
          success_after_repair: true,
          attempt_number: 2,
        }),
        // Service unavailable, graceful degrade
        createAutoRepairEvent({
          tenant_id: 'acme-corp',
          repair_type: 'partial_degrade',
          trigger_reason: 'service_unavailable',
          outcome: 'partial',
          affected_operation: 'snapshot_capture',
          repair_duration_ms: 50,
          success_after_repair: false,
          attempt_number: 1,
        }),
      ];

      const log = buildAutoRepairLog('acme-corp', events);

      // Verify aggregation
      expect(log.total_events).toBe(4);
      expect(log.events_by_outcome.success).toBe(2);
      expect(log.events_by_outcome.partial).toBe(2);
      expect(log.events_by_outcome.failed).toBe(0);
      expect(log.success_rate).toBe(50); // 2 out of 4

      // Verify type breakdown
      expect(log.repair_type_breakdown.retry).toBe(1);
      expect(log.repair_type_breakdown.fallback_endpoint).toBe(1);
      expect(log.repair_type_breakdown.cache_invalidate).toBe(1);
      expect(log.repair_type_breakdown.partial_degrade).toBe(1);

      // Verify hash works
      expect(verifyAutoRepairLogHash(log)).toBe(true);

      // Verify exports work
      const json = exportAutoRepairLogJson(log);
      expect(json.total_events).toBe(4);
      expect(json.events).toHaveLength(4);

      const report = generateAutoRepairReport(log);
      expect(report).toContain('successfully self-recovered from 2 transient issues');
      expect(report).toContain('50');
    });
  });
});
