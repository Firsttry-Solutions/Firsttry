/**
 * PHASE P2: AUDIT EVENT TRACKING
 *
 * Records all output-related events for compliance and troubleshooting.
 * All events are tenant-scoped, retention-scoped, and contain no PII.
 *
 * Reuses Phase P1 logging safety patterns (no PII in events).
 */

import { api } from '@forge/api';

/**
 * Audit event types
 */
export type AuditEventType =
  | 'OUTPUT_GENERATED'
  | 'OUTPUT_EXPORTED'
  | 'ACKNOWLEDGED_DEGRADED_OUTPUT'
  | 'OUTPUT_EXPIRED_VIEWED';

/**
 * Audit event record
 * Tenant-scoped, retention-scoped, no PII
 */
export interface AuditEvent {
  // Identity
  eventId: string; // UUID
  tenantId: string;
  cloudId: string;

  // Event metadata
  eventType: AuditEventType;
  occurredAtISO: string;

  // Context (no PII)
  snapshotId: string;
  outputId: string;
  outputType?: 'json' | 'pdf' | 'export';
  validityStatus?: string; // VALID, DEGRADED, EXPIRED, BLOCKED

  // Action context
  operatorAction?: string; // 'confirmed', 'cancelled', 'exported' (no operator ID)
  reason?: string; // Why action was taken (if applicable)

  // Retention scope
  expiresAtISO: string;
}

/**
 * Audit event store
 * Tenant-isolated, respects retention policy
 */
export class AuditEventStore {
  constructor(
    private tenantId: string,
    private cloudId: string
  ) {}

  /**
   * Record an event in the audit trail
   */
  async recordEvent(
    eventType: AuditEventType,
    snapshotId: string,
    outputId: string,
    context: {
      outputType?: 'json' | 'pdf' | 'export';
      validityStatus?: string;
      operatorAction?: string;
      reason?: string;
    },
    nowISO: string,
    expiresAtISO: string
  ): Promise<void> {
    const eventId = this.generateEventId();
    const storageKey = this.getAuditEventKey(eventId);

    const event: AuditEvent = {
      eventId,
      tenantId: this.tenantId,
      cloudId: this.cloudId,
      eventType,
      occurredAtISO: nowISO,
      snapshotId,
      outputId,
      outputType: context.outputType,
      validityStatus: context.validityStatus,
      operatorAction: context.operatorAction,
      reason: context.reason,
      expiresAtISO,
    };

    const ttlSeconds = Math.ceil((new Date(expiresAtISO).getTime() - new Date(nowISO).getTime()) / 1000);

    await api.asApp().requestStorage(async (storage) => {
      await storage.set(storageKey, event, { ttl: Math.max(1, ttlSeconds) });
    });
  }

  /**
   * Record OUTPUT_GENERATED event
   */
  async recordOutputGenerated(
    snapshotId: string,
    outputId: string,
    outputType: 'json' | 'pdf' | 'export',
    validityStatus: string,
    nowISO: string,
    expiresAtISO: string
  ): Promise<void> {
    await this.recordEvent(
      'OUTPUT_GENERATED',
      snapshotId,
      outputId,
      { outputType, validityStatus },
      nowISO,
      expiresAtISO
    );
  }

  /**
   * Record OUTPUT_EXPORTED event
   */
  async recordOutputExported(
    snapshotId: string,
    outputId: string,
    outputType: 'json' | 'pdf' | 'export',
    validityStatus: string,
    operatorAction: string,
    nowISO: string,
    expiresAtISO: string
  ): Promise<void> {
    await this.recordEvent(
      'OUTPUT_EXPORTED',
      snapshotId,
      outputId,
      { outputType, validityStatus, operatorAction },
      nowISO,
      expiresAtISO
    );
  }

  /**
   * Record ACKNOWLEDGED_DEGRADED_OUTPUT event
   */
  async recordAcknowledgedDegradation(
    snapshotId: string,
    outputId: string,
    outputType: 'json' | 'pdf' | 'export',
    validityStatus: string,
    reason: string,
    nowISO: string,
    expiresAtISO: string
  ): Promise<void> {
    await this.recordEvent(
      'ACKNOWLEDGED_DEGRADED_OUTPUT',
      snapshotId,
      outputId,
      { outputType, validityStatus, reason },
      nowISO,
      expiresAtISO
    );
  }

  /**
   * Record OUTPUT_EXPIRED_VIEWED event
   * Triggered when user views an output that has since expired
   */
  async recordExpiredOutputViewed(
    snapshotId: string,
    outputId: string,
    outputType: 'json' | 'pdf' | 'export',
    reason: string,
    nowISO: string,
    expiresAtISO: string
  ): Promise<void> {
    await this.recordEvent(
      'OUTPUT_EXPIRED_VIEWED',
      snapshotId,
      outputId,
      { outputType, reason },
      nowISO,
      expiresAtISO
    );
  }

  /**
   * Retrieve audit events for a snapshot
   */
  async getEventsForSnapshot(snapshotId: string): Promise<AuditEvent[]> {
    return await api.asApp().requestStorage(async (storage) => {
      const prefix = `${this.tenantId}:audit:`;
      const results = await storage.query({ prefix, limit: 10000 });

      const events: AuditEvent[] = [];
      for (const entry of results.entries || []) {
        if (typeof entry.value === 'object' && entry.value !== null) {
          const event = entry.value as AuditEvent;
          if (event.snapshotId === snapshotId) {
            events.push(event);
          }
        }
      }
      return events.sort((a, b) => new Date(a.occurredAtISO).getTime() - new Date(b.occurredAtISO).getTime());
    });
  }

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Storage key for an audit event (tenant-scoped)
   */
  private getAuditEventKey(eventId: string): string {
    return `${this.tenantId}:audit:${eventId}`;
  }

  /**
   * Convenience: record a generic failure event for system operations
   */
  async recordFailureEvent(eventName: string, message: string, context: any): Promise<void> {
    const nowISO = new Date().toISOString();
    const expiresAtISO = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const snapshotId = context?.snapshotId || context?.evidenceId || 'unknown';
    const outputId = context?.outputId || context?.evidenceId || 'unknown';

    await this.recordEvent(
      'OUTPUT_GENERATED',
      snapshotId,
      outputId,
      {
        outputType: undefined,
        validityStatus: context?.originalTruth || context?.validityStatus || undefined,
        operatorAction: 'failed',
        reason: typeof context === 'string' ? context : JSON.stringify(context || {}),
      },
      nowISO,
      expiresAtISO
    );
  }

  /**
   * Convenience: record a generic success event for system operations
   */
  async recordSuccessEvent(eventName: string, message: string, context: any): Promise<void> {
    const nowISO = new Date().toISOString();
    const expiresAtISO = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const snapshotId = context?.snapshotId || context?.evidenceId || 'unknown';
    const outputId = context?.outputId || context?.evidenceId || 'unknown';

    await this.recordEvent(
      'OUTPUT_GENERATED',
      snapshotId,
      outputId,
      {
        outputType: undefined,
        validityStatus: context?.originalTruth || context?.validityStatus || undefined,
        operatorAction: 'succeeded',
        reason: typeof context === 'string' ? context : JSON.stringify(context || {}),
      },
      nowISO,
      expiresAtISO
    );
  }
}

/**
 * Get audit event store for a tenant
 */
export function getAuditEventStore(tenantId: string, cloudId: string): AuditEventStore {
  return new AuditEventStore(tenantId, cloudId);
}
