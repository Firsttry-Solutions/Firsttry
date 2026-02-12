/**
 * MILESTONE 1: Data Models for Forge Storage
 * 
 * Entities stored under keys:
 * - snapshot:{id}
 * - access:{snapshotId}
 * - inventory:{snapshotId}
 * - dependency:{snapshotId}
 * 
 * Coverage, Privilege, Platform Features are derived deterministically
 * from snapshot and inventory, or cached alongside them.
 */

/**
 * Snapshot Model (stored under snapshot:{id})
 * 
 * This is the root object. All other entities are derived from it.
 */
export interface Snapshot {
  id: string; // Unique identifier
  siteId: string; // Jira Cloud site ID
  createdAtUtc: string; // ISO8601 UTC timestamp (set once, reused)
  canonicalHash: string; // SHA256 hash (computed without this field)
  buildShaShort: string; // Git commit SHA (short form)
  buildUtc: string; // Build timestamp (UTC ISO8601)
  schemaVersion: string; // MUST be "1.0.0" for Milestone 1
  privilegeContext: {
    jiraAdmin: boolean;
    orgAdmin: boolean;
    availableScopes: string[];
  };
  platformFeatureFlags: {
    fieldSchemeModel: 'LEGACY' | 'NEW';
    detectedAtUtc: string; // Must equal snapshot.createdAtUtc
  };
  data: {
    projectCount: number;
    issueCount: number;
    // ... other metadata from Jira
  };
}

/**
 * Access Report Model (stored under access:{snapshotId})
 * 
 * Output of Effective Access Engine
 */
export interface AccessReport {
  snapshotId: string;
  createdAtUtc: string; // Must match snapshot.createdAtUtc
  access: Array<{
    subjectType: 'USER' | 'GROUP' | 'PROJECT';
    subjectId: string;
    permissions: Array<{
      permission: string; // e.g., "BROWSE_PROJECTS"
      granted: boolean;
      source: Array<{
        viaGroup: string; // Empty string if not applicable
        viaRole: string; // Empty string if not applicable
        viaScheme: string; // Empty string if not applicable
      }>;
    }>;
  }>;
}

/**
 * Configuration Inventory Index (stored under inventory:{snapshotId})
 * 
 * Full inventory of Jira configuration state
 */
export interface ConfigInventory {
  snapshotId: string;
  createdAtUtc: string; // Must match snapshot.createdAtUtc
  configInventory: {
    globalPermissions: Array<{
      id: string;
      key: string;
      name: string;
    }>;
    schemes: Array<{
      id: string;
      name: string;
      type: string; // 'permission', 'workflow', 'screen', 'field'
    }>;
    projects: Array<{
      id: string;
      key: string;
      name: string;
      permissionSchemeId?: string;
      workflowSchemeId?: string;
    }>;
    roles: Array<{
      id: string;
      name: string;
    }>;
  };
}

/**
 * Dependency Graph (stored under dependency:{snapshotId})
 * 
 * Nodes and edges representing configuration dependencies
 */
export interface DependencyGraph {
  snapshotId: string;
  createdAtUtc: string; // Must match snapshot.createdAtUtc
  dependencyGraph: {
    nodes: Array<{
      type: string;
      id: string;
      label: string;
    }>;
    edges: Array<{
      source: string;
      target: string;
      type: string;
    }>;
  };
}

/**
 * Audit Coverage Report (derived from snapshot + inventory)
 * 
 * Disclosure of what Jira audit covers vs what FirstTry covers
 */
export interface AuditCoverage {
  snapshotId: string;
  createdAtUtc: string; // Must match snapshot.createdAtUtc
  auditCoverage: {
    jiraAuditCovers: string[]; // Activities Jira audit logs capture
    jiraAuditDoesNotCover: string[]; // Activities NOT captured
    firstTryCovers: string[]; // Configuration state metrics FirstTry captures
    disclaimers: string[]; // Explicit statements about audit coverage
  };
}

/**
 * Privilege Boundary Declaration (derived from snapshot)
 * 
 * Declares what this snapshot can and cannot access
 */
export interface PrivilegeBoundary {
  snapshotId: string;
  createdAtUtc: string; // Must match snapshot.createdAtUtc
  privilegeBoundary: {
    jiraAdmin: boolean;
    orgAdmin: boolean;
    accessibleScopes: string[];
    inaccessibleScopes: string[];
  };
}

/**
 * Platform Feature Detection output (merged into snapshot.platformFeatureFlags)
 * 
 * Captures feature flags for this Jira instance
 */
export interface PlatformFeatures {
  snapshotId: string;
  createdAtUtc: string; // Must match snapshot.createdAtUtc
  platformFeatures: {
    fieldSchemeModel: 'LEGACY' | 'NEW';
    detectedAtUtc: string; // Must equal snapshot.createdAtUtc
  };
}

/**
 * Export Pack Manifest (included in ZIP as manifest.json)
 * 
 * Lists all files and their SHA256 hashes
 */
export interface ExportManifest {
  schemaVersion: string; // "1.0.0"
  snapshotId: string;
  siteId: string;
  createdAtUtc: string;
  buildShaShort: string;
  buildUtc: string;
  files: Array<{
    path: string; // Must be sorted lexicographically
    sha256: string;
  }>;
}

/**
 * Completion Check
 * 
 * A snapshot is "complete" if all required derived objects exist.
 * If any is missing, endpoints should return 409 Conflict.
 */
export interface SnapshotCompleteness {
  snapshotExists: boolean;
  accessExists: boolean;
  inventoryExists: boolean;
  dependencyExists: boolean;
  auditCoverageDerivable: boolean;
  privilegeBoundaryDerivable: boolean;
  platformFeaturesDerivable: boolean;
  isComplete: boolean;
}
