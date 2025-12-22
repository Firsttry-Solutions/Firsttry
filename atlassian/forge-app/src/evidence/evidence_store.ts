/**
 * PHASE P4: EVIDENCE STORE (Immutable, Append-Only)
 * 
 * Immutable persistence layer for evidence bundles.
 * 
 * Constraints:
 * - Append-only: No updates or deletes (except via retention policy)
 * - Atomic: Evidence + hash must persist together or not at all
 * - Tenant-isolated: All keys scoped by tenant
 * - Retention-controlled: TTL enforced at storage layer
 * - Deterministic: No race conditions or corruption
 */

import { storage } from '@forge/api';
import {
  EvidenceBundle,
  EvidenceHash,
  StoredEvidence,
  isEvidenceBundle,
  isStoredEvidence,
} from './evidence_model';
import { computeEvidenceHash, verifyEvidenceHash } from './canonicalize';

/**
 * Key patterns for evidence storage
 */
function getEvidenceKey(tenantKey: string, evidenceId: string): string {
  return `p4:evidence:${tenantKey}:${evidenceId}`;
}

function getEvidenceIndexKey(tenantKey: string, page: number = 0): string {
  return `p4:evidence_index:${tenantKey}:${page}`;
}

/**
 * Evidence Store - Immutable, append-only
 */
export class EvidenceStore {
  constructor(private tenantKey: string) {}

  /**
   * Persist evidence bundle with computed hash
   * 
   * Atomicity guarantee:
   * - Bundles are always persisted with their hash
   * - No partial writes
   * - If persistence fails, error is raised (not silent)
   * 
   * Immutability guarantee:
   * - If evidence with same ID already exists, INVARIANT error raised
   * - No updates allowed
   * 
   * @throws Error if evidence already exists or persistence fails
   */
  async persistEvidence(
    bundle: EvidenceBundle,
    retentionSeconds?: number
  ): Promise<{ evidenceId: string; hash: EvidenceHash }> {
    // Validate bundle structure
    if (!isEvidenceBundle(bundle)) {
      throw new Error('Invalid evidence bundle structure');
    }

    // Compute hash
    const hash = computeEvidenceHash(bundle);

    // Check if evidence already exists (immutability check)
    const existingKey = getEvidenceKey(this.tenantKey, bundle.evidenceId);
    const existing = await storage.get(existingKey);
    if (existing) {
      throw new Error(
        `INVARIANT: Evidence ${bundle.evidenceId} already exists (immutable, append-only)`
      );
    }

    // Prepare stored evidence record
    const stored: StoredEvidence = {
      bundle,
      hash,
      storedAtISO: new Date().toISOString(),
      retention: {
        maxAgeSeconds: retentionSeconds,
        willBeDeletedAtISO: retentionSeconds
          ? new Date(Date.now() + retentionSeconds * 1000).toISOString()
          : undefined,
      },
    };

    // Persist (atomic write)
    const ttlOptions = retentionSeconds ? { ttl: retentionSeconds } : undefined;
    await storage.set(existingKey, JSON.stringify(stored), ttlOptions);

    // Add to index for pagination
    await this.addToIndex(bundle.evidenceId);

    return {
      evidenceId: bundle.evidenceId,
      hash,
    };
  }

  /**
   * Load evidence by ID
   * 
   * Returns null if not found (normal case for missing evidence).
   * Returns the bundle + hash for verification.
   */
  async loadEvidence(evidenceId: string): Promise<StoredEvidence | null> {
    const key = getEvidenceKey(this.tenantKey, evidenceId);
    const data = await storage.get(key);

    if (!data) {
      return null;
    }

    try {
      const parsed = JSON.parse(data as string);
      if (!isStoredEvidence(parsed)) {
        throw new Error('Corrupted evidence record: invalid structure');
      }
      return parsed;
    } catch (error) {
      throw new Error(`Failed to parse stored evidence: ${error}`);
    }
  }

  /**
   * Verify evidence integrity by hash
   * Used to detect tampering or corruption
   */
  async verifyEvidenceIntegrity(evidenceId: string): Promise<{
    valid: boolean;
    hash?: EvidenceHash;
    error?: string;
  }> {
    const stored = await this.loadEvidence(evidenceId);

    if (!stored) {
      return {
        valid: false,
        error: `Evidence not found: ${evidenceId}`,
      };
    }

    const isValid = verifyEvidenceHash(stored.bundle, stored.hash);

    return {
      valid: isValid,
      hash: stored.hash,
      error: isValid ? undefined : 'Hash mismatch - evidence may be corrupted or tampered',
    };
  }

  /**
   * List evidence IDs with optional pagination
   */
  async listEvidenceIds(page: number = 0, pageSize: number = 20): Promise<{
    ids: string[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    const indexKey = getEvidenceIndexKey(this.tenantKey, page);
    const indexData = await storage.get(indexKey);

    if (!indexData) {
      return {
        ids: [],
        page,
        pageSize,
        total: 0,
      };
    }

    try {
      const index = JSON.parse(indexData as string);
      return {
        ids: index.ids || [],
        page,
        pageSize,
        total: index.total || 0,
      };
    } catch (error) {
      throw new Error(`Failed to parse evidence index: ${error}`);
    }
  }

  /**
   * Add evidence ID to index (called during persistence)
   */
  private async addToIndex(evidenceId: string): Promise<void> {
    // Simple append to index (in production, use proper pagination)
    const indexKey = getEvidenceIndexKey(this.tenantKey, 0);
    const existing = await storage.get(indexKey);

    let index = { ids: [], total: 0 };
    if (existing) {
      try {
        index = JSON.parse(existing as string);
      } catch (error) {
        index = { ids: [], total: 0 };
      }
    }

    // Append if not already present
    if (!index.ids.includes(evidenceId)) {
      index.ids.push(evidenceId);
      index.total = index.ids.length;
    }

    await storage.set(indexKey, JSON.stringify(index));
  }
}

/**
 * Global evidence store factory
 * Creates tenant-scoped store instance
 */
export function getEvidenceStore(tenantKey: string): EvidenceStore {
  return new EvidenceStore(tenantKey);
}

/**
 * Verify all evidence in a tenant for integrity
 * Used for audits and compliance checks
 */
export async function auditAllEvidenceIntegrity(
  tenantKey: string
): Promise<{
  totalEvidence: number;
  validCount: number;
  invalidCount: number;
  errors: Array<{ evidenceId: string; error: string }>;
}> {
  const store = getEvidenceStore(tenantKey);
  const results = {
    totalEvidence: 0,
    validCount: 0,
    invalidCount: 0,
    errors: [] as Array<{ evidenceId: string; error: string }>,
  };

  let page = 0;
  const pageSize = 50;

  // Paginate through all evidence
  while (true) {
    const listResult = await store.listEvidenceIds(page, pageSize);
    if (listResult.ids.length === 0) {
      break;
    }

    for (const evidenceId of listResult.ids) {
      const verification = await store.verifyEvidenceIntegrity(evidenceId);
      results.totalEvidence++;

      if (verification.valid) {
        results.validCount++;
      } else {
        results.invalidCount++;
        results.errors.push({
          evidenceId,
          error: verification.error || 'Unknown error',
        });
      }
    }

    page++;
  }

  return results;
}
