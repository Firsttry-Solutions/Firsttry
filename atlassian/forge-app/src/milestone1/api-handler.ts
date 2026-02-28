/**
 * MILESTONE 1: API Routes Handler
 * 
 * Implements 7 routes:
 * - GET /snapshot/{id}
 * - GET /snapshot/{id}/access
 * - GET /snapshot/{id}/inventory
 * - GET /snapshot/{id}/dependency
 * - GET /snapshot/{id}/coverage
 * - GET /snapshot/{id}/privilege
 * - POST /snapshot/{id}/export
 * 
 * Response requirements:
 * - 404 if snapshot not found
 * - 409 if snapshot exists but any required derived object is missing
 * - All responses are deterministic canonical JSON
 */

import {
  getSnapshot,
  getAccessReport,
  getConfigInventory,
  getDependencyGraph,
  getCachedAuditCoverage,
  getCachedPrivilegeBoundary,
  checkSnapshotCompleteness,
} from './storage';
import { buildAuditCoverageReport } from './engines/audit-coverage-engine';
import { buildPrivilegeBoundaryDeclaration } from './engines/privilege-engine';
import { exportGovernancePack } from './engines/export-engine';
import { failClosed } from '../shared/failClosed';
import { canonicalJsonString } from './canonicalize';

/**
 * Parse route from request
 */
function parseRoute(path: string): {
  type: string;
  snapshotId: string;
  endpoint?: string;
} | null {
  // Paths like: /snapshot/{id}, /snapshot/{id}/access, /snapshot/{id}/export
  const match = path.match(/^\/snapshot\/([^/]+)(?:\/([^/]+))?$/);
  if (!match) return null;

  const snapshotId = match[1];
  const endpoint = match[2];

  return {
    type: 'snapshot',
    snapshotId,
    endpoint,
  };
}

/**
 * Response envelope
 */
function createResponse(
  status: number,
  data: any,
  error?: string
): { statusCode: number; body: string } {
  const body: any = {
    status: status >= 400 ? 'error' : 'success',
    data,
  };

  if (error) {
    body.error = error;
  }

  return {
    statusCode: status,
    body: JSON.stringify(body),
  };
}

/**
 * Handler for all snapshot routes
 */
export const snapshotHandler: any = async (req: any) => {
  try {
    const path = req.path || '/snapshot';
    const method = req.method || 'GET';

    const route = parseRoute(path);
    if (!route) {
      return createResponse(404, null, 'Route not found');
    }

    const { snapshotId, endpoint } = route;

    // Check snapshot completeness early
    const completeness = await checkSnapshotCompleteness(snapshotId);

    // GET /snapshot/{id}
    if (method === 'GET' && !endpoint) {
      const snapshot = await getSnapshot(snapshotId);
      if (!snapshot) {
        return createResponse(404, null, `Snapshot ${snapshotId} not found`);
      }

      if (!completeness.isComplete) {
        return createResponse(409, null, 'Snapshot incomplete - missing required derived objects');
      }

      return createResponse(200, snapshot);
    }

    // GET /snapshot/{id}/access
    if (method === 'GET' && endpoint === 'access') {
      if (!completeness.snapshotExists) {
        return createResponse(404, null, `Snapshot ${snapshotId} not found`);
      }

      if (!completeness.accessExists) {
        return createResponse(409, null, 'Access report not available');
      }

      const accessReport = await getAccessReport(snapshotId);
      if (!accessReport) {
        return createResponse(409, null, 'Access report incomplete');
      }

      return createResponse(200, accessReport);
    }

    // GET /snapshot/{id}/inventory
    if (method === 'GET' && endpoint === 'inventory') {
      if (!completeness.snapshotExists) {
        return createResponse(404, null, `Snapshot ${snapshotId} not found`);
      }

      if (!completeness.inventoryExists) {
        return createResponse(409, null, 'Configuration inventory not available');
      }

      const inventory = await getConfigInventory(snapshotId);
      if (!inventory) {
        return createResponse(409, null, 'Configuration inventory incomplete');
      }

      return createResponse(200, inventory);
    }

    // GET /snapshot/{id}/dependency
    if (method === 'GET' && endpoint === 'dependency') {
      if (!completeness.snapshotExists) {
        return createResponse(404, null, `Snapshot ${snapshotId} not found`);
      }

      if (!completeness.dependencyExists) {
        return createResponse(409, null, 'Dependency graph not available');
      }

      const dependencyGraph = await getDependencyGraph(snapshotId);
      if (!dependencyGraph) {
        return createResponse(409, null, 'Dependency graph incomplete');
      }

      return createResponse(200, dependencyGraph);
    }

    // GET /snapshot/{id}/coverage
    if (method === 'GET' && endpoint === 'coverage') {
      if (!completeness.snapshotExists) {
        return createResponse(404, null, `Snapshot ${snapshotId} not found`);
      }

      if (!completeness.auditCoverageDerivable) {
        return createResponse(409, null, 'Audit coverage cannot be derived');
      }

      // Try to get cached, otherwise derive
      let coverage = await getCachedAuditCoverage(snapshotId);
      if (!coverage) {
        const inventory = await getConfigInventory(snapshotId);
        const snapshot = await getSnapshot(snapshotId);
        if (!snapshot) {
          return createResponse(409, null, 'Cannot derive audit coverage');
        }

        coverage = await buildAuditCoverageReport(snapshotId, snapshot.createdAtUtc, inventory);
      }

      return createResponse(200, coverage);
    }

    // GET /snapshot/{id}/privilege
    if (method === 'GET' && endpoint === 'privilege') {
      if (!completeness.snapshotExists) {
        return createResponse(404, null, `Snapshot ${snapshotId} not found`);
      }

      if (!completeness.privilegeBoundaryDerivable) {
        return createResponse(409, null, 'Privilege boundary cannot be derived');
      }

      // Try to get cached, otherwise derive
      let boundary = await getCachedPrivilegeBoundary(snapshotId);
      if (!boundary) {
        const snapshot = await getSnapshot(snapshotId);
        if (!snapshot) {
          return createResponse(409, null, 'Cannot derive privilege boundary');
        }

        boundary = await buildPrivilegeBoundaryDeclaration(
          snapshotId,
          snapshot.createdAtUtc,
          snapshot
        );
      }

      return createResponse(200, boundary);
    }

    // POST /snapshot/{id}/export
    if (method === 'POST' && endpoint === 'export') {
      if (!completeness.snapshotExists) {
        return createResponse(404, null, `Snapshot ${snapshotId} not found`);
      }

      if (!completeness.isComplete) {
        return createResponse(409, null, 'Snapshot incomplete - cannot export');
      }

      const snapshot = await getSnapshot(snapshotId);
      const accessReport = await getAccessReport(snapshotId);
      const dependencyGraph = await getDependencyGraph(snapshotId);
      const auditCoverage = await getCachedAuditCoverage(snapshotId);
      const privilegeBoundary = await getCachedPrivilegeBoundary(snapshotId);

      if (!snapshot || !accessReport || !dependencyGraph || !auditCoverage || !privilegeBoundary) {
        return createResponse(409, null, 'Missing required data for export');
      }

      // TODO: Get platform features and export
      // For now, return placeholder response
      return createResponse(200, {
        message: 'Export functionality pending ZIP library integration',
        snapshotId,
      });
    }

    return createResponse(404, null, 'Endpoint not found');
  } catch (error) {
    console.error('[SnapshotHandler] Error:', error);
    throw failClosed('FT_API_HANDLER_FAILED', 'Snapshot API handler failed', error);
  }
};

/**
 * Forge Resolver wrapper (for use as a Forge function)
 */
export async function handler(props: any) {
  // Map Forge resolver input to HTTP-like request
  const request = {
    path: props.path || '/snapshot',
    method: props.method || 'GET',
  };

  const response = await snapshotHandler(request);
  return JSON.parse(response.body);
}
