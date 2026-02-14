/**
 * MILESTONE 1: Master Index & Type Export
 * 
 * This file re-exports all public types and interfaces for convenient importing
 */

// Canonical serialization & hashing
export {
  sha256Hex,
  canonicalJsonString,
  computeCanonicalHash,
  canonicalJsonPretty,
  canonicalFingerprint,
  canonicalizeValue,
} from './canonicalize';

// Data models
export type {
  Snapshot,
  AccessReport,
  ConfigInventory,
  DependencyGraph,
  AuditCoverage,
  PrivilegeBoundary,
  PlatformFeatures,
  ExportManifest,
  SnapshotCompleteness,
} from './models';

// Storage layer
export {
  storeSnapshot,
  getSnapshot,
  storeAccessReport,
  getAccessReport,
  storeConfigInventory,
  getConfigInventory,
  storeDependencyGraph,
  getDependencyGraph,
  cacheAuditCoverage,
  getCachedAuditCoverage,
  cachePrivilegeBoundary,
  getCachedPrivilegeBoundary,
  checkSnapshotCompleteness,
} from './storage';

// Engines
export {
  buildAccessReport,
  validateAccessReport,
} from './engines/access-engine';

export {
  buildConfigInventory,
  validateConfigInventory,
} from './engines/inventory-engine';

export {
  buildDependencyGraph,
  validateDependencyGraph,
} from './engines/dependency-engine';

export {
  buildAuditCoverageReport,
  validateAuditCoverageReport,
} from './engines/audit-coverage-engine';

export {
  buildPrivilegeBoundaryDeclaration,
  validatePrivilegeBoundary,
} from './engines/privilege-engine';

export {
  buildPlatformFeaturesReport,
  extractPlatformFeatureFlags,
  validatePlatformFeaturesReport,
} from './engines/platform-features-engine';

export {
  exportGovernancePack,
  validateExportManifest,
} from './engines/export-engine';

// Orchestrator
export { buildCompleteSnapshot } from './orchestrator';

// API Handler
export { snapshotHandler, handler } from './api-handler';
