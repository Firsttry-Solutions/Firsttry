/**
 * extractExportSnapshotId — Pure extraction helper (v7.48)
 *
 * Canonical snapshotId extraction for export requests.
 * Accepts args.snapshotId OR args.payload.snapshotId.
 * Rejects sentinels ("latest", "seed") and invalid prefixes.
 *
 * Module is deliberately dependency-free so it can be unit-tested without
 * mocking Forge/storage/api.
 */

export interface ExportSnapshotIdResult {
  snapshotId: string | null;
  source: 'top' | 'payload' | 'none';
  reasonCode?: string;
  message?: string;
}

export function extractExportSnapshotId(args: any): ExportSnapshotIdResult {
  const snapshotIdTop = typeof args?.snapshotId === 'string' ? args.snapshotId.trim() : null;
  const snapshotIdPayload = typeof args?.payload?.snapshotId === 'string' ? args.payload.snapshotId.trim() : null;
  const raw = snapshotIdTop || snapshotIdPayload;
  const source: 'top' | 'payload' | 'none' = snapshotIdTop ? 'top' : snapshotIdPayload ? 'payload' : 'none';

  // Empty after trim → missing
  if (!raw) {
    return { snapshotId: null, source: 'none', reasonCode: 'MISSING_SNAPSHOT_ID', message: 'Export requires snapshotId parameter' };
  }

  // Sentinel rejection
  if (raw === 'latest' || raw === 'seed') {
    return { snapshotId: null, source, reasonCode: 'SENTINEL_SNAPSHOT_ID', message: `Export rejected sentinel snapshotId: ${raw}` };
  }

  // Prefix validation
  if (!raw.startsWith('ft:snapshot:')) {
    return { snapshotId: null, source, reasonCode: 'INVALID_SNAPSHOT_ID', message: `Export rejected invalid snapshotId prefix: ${raw}` };
  }

  return { snapshotId: raw, source };
}
