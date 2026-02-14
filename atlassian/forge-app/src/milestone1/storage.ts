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
 */

import { storage } from '@forge/api';
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
 */
export async function storeSnapshot(snapshot: Snapshot): Promise<{ success: boolean; error?: string }> {
  const key = `snapshot:${snapshot.id}`;
  
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
 */
export async function getSnapshot(snapshotId: string): Promise<Snapshot | null> {
  const key = `snapshot:${snapshotId}`;
  try {
    const data = await storage.get(key);
    return (data as Snapshot) || null;
  } catch (error) {
    console.error(`[Storage] Error retrieving snapshot ${snapshotId}:`, error);
    return null;
  }
}

/**
 * Store access report (no overwrite)
 */
export async function storeAccessReport(
  snapshotId: string,
  report: AccessReport
): Promise<{ success: boolean; error?: string }> {
  const key = `access:${snapshotId}`;
  
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
 */
export async function getAccessReport(snapshotId: string): Promise<AccessReport | null> {
  const key = `access:${snapshotId}`;
  try {
    const data = await storage.get(key);
    return (data as AccessReport) || null;
  } catch (error) {
    console.error(`[Storage] Error retrieving access report for ${snapshotId}:`, error);
    return null;
  }
}

/**
 * Store configuration inventory (no overwrite)
 */
export async function storeConfigInventory(
  snapshotId: string,
  inventory: ConfigInventory
): Promise<{ success: boolean; error?: string }> {
  const key = `inventory:${snapshotId}`;
  
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
 */
export async function getConfigInventory(snapshotId: string): Promise<ConfigInventory | null> {
  const key = `inventory:${snapshotId}`;
  try {
    const data = await storage.get(key);
    return (data as ConfigInventory) || null;
  } catch (error) {
    console.error(`[Storage] Error retrieving inventory for ${snapshotId}:`, error);
    return null;
  }
}

/**
 * Store dependency graph (no overwrite)
 */
export async function storeDependencyGraph(
  snapshotId: string,
  graph: DependencyGraph
): Promise<{ success: boolean; error?: string }> {
  const key = `dependency:${snapshotId}`;
  
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
 */
export async function getDependencyGraph(snapshotId: string): Promise<DependencyGraph | null> {
  const key = `dependency:${snapshotId}`;
  try {
    const data = await storage.get(key);
    return (data as DependencyGraph) || null;
  } catch (error) {
    console.error(`[Storage] Error retrieving dependency graph for ${snapshotId}:`, error);
    return null;
  }
}

/**
 * Cache audit coverage (optional, can be derived)
 */
export async function cacheAuditCoverage(
  snapshotId: string,
  coverage: AuditCoverage
): Promise<void> {
  const key = `coverage:${snapshotId}`;
  try {
    await storage.set(key, coverage);
  } catch (error) {
    console.error(`[Storage] Error caching audit coverage for ${snapshotId}:`, error);
  }
}

export async function getCachedAuditCoverage(snapshotId: string): Promise<AuditCoverage | null> {
  const key = `coverage:${snapshotId}`;
  try {
    const data = await storage.get(key);
    return (data as AuditCoverage) || null;
  } catch (error) {
    console.error(`[Storage] Error retrieving cached audit coverage for ${snapshotId}:`, error);
    return null;
  }
}

/**
 * Cache privilege boundary (optional, can be derived)
 */
export async function cachePrivilegeBoundary(
  snapshotId: string,
  boundary: PrivilegeBoundary
): Promise<void> {
  const key = `privilege:${snapshotId}`;
  try {
    await storage.set(key, boundary);
  } catch (error) {
    console.error(`[Storage] Error caching privilege boundary for ${snapshotId}:`, error);
  }
}

export async function getCachedPrivilegeBoundary(snapshotId: string): Promise<PrivilegeBoundary | null> {
  const key = `privilege:${snapshotId}`;
  try {
    const data = await storage.get(key);
    return (data as PrivilegeBoundary) || null;
  } catch (error) {
    console.error(`[Storage] Error retrieving cached privilege boundary for ${snapshotId}:`, error);
    return null;
  }
}

/**
 * Check snapshot completeness
 */
export async function checkSnapshotCompleteness(snapshotId: string): Promise<SnapshotCompleteness> {
  const [snapshot, access, inventory, dependency] = await Promise.all([
    getSnapshot(snapshotId),
    getAccessReport(snapshotId),
    getConfigInventory(snapshotId),
    getDependencyGraph(snapshotId),
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
