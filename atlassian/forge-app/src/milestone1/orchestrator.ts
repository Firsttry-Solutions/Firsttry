/**
 * MILESTONE 1: Snapshot Orchestrator
 * 
 * Coordinates all engines to build a complete snapshot with all derived objects.
 * 
 * Workflow:
 * 1. Create snapshot with metadata
 * 2. Detect platform features
 * 3. Build access report
 * 4. Build configuration inventory
 * 5. Build dependency graph
 * 6. Derive audit coverage
 * 7. Derive privilege boundary
 * 8. Store all entities
 */

import api from '@forge/api';
// @ts-ignore route() is exported from @forge/api but TS definitions may lag
const { route } = require('@forge/api') as typeof import('@forge/api');
import type { Snapshot, AccessReport, ConfigInventory } from './models';
import { Clock, SystemClock } from '../shared/clock';
import { computeCanonicalHash, canonicalJsonString } from './canonicalize';
import { BACKEND_BUILD_SHA } from '../build/backend_build';
import { BACKEND_BUILD_TIME_UTC } from '../build/buildIdentityBackend.gen';
import {
  storeSnapshot,
  storeAccessReport,
  storeConfigInventory,
  storeDependencyGraph,
  checkSnapshotCompleteness,
  cacheAuditCoverage,
  cachePrivilegeBoundary,
} from './storage';
import { buildAccessReport, validateAccessReport } from './engines/access-engine';
import { buildConfigInventory, validateConfigInventory } from './engines/inventory-engine';
import { buildDependencyGraph, validateDependencyGraph } from './engines/dependency-engine';
import { buildAuditCoverageReport, validateAuditCoverageReport } from './engines/audit-coverage-engine';
import { buildPrivilegeBoundaryDeclaration, validatePrivilegeBoundary } from './engines/privilege-engine';
import { buildPlatformFeaturesReport, extractPlatformFeatureFlags, validatePlatformFeaturesReport } from './engines/platform-features-engine';

/**
 * Get build metadata (buildShaShort, buildUtc)
 * 
 * These are injected at build time or fetched from app metadata
 */
function getBuildMetadata(clock: Clock): {
  buildShaShort: string;
  buildUtc: string;
} {
  // Use the injected build SHA from backend_build.ts (populated by build system)
  const buildShaShort = BACKEND_BUILD_SHA.substring(0, 12) || 'dev00000';
  const buildUtc = BACKEND_BUILD_TIME_UTC || clock.nowISO();

  return { buildShaShort, buildUtc };
}

/**
 * Get Jira site ID from runtime context
 */
async function getJiraSiteId(): Promise<string> {
  try {
    const myself = await api
      .asUser()
      .requestJira(route`/rest/api/3/myself`);
    
    // Jira site ID is typically extracted from the API base URL
    // For now, return a placeholder
    return myself.accountId || 'unknown-site';
  } catch (error) {
    throw failClosed('FT_ORCHESTRATOR_SITE_ID_FAILED', 'Cannot get Jira site ID', error);
  }
}

/**
 * Determine privilege context from runtime
 */
async function determinePrivilegeContext(): Promise<Snapshot['privilegeContext']> {
  try {
    const myself = await api
      .asUser()
      .requestJira(route`/rest/api/3/myself`);

    return {
      jiraAdmin: myself.isAdmin === true,
      orgAdmin: false, // Would require org API
      availableScopes: ['read:jira-work', 'storage:app'],
    };
  } catch (error) {
    throw failClosed('FT_ORCHESTRATOR_PRIVILEGE_CONTEXT_FAILED', 'Cannot determine privilege context', error);
  }
}

/**
 * Build complete snapshot with all derived objects
 * 
 * Returns { success: boolean, snapshotId?: string, errors?: string[] }
 * @param snapshotId - Optional snapshot ID (defaults to deterministic hash-based ID)
 * @param clock - Clock for timestamps (use FixedClock for deterministic builds)
 */
export async function buildCompleteSnapshot(snapshotId?: string, clock: Clock = SystemClock): Promise<{
  success: boolean;
  snapshotId?: string;
  completeness?: any;
  errors?: string[];
}> {
  const errors: string[] = [];

  try {
    // Generate snapshot ID deterministically if not provided (use hash of timestamp + siteId)
    // For now, use timestamp-based ID but make it deterministic via injected clock
    const nowISO = clock.nowISO();
    const finalSnapshotId = snapshotId || `snapshot-${nowISO.replace(/[-:.TZ]/g, '')}`;

    // Create snapshot with timestamp (set once, reused)
    const createdAtUtc = nowISO;
    const { buildShaShort, buildUtc } = getBuildMetadata(clock);
    const siteId = await getJiraSiteId();
    const privilegeContext = await determinePrivilegeContext();

    // Build platform features first (needed for platformFeatureFlags)
    console.log('[Orchestrator] Building platform features...');
    const platformFeaturesReport = await buildPlatformFeaturesReport(
      finalSnapshotId,
      createdAtUtc
    );
    
    if (!validatePlatformFeaturesReport(platformFeaturesReport)) {
      errors.push('Platform features report validation failed');
    }

    const platformFeatureFlags = extractPlatformFeatureFlags(platformFeaturesReport);

    // Create snapshot object (without canonicalHash yet)
    const snapshotWithoutHash: any = {
      id: finalSnapshotId,
      siteId,
      createdAtUtc,
      buildShaShort,
      buildUtc,
      schemaVersion: '1.0.0',
      privilegeContext,
      platformFeatureFlags,
      data: {
        projectCount: 0,
        issueCount: 0,
      },
    };

    // Compute canonical hash (without the canonicalHash field itself)
    const snapshot: Snapshot = {
      ...snapshotWithoutHash,
      canonicalHash: computeCanonicalHash(snapshotWithoutHash),
    };

    console.log('[Orchestrator] Storing snapshot...');
    const snapshotStoreResult = await storeSnapshot(snapshot);
    if (!snapshotStoreResult.success) {
      errors.push(`Failed to store snapshot: ${snapshotStoreResult.error}`);
    }

    // Build access report
    console.log('[Orchestrator] Building access report...');
    const accessReport = await buildAccessReport(finalSnapshotId, createdAtUtc, siteId);
    if (!validateAccessReport(accessReport)) {
      errors.push('Access report validation failed');
    }

    const accessStoreResult = await storeAccessReport(finalSnapshotId, accessReport);
    if (!accessStoreResult.success) {
      errors.push(`Failed to store access report: ${accessStoreResult.error}`);
    }

    // Build configuration inventory
    console.log('[Orchestrator] Building configuration inventory...');
    const configInventory = await buildConfigInventory(finalSnapshotId, createdAtUtc);
    if (!validateConfigInventory(configInventory)) {
      errors.push('Configuration inventory validation failed');
    }

    const inventoryStoreResult = await storeConfigInventory(finalSnapshotId, configInventory);
    if (!inventoryStoreResult.success) {
      errors.push(`Failed to store configuration inventory: ${inventoryStoreResult.error}`);
    }

    // Build dependency graph
    console.log('[Orchestrator] Building dependency graph...');
    const dependencyGraph = await buildDependencyGraph(finalSnapshotId, createdAtUtc);
    if (!validateDependencyGraph(dependencyGraph)) {
      errors.push('Dependency graph validation failed');
    }

    const dependencyStoreResult = await storeDependencyGraph(finalSnapshotId, dependencyGraph);
    if (!dependencyStoreResult.success) {
      errors.push(`Failed to store dependency graph: ${dependencyStoreResult.error}`);
    }

    // Build audit coverage (derived from snapshot + inventory)
    console.log('[Orchestrator] Building audit coverage report...');
    const auditCoverage = await buildAuditCoverageReport(
      finalSnapshotId,
      createdAtUtc,
      configInventory
    );
    if (!validateAuditCoverageReport(auditCoverage)) {
      errors.push('Audit coverage report validation failed');
    }

    await cacheAuditCoverage(finalSnapshotId, auditCoverage);

    // Build privilege boundary (derived from snapshot)
    console.log('[Orchestrator] Building privilege boundary...');
    const privilegeBoundary = await buildPrivilegeBoundaryDeclaration(
      finalSnapshotId,
      createdAtUtc,
      snapshot
    );
    if (!validatePrivilegeBoundary(privilegeBoundary)) {
      errors.push('Privilege boundary validation failed');
    }

    await cachePrivilegeBoundary(finalSnapshotId, privilegeBoundary);

    // Check completeness
    const completeness = await checkSnapshotCompleteness(finalSnapshotId);

    if (!completeness.isComplete) {
      errors.push('Snapshot is not complete - missing required derived objects');
    }

    return {
      success: errors.length === 0 && completeness.isComplete,
      snapshotId: finalSnapshotId,
      completeness,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    throw failClosed('FT_ORCHESTRATOR_SNAPSHOT_BUILD_FAILED', 'Cannot build complete snapshot', error);
  }
}
