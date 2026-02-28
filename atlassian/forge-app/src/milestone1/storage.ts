/**
 * MILESTONE 1: Forge Storage Layer with NO OVERWRITE Rule
 * 
 * Uses @forge/storage Entity API
 * Key pattern:
 * - snapshot:{id}
 * - access:{snapshotId}
 * - inventory:{snapshotId}
 * - dependency:{snapshotId}
 * 
 * Write behavior: 409 Conflict if key already exists
 * AUDIT: Phase05 remediation - keys must be deterministic + tenant-bound
 */

import { storage } from '@forge/api';
import { failClosed } from '../shared/failClosed';
import { makeStorageKey } from '../shared/storageKey';
import type {
  Snapshot,
  AccessReport,
  ConfigInventory,
  DependencyGraph,
  AuditCoverage,
  PrivilegeBoundary,
  PlatformFeatures,
  SnapshotCompleteness,
} from './models';

/**
 * Store snapshot (no overwrite)
 * Returns 409 if already exists
 * AUDIT: Phase05 remediation - keys must be deterministic + tenant-bound
 */
export async function storeSnapshot(snapshot: Snapshot): Promise<{ success: boolean; error?: string }> {
  const key = makeStorageKey(snapshot.siteId, "milestone1_snapshot", snapshot.id);
  
  try {
    // Check if exists
    const existing = await storage.get(key);
    if (existing) {
      return { success: false, error: `409: Snapshot ${snapshot.id} already exists` };
    }
    
    // Store
    await storage.set(key, snapshot);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Retrieve snapshot
 * AUDIT: Phase05 remediation - keys must be deterministic + tenant-bound
 */
export async function getSnapshot(siteId: string, snapshotId: string): Promise<Snapshot | null> {
  const key = makeStorageKey(siteId, "milestone1_snapshot", snapshotId);
  try {
    const data = await storage.get(key);
    return (data as Snapshot) || null;
  } catch (error) {
    throw failClosed('FT_STORAGE_READ_FAILED', `Cannot retrieve snapshot ${snapshotId}`, error);
  }
}

/**
 * Store access report (no overwrite)
 * AUDIT: Phase05 remediation - keys must be deterministic + tenant-bound
 */
export async function storeAccessReport(
  siteId: string,
  snapshotId: string,
  report: AccessReport
): Promise<{ success: boolean; error?: string }> {
  const key = makeStorageKey(siteId, "milestone1_access", snapshotId);
  
  try {
    const existing = await storage.get(key);
    if (existing) {
      return { success: false, error: `409: Access report for ${snapshotId} already exists` };
    }
    
    await storage.set(key, report);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Retrieve access report
 * AUDIT: Phase05 remediation - keys must be deterministic + tenant-bound
 */
export async function getAccessReport(siteId: string, snapshotId: string): Promise<AccessReport | null> {
  const key = makeStorageKey(siteId, "milestone1_access", snapshotId);
  try {
    const data = await storage.get(key);
    return (data as AccessReport) || null;
  } catch (error) {
    throw failClosed('FT_STORAGE_READ_FAILED', `Cannot retrieve access report for snapshot ${snapshotId}`, error);
  }
}

/**
 * Store configuration inventory (no overwrite)
 * AUDIT: Phase05 remediation - keys must be deterministic + tenant-bound
 */
export async function storeConfigInventory(
  siteId: string,
  snapshotId: string,
  inventory: ConfigInventory
): Promise<{ success: boolean; error?: string }> {
  const key = makeStorageKey(siteId, "milestone1_inventory", snapshotId);
  
  try {
    const existing = await storage.get(key);
    if (existing) {
      return { success: false, error: `409: Inventory for ${snapshotId} already exists` };
    }
    
    await storage.set(key, inventory);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Retrieve configuration inventory
 * AUDIT: Phase05 remediation - keys must be deterministic + tenant-bound
 */
export async function getConfigInventory(siteId: string, snapshotId: string): Promise<ConfigInventory | null> {
  const key = makeStorageKey(siteId, "milestone1_inventory", snapshotId);
  try {
    const data = await storage.get(key);
    return (data as ConfigInventory) || null;
  } catch (error) {
    throw failClosed('FT_STORAGE_READ_FAILED', `Cannot retrieve config inventory for snapshot ${snapshotId}`, error);
  }
}

/**
 * Store dependency graph (no overwrite)
 * AUDIT: Phase05 remediation - keys must be deterministic + tenant-bound
 */
export async function storeDependencyGraph(
  siteId: string,
  snapshotId: string,
  graph: DependencyGraph
): Promise<{ success: boolean; error?: string }> {
  const key = makeStorageKey(siteId, "milestone1_dependency", snapshotId);
  
  try {
    const existing = await storage.get(key);
    if (existing) {
      return { success: false, error: `409: Dependency graph for ${snapshotId} already exists` };
    }
    
    await storage.set(key, graph);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Retrieve dependency graph
 * AUDIT: Phase05 remediation - keys must be deterministic + tenant-bound
 */
export async function getDependencyGraph(siteId: string, snapshotId: string): Promise<DependencyGraph | null> {
  const key = makeStorageKey(siteId, "milestone1_dependency", snapshotId);
  try {
    const data = await storage.get(key);
    return (data as DependencyGraph) || null;
  } catch (error) {
    throw failClosed('FT_STORAGE_READ_FAILED', `Cannot retrieve dependency graph for snapshot ${snapshotId}`, error);
  }
}

/**
 * Cache audit coverage (optional, can be derived)
 * AUDIT: Phase05 remediation - keys must be deterministic + tenant-bound
 */
export async function cacheAuditCoverage(
  siteId: string,
  snapshotId: string,
  coverage: AuditCoverage
): Promise<void> {
  const key = makeStorageKey(siteId, "milestone1_coverage", snapshotId);
  try {
    await storage.set(key, coverage);
  } catch (error) {
    throw failClosed('FT_STORAGE_WRITE_FAILED', `Cannot cache audit coverage for snapshot ${snapshotId}`, error);
  }
}

export async function getCachedAuditCoverage(siteId: string, snapshotId: string): Promise<AuditCoverage | null> {
  const key = makeStorageKey(siteId, "milestone1_coverage", snapshotId);
  try {
    const data = await storage.get(key);
    return (data as AuditCoverage) || null;
  } catch (error) {
    throw failClosed('FT_STORAGE_READ_FAILED', `Cannot retrieve cached audit coverage for snapshot ${snapshotId}`, error);
  }
}

/**
 * Cache privilege boundary (optional, can be derived)
 * AUDIT: Phase05 remediation - keys must be deterministic + tenant-bound
 */
export async function cachePrivilegeBoundary(
  siteId: string,
  snapshotId: string,
  boundary: PrivilegeBoundary
): Promise<void> {
  const key = makeStorageKey(siteId, "milestone1_privilege", snapshotId);
  try {
    await storage.set(key, boundary);
  } catch (error) {
    throw failClosed('FT_STORAGE_WRITE_FAILED', `Cannot cache privilege boundary for snapshot ${snapshotId}`, error);
  }
}

export async function getCachedPrivilegeBoundary(siteId: string, snapshotId: string): Promise<PrivilegeBoundary | null> {
  const key = makeStorageKey(siteId, "milestone1_privilege", snapshotId);
  try {
    const data = await storage.get(key);
    return (data as PrivilegeBoundary) || null;
  } catch (error) {
    throw failClosed('FT_STORAGE_READ_FAILED', `Cannot retrieve cached privilege boundary for snapshot ${snapshotId}`, error);
  }
}

/**
 * Check snapshot completeness
 * AUDIT: Phase05 remediation - keys must be deterministic + tenant-bound
 */
export async function checkSnapshotCompleteness(siteId: string, snapshotId: string): Promise<SnapshotCompleteness> {
  const [snapshot, access, inventory, dependency] = await Promise.all([
    getSnapshot(siteId, snapshotId),
    getAccessReport(siteId, snapshotId),
    getConfigInventory(siteId, snapshotId),
    getDependencyGraph(siteId, snapshotId),
  ]);

  const isComplete =
    snapshot !== null &&
    access !== null &&
    inventory !== null &&
    dependency !== null;

  return {
    snapshotExists: snapshot !== null,
    accessExists: access !== null,
    inventoryExists: inventory !== null,
    dependencyExists: dependency !== null,
    auditCoverageDerivable: snapshot !== null && inventory !== null,
    privilegeBoundaryDerivable: snapshot !== null,
    platformFeaturesDerivable: snapshot !== null,
    isComplete,
  };
}
