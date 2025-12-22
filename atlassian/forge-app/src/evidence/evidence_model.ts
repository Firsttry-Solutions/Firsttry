/**
 * PHASE P4: EVIDENCE MODEL (Canonical, Minimal, Immutable)
 * 
 * Defines the structure and contracts for forensic-grade evidence bundles.
 * 
 * Principles:
 * - Canonical: Fixed field order, deterministic serialization
 * - Minimal: Only what's needed to explain and regenerate outputs
 * - Immutable: No modifications after creation
 * - Tenant-scoped: All evidence isolated by tenant
 * - Retention-controlled: TTL and auto-deletion enforced
 */

import { OutputTruthMetadata } from '../output/output_contract';

/**
 * Evidence schema version (literal string)
 * Must be updated when structure changes significantly
 */
export const EVIDENCE_SCHEMA_VERSION = '1.0.0' as const;
export type EvidenceSchemaVersion = typeof EVIDENCE_SCHEMA_VERSION;

/**
 * Snapshot reference with hash binding
 * Used to prove that evidence was computed from specific snapshot(s)
 */
export interface SnapshotRef {
  snapshotId: string;        // UUID of snapshot used
  snapshotHash: string;      // SHA256 hash of snapshot payload
  snapshotType: 'daily' | 'weekly' | 'manual';
  capturedAtISO: string;     // ISO 8601 when snapshot was captured
}

/**
 * Drift state at generation time
 * Captures what drift had been computed/detected at the time
 */
export interface DriftStateSnapshot {
  driftDetectedCount: number;
  lastDriftComputeISO?: string;
  driftStatusSummary: 'unknown' | 'stable' | 'detected';
}

/**
 * Normalized input facts (canonical form only)
 * Minimal representation of what was fed into output generation
 */
export interface NormalizedInputs {
  tenantKey: string;
  cloudId: string;
  reportGenerationTrigger?: 'MANUAL' | 'AUTO_12H' | 'AUTO_24H';
  observationWindowDays?: number;
  rulesetVersionUsed: string;
  computedAtISO: string;
}

/**
 * Explicit missing data disclosure
 * Lists what was intentionally not included and why
 */
export interface MissingDataDisclosure {
  datasetName: string;
  reasonCode: string;
  description: string;
}

/**
 * Environment facts at evidence generation time
 * Captures schema versions and feature invariants
 */
export interface EnvironmentFacts {
  outputSchemaVersion: string;
  truthRulesetVersion: string;
  evidenceSchemaVersion: EvidenceSchemaVersion;
  driftDetectionEnabled: boolean;
  snapshotLedgerEnabled: boolean;
}

/**
 * EVIDENCE BUNDLE (Core P4 Structure)
 * 
 * A complete, canonical representation of all information needed to:
 * - Explain why an output was produced
 * - Regenerate its OutputTruthMetadata deterministically
 * - Prove that no modifications have occurred
 * - Understand what was missing at the time
 */
export interface EvidenceBundle {
  // ===== Identity =====
  evidenceId: string;                    // UUID, unique per evidence
  schemaVersion: EvidenceSchemaVersion;  // Locked at creation time
  
  // ===== Tenant Isolation =====
  tenantKey: string;
  cloudId: string;
  
  // ===== Temporal Context =====
  createdAtISO: string;                  // ISO 8601, informational only
  generatedAtISO: string;                // When output was actually generated
  
  // ===== Ruleset Binding =====
  rulesetVersion: string;                // Which rules applied to this evidence
  
  // ===== Snapshot References =====
  snapshotRefs: SnapshotRef[];           // All snapshots used in computation
  
  // ===== Drift State =====
  driftStatusAtGeneration: DriftStateSnapshot;
  
  // ===== Normalized Inputs =====
  normalizedInputs: NormalizedInputs;
  
  // ===== Output Truth Metadata =====
  outputTruthMetadata: OutputTruthMetadata;
  
  // ===== Environment Context =====
  environmentFacts: EnvironmentFacts;
  
  // ===== Missing Data =====
  missingData: MissingDataDisclosure[];  // Explicit disclosure of gaps
}

/**
 * Evidence hash (computed from canonical serialization)
 * Immutable binding between evidence and its integrity
 */
export type EvidenceHash = string; // SHA256 hex string

/**
 * Evidence with its computed hash
 * Used when storing/retrieving evidence from immutable store
 */
export interface StoredEvidence {
  bundle: EvidenceBundle;
  hash: EvidenceHash;
  storedAtISO: string;
  retention: {
    maxAgeSeconds?: number;     // Optional TTL
    willBeDeletedAtISO?: string;
  };
}

/**
 * Regeneration verification result
 * Proves whether a stored evidence can reproduce its original truth
 */
export interface RegenerationVerificationResult {
  verified: boolean;
  evidenceId: string;
  originalHash: EvidenceHash;
  regeneratedHash: EvidenceHash;
  matchesStored: boolean;
  verificationTimestampISO: string;
  
  // If mismatch, record details
  mismatchDetails?: {
    originalTruthReasons: string[];
    regeneratedTruthReasons: string[];
    differenceDescription: string;
  };
  
  // INVARIANT violation flag
  invariantViolation: 'NONE' | 'HASH_MISMATCH' | 'MISSING_EVIDENCE' | 'SCHEMA_VERSION_UNSUPPORTED';
  auditEventId?: string; // Link to audit trail
}

/**
 * Evidence Pack (exportable, audit-defensible)
 * Bundles evidence with verification and watermarking
 */
export interface EvidencePack {
  // Core evidence
  evidence: EvidenceBundle;
  evidenceHash: EvidenceHash;
  
  // Verification proof
  regenerationVerification: RegenerationVerificationResult;
  
  // Explicit disclosures
  missingDataList: MissingDataDisclosure[];
  
  // Metadata for audit trail
  exportedAtISO: string;
  exportedByActorId?: string;
  
  // Watermarking if evidence is degraded
  requiresAcknowledgment: boolean;
  acknowledgmentReason?: string;
  watermarkText?: string;
  
  // PHASE P7: Entitlement Disclosures (always transparent)
  // If evidence pack history is truncated due to plan limits:
  historyTruncated?: boolean;  // true if evidence history was limited
  maxHistoryDaysApplied?: number;  // Maximum history days allowed by plan
  entitlementDisclosureReason?: string;  // Why truncation occurred (e.g., "Plan limit")
  planIdAtExport?: string;  // Which plan was active at export time (for transparency)
  
  // Schema
  schemaVersion: EvidenceSchemaVersion;
}

/**
 * Type guards
 */
export function isEvidenceBundle(obj: any): obj is EvidenceBundle {
  return (
    obj &&
    typeof obj.evidenceId === 'string' &&
    typeof obj.tenantKey === 'string' &&
    typeof obj.rulesetVersion === 'string' &&
    Array.isArray(obj.snapshotRefs) &&
    obj.outputTruthMetadata &&
    obj.environmentFacts
  );
}

export function isStoredEvidence(obj: any): obj is StoredEvidence {
  return (
    obj &&
    isEvidenceBundle(obj.bundle) &&
    typeof obj.hash === 'string' &&
    typeof obj.storedAtISO === 'string'
  );
}

export function isRegenerationVerificationResult(obj: any): obj is RegenerationVerificationResult {
  return (
    obj &&
    typeof obj.verified === 'boolean' &&
    typeof obj.matchesStored === 'boolean' &&
    typeof obj.invariantViolation === 'string'
  );
}
