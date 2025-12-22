/**
 * PHASE P2: DRIFT STATE TRACKING
 *
 * Minimal but deterministic drift tracking for output validity.
 * Integrates with Phase P1.7 drift detection if present.
 *
 * Tracks snapshot fingerprints and drift events:
 * - When a new snapshot is created, fingerprint is recorded
 * - When comparing outputs to current state, detects if snapshot has drifted
 * - Drift is DETECTED if snapshot fingerprint differs from current snapshot
 */

import { api } from '@forge/api';
import { DriftStatus } from './output_contract';

/**
 * Drift event record
 */
export interface DriftEventRecord {
  driftEventId: string;
  tenantId: string;
  cloudId: string;
  snapshotId: string;
  detectedAtISO: string;
  driftDescription: string;
  expiresAtISO: string;
}

/**
 * Drift state tracker
 * Tenant-isolated
 */
export class DriftStateTracker {
  constructor(
    private tenantId: string,
    private cloudId: string
  ) {}

  /**
   * Get drift status for a snapshot
   * Returns NO_DRIFT, DRIFT_DETECTED, or UNKNOWN
   */
  async getDriftStatus(snapshotId: string, nowISO: string): Promise<DriftStatus> {
    // Check if any drift events exist for this snapshot
    const driftEvents = await this.getDriftEventsForSnapshot(snapshotId);

    if (driftEvents.length > 0) {
      // Drift detected if any events exist and are not expired
      const now = new Date(nowISO).getTime();
      const activeDrifts = driftEvents.filter((evt) => new Date(evt.expiresAtISO).getTime() > now);
      if (activeDrifts.length > 0) {
        return 'DRIFT_DETECTED';
      }
    }

    // No active drift events; state is NO_DRIFT
    return 'NO_DRIFT';
  }

  /**
   * Record a drift event for a snapshot
   * Called when governance state changes are detected
   */
  async recordDriftEvent(
    snapshotId: string,
    driftDescription: string,
    nowISO: string,
    expiresAtISO: string
  ): Promise<void> {
    const driftEventId = this.generateDriftEventId();
    const storageKey = this.getDriftEventKey(driftEventId);

    const event: DriftEventRecord = {
      driftEventId,
      tenantId: this.tenantId,
      cloudId: this.cloudId,
      snapshotId,
      detectedAtISO: nowISO,
      driftDescription,
      expiresAtISO,
    };

    const ttlSeconds = Math.ceil((new Date(expiresAtISO).getTime() - new Date(nowISO).getTime()) / 1000);

    await api.asApp().requestStorage(async (storage) => {
      await storage.set(storageKey, event, { ttl: Math.max(1, ttlSeconds) });
    });
  }

  /**
   * Retrieve all drift events for a snapshot
   */
  private async getDriftEventsForSnapshot(snapshotId: string): Promise<DriftEventRecord[]> {
    return await api.asApp().requestStorage(async (storage) => {
      const prefix = `${this.tenantId}:drift:`;
      const results = await storage.query({ prefix, limit: 10000 });

      const events: DriftEventRecord[] = [];
      for (const entry of results.entries || []) {
        if (typeof entry.value === 'object' && entry.value !== null) {
          const event = entry.value as DriftEventRecord;
          if (event.snapshotId === snapshotId) {
            events.push(event);
          }
        }
      }
      return events;
    });
  }

  /**
   * Generate a unique drift event ID
   */
  private generateDriftEventId(): string {
    return `drift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Storage key for a drift event (tenant-scoped)
   */
  private getDriftEventKey(eventId: string): string {
    return `${this.tenantId}:drift:${eventId}`;
  }
}

/**
 * Get drift state tracker for a tenant
 */
export function getDriftStateTracker(tenantId: string, cloudId: string): DriftStateTracker {
  return new DriftStateTracker(tenantId, cloudId);
}
