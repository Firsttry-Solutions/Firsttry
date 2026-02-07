/**
 * SNAPSHOT STATUS (PART 2: FAIL-CLOSED STATUS TRACKING)
 * 
 * Status is computed from actual fetch outcomes, never assumed.
 * - COMPLETE: All required fetches succeeded
 * - PARTIAL: At least one required fetch failed
 * - FAILED: All fetches failed or no valid snapshot
 */

export enum SnapshotStatus {
  COMPLETE = 'COMPLETE',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
}

export interface RequiredFetchResult {
  datasetName: string;
  succeeded: boolean;
  errorMessage?: string;
  httpStatus?: number;
}

export interface SnapshotMetadata {
  snapshotId: string;
  createdAtUtc: string;
  snapshotVersion: string;
  status: SnapshotStatus;
  contentHash?: string;
  fetchResults: RequiredFetchResult[];
  totalRequiredFetches: number;
  successfulFetches: number;
  failedFetches: number;
}

export class ImmutabilityViolationError extends Error {
  constructor(snapshotId: string) {
    super(`IMMUTABILITY VIOLATION: Attempted to overwrite existing snapshot ${snapshotId}`);
    this.name = 'ImmutabilityViolationError';
  }
}

export class StatusComputationError extends Error {
  constructor(reason: string) {
    super(`STATUS COMPUTATION ERROR: ${reason}`);
    this.name = 'StatusComputationError';
  }
}

/**
 * Compute snapshot status from fetch results (fail-closed)
 */
export function computeSnapshotStatus(fetchResults: RequiredFetchResult[]): SnapshotStatus {
  if (!fetchResults || fetchResults.length === 0) {
    throw new StatusComputationError('No fetch results provided');
  }
  
  const succeeded = fetchResults.filter(f => f.succeeded).length;
  const failed = fetchResults.filter(f => !f.succeeded).length;
  
  if (succeeded === fetchResults.length) {
    return SnapshotStatus.COMPLETE;
  }
  
  if (failed === fetchResults.length) {
    return SnapshotStatus.FAILED;
  }
  
  return SnapshotStatus.PARTIAL;
}

/**
 * Validate snapshot has required integrity fields
 */
export function validateSnapshotIntegrity(
  metadata: Pick<SnapshotMetadata, 'snapshotId' | 'createdAtUtc' | 'status' | 'fetchResults'>
): void {
  if (!metadata) {
    throw new StatusComputationError('Snapshot metadata is null or undefined');
  }
  
  if (!metadata.snapshotId) {
    throw new StatusComputationError('Snapshot must have snapshotId');
  }
  
  if (!metadata.createdAtUtc) {
    throw new StatusComputationError('Snapshot must have createdAtUtc');
  }
  
  if (!metadata.status) {
    throw new StatusComputationError('Snapshot must have status');
  }
  
  const validStatuses = [SnapshotStatus.COMPLETE, SnapshotStatus.PARTIAL, SnapshotStatus.FAILED];
  if (!validStatuses.includes(metadata.status)) {
    throw new StatusComputationError(`Invalid status: ${metadata.status}`);
  }
  
  if (!metadata.fetchResults || metadata.fetchResults.length === 0) {
    throw new StatusComputationError('Snapshot must have fetchResults');
  }
}
