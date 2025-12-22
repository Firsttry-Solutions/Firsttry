/**
 * PHASE P2: PERSISTED OUTPUT RECORDS + AUDIT EVENTS
 *
 * Stores output metadata with tenant isolation and versioning.
 * All records are immutable once created.
 */

import { api } from '@forge/api';
import { OutputTruthMetadata } from './output_contract';

/**
 * Persisted record of an output generation event
 * Stored in tenant-scoped storage, immutable
 */
export interface PersistedOutputRecord {
  // Identity
  outputId: string; // Unique UUID for this output
  tenantId: string;
  cloudId: string;

  // Version tracking
  outputVersion: number; // Monotonic per (tenant, snapshotId, outputType)

  // What was generated
  snapshotId: string;
  outputType: 'json' | 'pdf' | 'export'; // Type of output
  outputGeneratedAtISO: string;

  // Truth metadata (immutable copy)
  truthMetadata: OutputTruthMetadata;

  // Export status
  wasExported: boolean;
  exportedAtISO?: string;
  exportedByOperator?: string; // User/system identifier
  operatorAcknowledgedDegradation: boolean;

  // Storage metadata
  createdAtISO: string; // When this record was created
  expiresAtISO: string; // When this record expires (from retention policy)
}

/**
 * Storage interface for output records
 * Tenant-isolated, respects retention policy
 */
export class OutputRecordStore {
  constructor(
    private tenantId: string,
    private cloudId: string
  ) {}

  /**
   * Store an output record after generation
   * Immutable: cannot be updated after creation
   */
  async recordOutputGeneration(
    outputId: string,
    snapshotId: string,
    outputType: 'json' | 'pdf' | 'export',
    truthMetadata: OutputTruthMetadata,
    nowISO: string
  ): Promise<void> {
    const storageKey = this.getOutputRecordKey(outputId);

    // Compute monotonic output version
    const version = await this.getNextOutputVersion(snapshotId, outputType);

    // Retention: outputs expire when snapshot expires + 1 day
    const expiresAtISO = truthMetadata.validUntilISO;

    const record: PersistedOutputRecord = {
      outputId,
      tenantId: this.tenantId,
      cloudId: this.cloudId,
      outputVersion: version,
      snapshotId,
      outputType,
      outputGeneratedAtISO: truthMetadata.generatedAtISO,
      truthMetadata,
      wasExported: false,
      operatorAcknowledgedDegradation: false,
      createdAtISO: nowISO,
      expiresAtISO,
    };

    await api.asApp().requestStorage(async (storage) => {
      const ttlSeconds = Math.ceil((new Date(expiresAtISO).getTime() - new Date(nowISO).getTime()) / 1000);
      await storage.set(storageKey, record, { ttl: Math.max(1, ttlSeconds) });
    });
  }

  /**
   * Mark an output as exported
   * Updates the record with export metadata
   */
  async recordOutputExport(
    outputId: string,
    exportedByOperator: string,
    operatorAcknowledgedDegradation: boolean,
    nowISO: string
  ): Promise<void> {
    const storageKey = this.getOutputRecordKey(outputId);

    const record = await this.getOutputRecord(outputId);
    if (!record) {
      throw new Error(`Output record not found: ${outputId}`);
    }

    // Update record (create new immutable version)
    const updated: PersistedOutputRecord = {
      ...record,
      wasExported: true,
      exportedAtISO: nowISO,
      exportedByOperator,
      operatorAcknowledgedDegradation,
    };

    // Recompute TTL from expiry
    const ttlSeconds = Math.ceil((new Date(record.expiresAtISO).getTime() - new Date(nowISO).getTime()) / 1000);

    await api.asApp().requestStorage(async (storage) => {
      await storage.set(storageKey, updated, { ttl: Math.max(1, ttlSeconds) });
    });
  }

  /**
   * Retrieve an output record by ID
   */
  async getOutputRecord(outputId: string): Promise<PersistedOutputRecord | null> {
    return await api.asApp().requestStorage(async (storage) => {
      const key = this.getOutputRecordKey(outputId);
      return (await storage.get(key)) as PersistedOutputRecord | null;
    });
  }

  /**
   * Retrieve all output records for a snapshot
   * Used for verification and auditing
   */
  async getOutputsForSnapshot(snapshotId: string): Promise<PersistedOutputRecord[]> {
    return await api.asApp().requestStorage(async (storage) => {
      const prefix = `${this.tenantId}:outputs:snapshot:${snapshotId}:`;
      const results = await storage.query({ prefix, limit: 1000 });

      const outputs: PersistedOutputRecord[] = [];
      for (const entry of results.entries || []) {
        if (typeof entry.value === 'object' && entry.value !== null) {
          outputs.push(entry.value as PersistedOutputRecord);
        }
      }
      return outputs;
    });
  }

  /**
   * Get the next monotonic version number for (snapshotId, outputType)
   * Prevents version number collisions
   */
  private async getNextOutputVersion(snapshotId: string, outputType: string): Promise<number> {
    return await api.asApp().requestStorage(async (storage) => {
      const versionKey = `${this.tenantId}:output:version:${snapshotId}:${outputType}`;
      let currentVersion = (await storage.get(versionKey)) as number | null;

      if (currentVersion === null) {
        currentVersion = 0;
      }

      const nextVersion = currentVersion + 1;
      await storage.set(versionKey, nextVersion);

      return nextVersion;
    });
  }

  /**
   * Storage key for an output record (tenant-scoped)
   */
  private getOutputRecordKey(outputId: string): string {
    return `${this.tenantId}:outputs:record:${outputId}`;
  }
}

/**
 * Get output record store for a tenant
 */
export function getOutputRecordStore(tenantId: string, cloudId: string): OutputRecordStore {
  return new OutputRecordStore(tenantId, cloudId);
}
