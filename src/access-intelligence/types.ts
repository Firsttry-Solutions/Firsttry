/**
 * Access Intelligence Engine - Type Definitions
 * PHASE 1: Deterministic Governance Snapshot Structure
 * 
 * All exports use canonical JSON serialization with:
 * - Stable key ordering (alphabetically sorted)
 * - SHA-256 hashing
 * - Fail-closed validation
 */

export interface ToxicFinding {
  ruleId: string;
  severity: 'low' | 'medium' | 'high';
  impactedEntities: string[];
  explanation: string;
}

export interface AccessSurfaceSnapshot {
  schemaVersion: '1.0';
  buildShaShort: string;
  buildUtc: string;
  siteId: string;
  privilegeContext: 'read-only';
  ruleSetVersion: '1.0';

  totals: {
    totalUsers: number;
    activeUsers: number;
    externalUsers: number;
  };

  exposure: {
    globalAdmins: string[];
    projectAdmins: Record<string, string[]>;
    publicProjects: string[];
    externalElevatedUsers: string[];
  };

  toxicFindings: ToxicFinding[];

  riskModel: {
    adminDensity: number;
    externalExposureScore: number;
    toxicHitCount: number;
    publicProjectCount: number;
    finalRiskScore: number;
  };

  canonicalHash: string;
}

export interface AccessIntelligenceError {
  status: 'FAILED';
  reason: string;
  noExportGenerated: true;
}

export interface AccessIntelligenceResult {
  snapshot: AccessSurfaceSnapshot;
  success: true;
}

export type ScanResult = AccessIntelligenceResult | AccessIntelligenceError;

export interface PaginationState {
  startAt: number;
  maxResults: number;
  isLast: boolean;
  total: number;
}

export interface User {
  accountId: string;
  emailAddress?: string;
  displayName: string;
  active: boolean;
  timeZone?: string;
}

export interface Project {
  key: string;
  id: string;
  name: string;
  isPrivate: boolean;
}

export interface PermissionScheme {
  id: string;
  name: string;
  description?: string;
}

export interface PermissionGrant {
  id: string;
  permission: string;
  holder: {
    type: string;
    parameter?: string;
  };
}
